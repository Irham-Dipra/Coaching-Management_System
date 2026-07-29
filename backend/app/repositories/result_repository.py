from app.core.supabase import supabase
from app.schemas.result import BulkResultRequest
from app.repositories.exam_repository import ExamRepository

class ResultRepository:
    def __init__(self):
        self.result_table = "student_individual_result"
        self.enrollment_table = "enrollment"
        self.exam_repo = ExamRepository()

    def submit_bulk_results(self, bulk_data: BulkResultRequest):
        exam_id = bulk_data.exam_id
        
        # 3. Prepare the data for upsert and delete
        # If both marks are None, it means the record should be completely deleted (Not Recorded)
        upsert_list = []
        delete_list = []
        
        for item in bulk_data.results:
            if item.written_marks is None and item.mcq_marks is None:
                delete_list.append(item.student_id)
            else:
                upsert_list.append({
                    "student_id": item.student_id,
                    "exam_id": exam_id,
                    "written_marks": item.written_marks,
                    "mcq_marks": item.mcq_marks,
                })

        upsert_res = None
        
        # Process Deletions first
        if delete_list:
            supabase.table(self.result_table).delete().eq("exam_id", exam_id).in_("student_id", delete_list).execute()

        # Process Upserts
        if upsert_list:
            response = supabase.table(self.result_table).upsert(upsert_list, on_conflict="student_id, exam_id").execute()
            upsert_res = response.data

        return {"upserted": upsert_res, "deleted_students": delete_list}

        # Fetch results with student details for the Merit List
        # Now linked via student_id directly
        response = supabase.table(self.result_table)\
            .select("*, student(student_id, name, contact)")\
            .eq("exam_id", exam_id)\
            .order("total_score", desc=True)\
            .execute()
        
        return response.data

    def get_exam_results(self, exam_id: int):
        # 1. Get programs linked to this exam
        linked_programs = supabase.table("program_exam").select("program_id").eq("exam_id", exam_id).execute().data
        program_ids = [p['program_id'] for p in linked_programs]

        if not program_ids:
            return []

        # 2. Get students actively enrolled in these programs
        # We need to filter results to only show students who are currently in the linked programs
        enrollments = supabase.table(self.enrollment_table)\
            .select("student_id")\
            .in_("program_id", program_ids)\
            .eq("status", "Active")\
            .execute().data
            
        valid_student_ids = [e['student_id'] for e in enrollments]
        
        if not valid_student_ids:
            return []

        # 3. Fetch results with student details for the Merit List
        # Only for valid students
        response = supabase.table(self.result_table)\
            .select("*, student(student_id, name, contact)")\
            .eq("exam_id", exam_id)\
            .in_("student_id", valid_student_ids)\
            .order("total_score", desc=True)\
            .execute()
        
        return response.data

    def get_exam_analytics(self, exam_id: int):
        # Get raw results
        results = self.get_exam_results(exam_id)
        if not results:
            return None

        total_students = len(results)
        
        # Calculate Averages and Tops
        sum_written = 0
        sum_mcq = 0
        sum_total = 0
        
        # Track Top Scorers
        max_written = {"score": -1, "student": None}
        max_mcq = {"score": -1, "student": None}
        max_total = {"score": -1, "student": None}

        for r in results:
            student_info = r.get('student')
            w = r.get('written_marks')
            m = r.get('mcq_marks')
            
            # If marks are missing, treat as 0 for sum but skip for high score calculation if we want
            w_val = w if w is not None else 0
            m_val = m if m is not None else 0
            t_val = w_val + m_val

            sum_written += w_val
            sum_mcq += m_val
            sum_total += t_val

            if w is not None and w_val > max_written["score"]: 
                max_written = {"score": w_val, "student": student_info}
            if m is not None and m_val > max_mcq["score"]: 
                max_mcq = {"score": m_val, "student": student_info}
            
            # For total, if both are None, skip
            if (w is not None or m is not None) and t_val > max_total["score"]: 
                max_total = {"score": t_val, "student": student_info}

        return {
            "total_students": total_students,
            "averages": {
                "written": round(sum_written / total_students, 2) if total_students else 0,
                "mcq": round(sum_mcq / total_students, 2) if total_students else 0,
                "total": round(sum_total / total_students, 2) if total_students else 0
            },
            "highest": {
                "written": max_written["score"] if max_written["score"] != -1 else 0,
                "written_student": max_written["student"],
                "mcq": max_mcq["score"] if max_mcq["score"] != -1 else 0,
                "mcq_student": max_mcq["student"],
                "total": max_total["score"] if max_total["score"] != -1 else 0,
                "total_student": max_total["student"]
            }
        }

    def get_exam_candidates(self, exam_id: int):
        # 1. Get Linked Programs
        linked_programs = supabase.table("program_exam").select("program_id").eq("exam_id", exam_id).execute().data
        program_ids = [p['program_id'] for p in linked_programs]

        if not program_ids:
            return []

        # 2. Get active enrollments for these programs
        enrollments = supabase.table(self.enrollment_table)\
            .select("*, student(*), program(program_name)")\
            .in_("program_id", program_ids)\
            .eq("status", "Active")\
            .execute().data
        
        
        # 3. Get Existing Results for this Exam
        results = supabase.table(self.result_table)\
            .select("*")\
            .eq("exam_id", exam_id)\
            .execute().data
        
        # Map by student_id
        result_map = {r['student_id']: r for r in results}

        # 4. Map Results and Group by Student
        candidates_map = {}
        
        for enroll in enrollments:
            student = enroll.get('student')
            if not student: continue
            
            student_id = student['student_id']
            res = result_map.get(student_id)
            
            if student_id not in candidates_map:
                candidates_map[student_id] = {
                    "student": student,
                    "result_id": res['result_id'] if res else None,
                    "written_marks": res['written_marks'] if res else None,
                    "mcq_marks": res['mcq_marks'] if res else None,
                    "total_score": res['total_score'] if res else None,
                    "has_attended": True if res else False,
                    "enrollments": []
                }
            
            # Add enrollment info to the list
            candidates_map[student_id]["enrollments"].append({
                "enrollment_id": enroll['enrollment_id'],
                "program_id": enroll.get('program_id'),
                "program_name": enroll.get('program', {}).get('program_name'),
                "roll_no": enroll.get('roll_no')
            })

        # Convert map to list and sort
        candidates = list(candidates_map.values())
        candidates.sort(key=lambda x: x['student']['name'] or "")
        return candidates
