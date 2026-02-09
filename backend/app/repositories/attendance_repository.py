from app.core.supabase import supabase

class AttendanceRepository:
    def __init__(self):
        self.table = "attendance"
        self.enrollment_table = "enrollment"

    def get_daily_attendance(self, program_id: int, date_str: str):
        # 1. Get all enrollments for the program to list ALL students
        # 1. Get all enrollments for the program to list ALL students
        # roll_no is in enrollment table, not student table
        enrollments = supabase.table(self.enrollment_table)\
            .select("enrollment_id, roll_no, student(student_id, name)")\
            .eq("program_id", program_id)\
            .execute().data

        if not enrollments:
            return []

        enrollment_ids = [e['enrollment_id'] for e in enrollments]

        # 2. Get existing attendance for this date (using the enrollment_ids filter)
        # Note: Supabase 'in' filter format is `col.in.(val1,val2)` for URL params, 
        # but the python client uses .in_("col", [list])
        attendance_records = supabase.table(self.table)\
            .select("*")\
            .in_("enrollment_id", enrollment_ids)\
            .eq("date", date_str)\
            .execute().data
            
        attendance_map = {a['enrollment_id']: a for a in attendance_records}
        
        # 3. Merge Data
        result = []
        for e in enrollments:
            student = e.get('student', {})
            att_record = attendance_map.get(e['enrollment_id'], {})
            
            result.append({
                "enrollment_id": e['enrollment_id'],
                "student_id": student.get('student_id'),
                "name": student.get('name'),
                "roll_no": e.get('roll_no'), # roll_no is in enrollment
                # Existing attendance data
                "attendance_id": att_record.get("attendance_id"),
                "status": att_record.get("status"), # None means not marked yet (default to Present in UI?)
                "date": date_str
            })
            
        # Sort by roll no
        def get_roll(x):
            return x.get('roll_no') or 999999
            
        result.sort(key=get_roll)
        return result

    def upsert_attendance(self, records: list):
        # Prepare records for upsert
        # If 'attendance_id' is None, remove it so Supabase creates a new one
        clean_records = []
        for r in records:
            data = {
                "enrollment_id": r.enrollment_id,
                "status": r.status,
                "date": r.date
            }
            if r.attendance_id:
                data["attendance_id"] = r.attendance_id
            
            clean_records.append(data)

        # Upsert
        # We rely on 'attendance_id' as PK for updates.
        # For new inserts, we hope for no duplicates for the same day (user discipline or future unique constraint).
        response = supabase.table(self.table).upsert(clean_records).execute()
        return response.data
