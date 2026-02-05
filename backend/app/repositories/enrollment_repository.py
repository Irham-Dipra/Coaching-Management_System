from app.core.supabase import supabase
from app.schemas.enrollment import EnrollmentCreate
from fastapi.encoders import jsonable_encoder
from datetime import date

class EnrollmentRepository:
    def __init__(self):
        self.table = "enrollment"

    def get_by_student(self, student_id: int):
        # Join with 'program' to get course name, and 'program.batch' for batch info
        response = supabase.table(self.table)\
            .select("*, program(*, batch(*))")\
            .eq("student_id", student_id)\
            .eq("status", "Active")\
            .execute()
        return response.data


    def enroll_student(self, enrollment: EnrollmentCreate):
        try:
            data = jsonable_encoder(enrollment)
            
            # Set default date if missing
            if not data.get('enrollment_date'):
                data['enrollment_date'] = date.today().isoformat()
            
            # 0. CHECK FOR DUPLICATES
            existing = supabase.table(self.table)\
                .select("enrollment_id")\
                .eq("student_id", data['student_id'])\
                .eq("program_id", data['program_id'])\
                .execute()
            
            if existing.data:
                raise Exception("Student is already enrolled in this program")

            # 1. AUTO-GENERATE ROLL NUMBER (Per Program)
            # Fetch the current highest roll_no for this program
            last_enrollment = supabase.table(self.table)\
                .select('roll_no')\
                .eq('program_id', data['program_id'])\
                .order('roll_no', desc=True)\
                .limit(1)\
                .execute()
                
            next_roll = 1
            if last_enrollment.data:
                current_max = last_enrollment.data[0].get('roll_no')
                if current_max is not None:
                    next_roll = current_max + 1
            
            data['roll_no'] = next_roll

            # 2. Insert
            response = supabase.table(self.table).insert(data).execute()
            return response.data[0]
        except Exception as e:
            print(f"ERROR in enroll_student: {e}")
            raise e

    def delete_enrollment(self, enrollment_id: int):
        # Phase 20: Smart Delete to preserve financial history
        # 1. Check for existing payments linked to this enrollment
        payments = supabase.table("payment")\
            .select("payment_id", count="exact")\
            .eq("enrollment_id", enrollment_id)\
            .execute()
            
        has_payments = payments.count and payments.count > 0
        
        if has_payments:
            # Soft Delete: Mark as 'Withdrawn' so they vanish from active lists but history persists
            print(f"Soft deleting enrollment {enrollment_id} (Has {payments.count} payments)")
            response = supabase.table(self.table)\
                .update({"status": "Withdrawn"})\
                .eq("enrollment_id", enrollment_id)\
                .execute()
        else:
            # Hard Delete: Safe to remove
            print(f"Hard deleting enrollment {enrollment_id} (No payments)")
            response = supabase.table(self.table).delete().eq("enrollment_id", enrollment_id).execute()
            
        return response.data
