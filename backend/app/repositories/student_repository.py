# Imports the 'supabase' connection object we created in app/core/supabase.py
from app.core.supabase import supabase
from app.schemas.student import StudentCreate

class StudentRepository:
    def __init__(self):
        # Define the table name once so we don't typo it later
        # NOTE: Postgres table names are usually lowercase!
        self.table = "student"

    def get_all_students(self):
        # Fetch students with Batch info and Enrollment (Program) info
        response = supabase.table(self.table)\
            .select("*, batch(batch_name), enrollment(program_id, roll_no, status, program(program_name))")\
            .execute()
        
        # Phase 21: Filter out 'Withdrawn' enrollments from the list
        # We process this in Python to keep the Student row even if they have no active enrollments
        data = response.data
        for student in data:
            if 'enrollment' in student:
                student['enrollment'] = [e for e in student['enrollment'] if e.get('status') == 'Active']
                
        return data

    def get_students_paginated(self, page: int = 1, page_size: int = 50, search: str = None, roll_search: str = None, filters: dict = None):
        """
        Fetches students with server-side pagination, search, and filters.
        """
        # Base Query
        # We perform a joined query to filter by nested fields if needed (program, roll)
        # Note: 'enrollment!inner' forces students to have at least one enrollment if we filter by it.
        # But for general list, we use 'enrollment' (left join implicit in Supabase usually, but filters might change it).
        
        # We need to build the query dynamically based on filters to avoid strict inner joins if not filtering by them.
        
        select_str = "*, batch(batch_name), enrollment(program_id, roll_no, status, program(program_name))"
        
        query = supabase.table(self.table).select(select_str, count="exact")
        
        # 1. Search (Name/ID)
        if search:
            if search.isdigit():
                query = query.eq("student_id", int(search))
            else:
                query = query.ilike("name", f"%{search}%")
                
        # 2. Roll Search (Needs checking inside enrollment)
        # Supabase doesn't support "OR" across tables easily or "ANY element in array matches".
        # But we can use `enrollment.roll_no` ilike.
        # CAUTION: Filtering on nested resource changes join type to INNER in PostgREST usually.
        # This means students without enrollments might vanish if we filter by roll_no.
        # But if we search by roll, we expect them to have enrollment. So that's fine.
        if roll_search:
             query = query.ilike("enrollment.roll_no", f"%{roll_search}%")
             # We must change select to inner for this to work as filter? 
             # Actually PostgREST filters on nested resource implicitly turn it into inner join logic for the result.
             
        # 3. Filters
        if filters:
            if filters.get('class'):
                query = query.eq("class", int(filters['class']))
            if filters.get('batch_id'):
                query = query.eq("batch_id", int(filters['batch_id']))
            if filters.get('program_id'):
                query = query.eq("enrollment.program_id", int(filters['program_id']))

        # Pagination
        start = (page - 1) * page_size
        end = start + page_size - 1
        
        response = query.range(start, end).execute()
        
        # Post-Processing
        data = response.data
        count = response.count
        
        # Filter Withdrawn
        for student in data:
            if 'enrollment' in student:
                student['enrollment'] = [e for e in student['enrollment'] if e.get('status') == 'Active']
                
        return {
            "data": data,
            "total_count": count
        }

    def enroll_new_student(self, student_data: StudentCreate):
        # Convert Pydantic object to a dictionary
        data_dict = student_data.dict()
        
        # FIX: The database column is named "class", but our Pydantic field is "class_grade"
        # We need to rename it before sending to Supabase
        if 'class_grade' in data_dict:
            data_dict['class'] = data_dict.pop('class_grade')

        # Insert the corrected dictionary
        response = supabase.table(self.table).insert(data_dict).execute()
        
        # Return only the 'data' part (ignoring status codes, etc.)
        return response.data[0]

    def get_student_by_id(self, student_id: int):
        # Join enrollment -> program to see what they are studying
        response = supabase.table(self.table)\
            .select("*, batch(*), enrollment(*, program(*))")\
            .eq("student_id", student_id)\
            .execute()
            
        if not response.data:
            return None
            
        student = response.data[0]
        
        # Phase 21: Filter out 'Withdrawn' enrollments
        if 'enrollment' in student:
             student['enrollment'] = [e for e in student['enrollment'] if e.get('status') == 'Active']
             
        return student

    def update_student(self, student_id: int, updates: dict):
        # 1. Clean the payload
        #    Remove fields that shouldn't be updated or are nested objects from Joins
        start_keys = list(updates.keys())
        for key in start_keys:
            # Remove nested objects (dicts/lists) because they are joins (e.g. 'batch': {...})
            if isinstance(updates[key], (dict, list)):
                del updates[key]
            # Remove PK/Audit fields
            if key in ['student_id', 'created_at']:
                del updates[key]

        # 2. Handle simple renaming
        if 'class_grade' in updates:
            updates['class'] = updates.pop('class_grade')
            
        # 3. Execute Update
        response = supabase.table(self.table)\
            .update(updates)\
            .eq("student_id", student_id)\
            .execute()
        return response.data[0] if response.data else None

    def register_student_with_enrollment(self, student_data: StudentCreate, program_ids: list[int]):
        # Convert Pydantic object to a dictionary
        data_dict = student_data.dict()
        
        # FIX: The database column is named "class", but our Pydantic field is "class_grade"
        if 'class_grade' in data_dict:
            data_dict['class_grade'] = data_dict.pop('class_grade') # RPC expects 'class_grade' key for logic inside

        # Call the RPC
        response = supabase.rpc('register_student_with_enrollment', {
            'p_student_data': data_dict,
            'p_program_ids': program_ids
        }).execute()
        
        return response.data

    def get_student_analytics(self, student_id: int):
        """Get performance analytics for a single student across all their exams."""

        # 1. Get all results for this student
        raw_results = supabase.table("student_individual_result")\
            .select("*")\
            .eq("student_id", student_id)\
            .execute().data

        if not raw_results:
            return None

        # 2. Get unique exam_ids and fetch exam metadata
        exam_ids = list(set([r['exam_id'] for r in raw_results]))

        exam_map = {}
        for eid in exam_ids:
            exam_data = supabase.table("exam")\
                .select("exam_id, exam_name, exam_date, total_marks")\
                .eq("exam_id", eid)\
                .execute().data
            if exam_data:
                exam_map[eid] = exam_data[0]

        # 3. Process per-exam metrics
        exam_analytics = []

        for eid, exam_meta in exam_map.items():
            exam_results = [r for r in raw_results if r['exam_id'] == eid]

            if not exam_results:
                continue

            # Student should have exactly one result per exam, but handle gracefully
            result = exam_results[0]
            total_score = result.get('total_score', 0) or 0
            written = result.get('written_marks', 0) or result.get('obt_written_mark', 0) or 0
            mcq = result.get('mcq_marks', 0) or result.get('obt_mcq_mark', 0) or 0
            max_marks = exam_meta.get('total_marks', 100) or 100
            percentage = round((total_score / max_marks) * 100, 1) if max_marks else 0

            exam_analytics.append({
                "exam_id": eid,
                "exam_name": exam_meta.get('exam_name', 'Unknown'),
                "date": exam_meta.get('exam_date', ''),
                "total_marks": max_marks,
                "metrics": {
                    "total_score": total_score,
                    "written": written,
                    "mcq": mcq,
                    "percentage": percentage
                }
            })

        exam_analytics.sort(key=lambda x: x['date'] if x['date'] else '')

        # 4. Attendance data from enrollments
        enrollments = supabase.table("enrollment")\
            .select("enrollment_id")\
            .eq("student_id", student_id)\
            .execute().data

        enrollment_ids = [e['enrollment_id'] for e in (enrollments or [])]

        attendance_records = []
        if enrollment_ids:
            attendance_records = supabase.table("attendance")\
                .select("status, date")\
                .in_("enrollment_id", enrollment_ids)\
                .execute().data

        att_map = {}
        for a in (attendance_records or []):
            d = a['date']
            if d not in att_map:
                att_map[d] = 'Absent'
            if a['status'] == 'Present':
                att_map[d] = 'Present'

        att_trend = []
        for d in sorted(att_map.keys()):
            att_trend.append({"date": d, "status": att_map[d]})

        # 5. Summary stats
        if exam_analytics:
            all_pcts = [e['metrics']['percentage'] for e in exam_analytics]
            all_totals = [e['metrics']['total_score'] for e in exam_analytics]
            summary = {
                "avg_percentage": round(sum(all_pcts) / len(all_pcts), 1),
                "highest_score": max(all_totals),
                "lowest_score": min(all_totals),
                "total_exams": len(exam_analytics),
                "attendance_present": sum(1 for a in att_trend if a['status'] == 'Present'),
                "attendance_total": len(att_trend)
            }
        else:
            summary = {
                "avg_percentage": 0,
                "highest_score": 0,
                "lowest_score": 0,
                "total_exams": 0,
                "attendance_present": 0,
                "attendance_total": 0
            }

        return {
            "summary": summary,
            "exams": exam_analytics,
            "attendance_trend": att_trend
        }