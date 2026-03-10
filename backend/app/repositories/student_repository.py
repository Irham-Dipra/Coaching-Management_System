# Imports the 'supabase' connection object we created in app/core/supabase.py
from app.core.supabase import supabase
from app.core.stats_cache import invalidate_stats_cache
from app.core.students_cache import get_cached_students, set_cached_students, make_key, invalidate_students_cache
from app.schemas.student import StudentCreate

class StudentRepository:
    def __init__(self):
        # Define the table name once so we don't typo it later
        # NOTE: Postgres table names are usually lowercase!
        self.table = "student"

    def get_all_students(self):
        # Fetch students with Batch info and Enrollment (Program) info
        # Phase 22: Filter by is_active=true
        response = supabase.table(self.table)\
            .select("*, batch(batch_name), enrollment(program_id, roll_no, status, program(program_name, is_active))")\
            .eq('is_active', True)\
            .execute()
        
        # Phase 21: Filter out 'Withdrawn' enrollments from the list
        # We process this in Python to keep the Student row even if they have no active enrollments
        data = response.data
        for student in data:
            if 'enrollment' in student:
                student['enrollment'] = [
                    e for e in student['enrollment'] 
                    if e.get('status') == 'Active' and e.get('program', {}).get('is_active') is not False
                ]
                
        return data

    def get_students_paginated(self, page: int = 1, page_size: int = 50, search: str = None, roll_search: str = None, filters: dict = None, sort_by: str = None, sort_desc: bool = False):
        """
        Fetches students with server-side pagination, search, filters, and sorting.
        Results are cached in memory for 60 seconds per unique parameter set.
        The cache is invalidated on any student or enrollment mutation.
        """
        # --- CACHE CHECK ---
        cache_key = make_key(page, page_size, search, roll_search, filters, sort_by, sort_desc)
        cached = get_cached_students(cache_key)
        if cached:
            return cached

        # Base Query
        # We perform a joined query to filter by nested fields if needed (program, roll)
        # Note: 'enrollment!inner' forces students to have at least one enrollment if we filter by it.
        # But for general list, we use 'enrollment' (left join implicit in Supabase usually, but filters might change it).
        
        # We need to build the query dynamically based on filters to avoid strict inner joins if not filtering by them.
        
        select_str = "*, batch(batch_name), enrollment(program_id, roll_no, status, program(program_name, is_active))"
        
        # FIX: PostgREST requires '!inner' to filter the PARENT (student) based on CHILD (enrollment) conditions.
        # If we don't use !inner, it just filters the child array but returns all parents (students).
        has_enrollment_filter = (filters and filters.get('program_id')) or roll_search
        
        if has_enrollment_filter:
            select_str = "*, batch(batch_name), enrollment!inner(program_id, roll_no, status, program(program_name, is_active))"
        
        # Phase 22: Filter by is_active=true
        query = supabase.table(self.table).select(select_str, count="exact").eq('is_active', True)
        
        # 1. Search (Name OR Student Code)
        if search:
            # User requested that "ID" search should check 'student_code' (text), not 'student_id' (int).
            # We search for the term in EITHER name OR student_code using the .or_() filter.
            # Syntax: column1.ilike.pattern,column2.ilike.pattern
            query = query.or_(f"name.ilike.%{search}%,student_code.ilike.%{search}%")
                
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

        # Sorting
        if sort_by:
            # Prevent invalid column names (basic validation)
            if sort_by in ['student_code', 'student_id', 'name', 'class', 'batch_id']:
                query = query.order(sort_by, desc=sort_desc)
            else:
                # Default order if unknown sort_by provided
                query = query.order("student_id", desc=True)
        else:
            query = query.order("student_id", desc=True) # Default sort to newest

        # Pagination
        start = (page - 1) * page_size
        end = start + page_size - 1
        
        response = query.range(start, end).execute()
        
        # Post-Processing
        data = response.data
        count = response.count
        
        # Filter Withdrawn & Soft-Deleted Programs
        for student in data:
            if 'enrollment' in student:
                student['enrollment'] = [
                    e for e in student['enrollment'] 
                    if e.get('status') == 'Active' and e.get('program', {}).get('is_active') is not False
                ]
        
        result = {"data": data, "total_count": count}
        
        # --- CACHE SET ---
        set_cached_students(cache_key, result)
        return result

    def enroll_new_student(self, student_data: StudentCreate):
        # Convert Pydantic object to a dictionary
        data_dict = student_data.dict()
        
        # FIX: The database column is named "class", but our Pydantic field is "class_grade"
        # We need to rename it before sending to Supabase
        if 'class_grade' in data_dict:
            data_dict['class'] = data_dict.pop('class_grade')

        # Insert the corrected dictionary
        response = supabase.table(self.table).insert(data_dict).execute()
        
        # New student changes the list
        invalidate_students_cache()
        
        # Return only the 'data' part (ignoring status codes, etc.)
        return response.data[0]

    def get_student_by_id(self, student_id: int):
        # Join enrollment -> program to see what they are studying
        response = supabase.table(self.table)\
            .select("*, batch(*), enrollment(*, program(*, is_active))")\
            .eq("student_id", student_id)\
            .execute()
            
        if not response.data:
            return None
            
        student = response.data[0]
        
        # Phase 21: Filter out 'Withdrawn' enrollments
        # Phase 29: Also filter out Soft-Deleted Programs (is_active=False)
        if 'enrollment' in student:
             student['enrollment'] = [
                 e for e in student['enrollment'] 
                 if e.get('status') == 'Active' and e.get('program', {}).get('is_active') is not False
             ]
             
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
        
        # Name/class/contact changes should be visible in the list immediately
        invalidate_students_cache()
        return response.data[0] if response.data else None

    def delete_student(self, student_id: int):
        """
        Soft delete a student:
        1. Hard-delete all enrollment_fee_history for this student's enrollments
        2. Set is_active = False
        3. Set all enrollments to 'Withdrawn'
        4. Delete all results from student_individual_result
        5. (Payments are preserved)
        """
        # 1. Fetch all enrollment IDs for this student
        enrollment_res = supabase.table('enrollment')\
            .select('enrollment_id')\
            .eq('student_id', student_id)\
            .execute()

        if enrollment_res.data:
            enrollment_ids = [e['enrollment_id'] for e in enrollment_res.data]
            chunk_size = 200
            for i in range(0, len(enrollment_ids), chunk_size):
                chunk = enrollment_ids[i:i + chunk_size]
                supabase.table('enrollment_fee_history').delete().in_('enrollment_id', chunk).execute()

        # 2. Soft Delete Student
        supabase.table(self.table).update({'is_active': False}).eq('student_id', student_id).execute()

        # 3. Withdraw Enrollments
        supabase.table('enrollment').update({'status': 'Withdrawn'}).eq('student_id', student_id).execute()

        # 4. Delete Results
        supabase.table('student_individual_result').delete().eq('student_id', student_id).execute()

        invalidate_stats_cache()       # Student removal affects dues
        invalidate_students_cache()     # Student must disappear from paginated list
        return {"message": "Student soft deleted successfully"}

    def register_student_with_enrollment(self, student_data: StudentCreate, program_ids: list[int], enrollment_date: str = None, custom_fees: dict = None):
        # Convert Pydantic object to a dictionary
        data_dict = student_data.dict()
        
        # FIX: The database column is named "class", but our Pydantic field is "class_grade"
        if 'class_grade' in data_dict:
            data_dict['class'] = data_dict.pop('class_grade')

        # 1. Insert Student directly
        res = supabase.table('student').insert(data_dict).execute()
        
        if not res.data:
            raise Exception("Failed to insert student")
            
        student_id = res.data[0]['student_id']

        # Custom fee key mapping (frontend uses dummy ID "0" for the uncreated student)
        mapped_fees = None
        if custom_fees:
            mapped_fees = {}
            for pid, fees in custom_fees.items():
                mapped_fees[pid] = {str(student_id): fees.get("0", 0)}

        # 2. Use the standard robust bulk enrollment flow to create enrollments + history logs!
        from app.repositories.enrollment_repository import EnrollmentRepository
        enroll_repo = EnrollmentRepository()
        enroll_repo.enroll_student_bulk(
            student_ids=[student_id], 
            program_ids=program_ids,
            enrollment_date=enrollment_date,
            custom_fees=mapped_fees
        )
        # enroll_student_bulk already invalidates students cache; also invalidate here
        # for the student row itself being newly visible in the list.
        invalidate_students_cache()
        return res.data[0]

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
        if exam_ids:
            # FIX: N+1 loop replaced by bulk IN query
            exam_data = supabase.table("exam")\
                .select("exam_id, exam_name, exam_date, total_marks")\
                .in_("exam_id", exam_ids)\
                .execute().data
            
            if exam_data:
                for ed in exam_data:
                    exam_map[ed['exam_id']] = ed

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