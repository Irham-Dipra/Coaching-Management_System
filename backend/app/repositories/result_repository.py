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
        
        # 3. Prepare the data for upsert
        # We now link result directly to student_id and exam_id
        upsert_list = []
        for item in bulk_data.results:
            upsert_list.append({
                "student_id": item.student_id,
                "exam_id": exam_id,
                "written_marks": item.written_marks,
                "mcq_marks": item.mcq_marks,
            })

        if not upsert_list:
            return {"message": "No data to upsert"}

        # 4. Perform Bulk Upsert
        response = supabase.table(self.result_table).upsert(upsert_list, on_conflict="student_id, exam_id").execute()
        return response.data

        # Fetch results with student details for the Merit List
        # Now linked via student_id directly
        response = supabase.table(self.result_table)\
            .select("*, student(student_id, name, roll_no)")\
            .eq("exam_id", exam_id)\
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
        max_written = 0
        max_mcq = 0
        max_total = 0

        for r in results:
            w = r.get('written_marks') or 0
            m = r.get('mcq_marks') or 0
            t = w + m # Manual sum

            sum_written += w
            sum_mcq += m
            sum_total += t

            if w > max_written: max_written = w
            if m > max_mcq: max_mcq = m
            if t > max_total: max_total = t

        return {
            "total_students": total_students,
            "averages": {
                "written": round(sum_written / total_students, 2) if total_students else 0,
                "mcq": round(sum_mcq / total_students, 2) if total_students else 0,
                "total": round(sum_total / total_students, 2) if total_students else 0
            },
            "highest": {
                "written": max_written,
                "mcq": max_mcq,
                "total": max_total
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

        # 4. Map Results (No Deduplication - Frontend handles grouping)
        candidates = []
        
        for enroll in enrollments:
            student = enroll.get('student')
            if not student: continue
            
            student_id = student['student_id']
            res = result_map.get(student_id)
            
            candidate_entry = {
                "enrollment_id": enroll['enrollment_id'],
                "student": student,
                "program_id": enroll.get('program_id'), 
                "program": enroll.get('program'),
                "program_roll_no": enroll.get('roll_no'), 
                "result_id": res['result_id'] if res else None,
                "written_marks": res['written_marks'] if res else 0,
                "mcq_marks": res['mcq_marks'] if res else 0,
                "total_score": res['total_score'] if res else 0,
                "has_attended": True if res else False
            }
            candidates.append(candidate_entry)

        # Sort by Student Name for easier reading, or Roll No
        candidates.sort(key=lambda x: x['student']['name'] or "")
        return candidates
