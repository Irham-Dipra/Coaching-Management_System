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
            
            # 0. CHECK FOR EXISTING ENROLLMENT
            existing = supabase.table(self.table)\
                .select("*")\
                .eq("student_id", data['student_id'])\
                .eq("program_id", data['program_id'])\
                .execute()
            
            if existing.data:
                record = existing.data[0]
                if record['status'] == 'Active':
                    raise Exception("Student is already actively enrolled in this program")
                else:
                    # RE-ENROLLMENT PATH
                    # Update status to Active and set enrollment_date to today for fresh billing
                    print(f"Re-enrolling student {data['student_id']} in program {data['program_id']}")
                    updated_record = supabase.table(self.table).update({
                        "status": "Active",
                        "enrollment_date": date.today().isoformat()
                        # Keep original roll_no or other history
                    }).eq("enrollment_id", record['enrollment_id']).execute()
                    
                    result = updated_record.data[0]
                    result['is_reenrollment'] = True
                    return result

            # 1. NEW ENROLLMENT (Generate Roll Number)
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
            result = response.data[0]
            result['is_reenrollment'] = False
            return result
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

    def enroll_student_bulk(self, student_ids: list[int], program_ids: list[int]):
        results = []
        
        # Process one program at a time to manage roll numbers correctly
        for program_id in program_ids:
            # 1. Fetch current max roll for this program
            last_enrollment = supabase.table(self.table)\
                .select('roll_no')\
                .eq('program_id', program_id)\
                .order('roll_no', desc=True)\
                .limit(1)\
                .execute()
                
            next_roll = 1
            if last_enrollment.data:
                current_max = last_enrollment.data[0].get('roll_no')
                if current_max is not None:
                    next_roll = current_max + 1
            
            # 2. Prepare Valid Enrollments
            enrollments_to_insert = []
            
            # Fetch existing enrollments for these students in this program to avoid duplicates
            existing = supabase.table(self.table)\
                .select("student_id, status, enrollment_id")\
                .in_("student_id", student_ids)\
                .eq("program_id", program_id)\
                .execute().data
                
            existing_map = {e['student_id']: e for e in existing}
            
            today_str = date.today().isoformat()
            
            for student_id in student_ids:
                if student_id in existing_map:
                    # Handle Re-enrollment or Skip
                    rec = existing_map[student_id]
                    if rec['status'] != 'Active':
                        # Re-activate
                        supabase.table(self.table).update({
                            "status": "Active", 
                            "enrollment_date": today_str
                        }).eq("enrollment_id", rec['enrollment_id']).execute()
                        results.append({"student_id": student_id, "program_id": program_id, "status": "Re-enrolled"})
                    else:
                        # Already Active
                        results.append({"student_id": student_id, "program_id": program_id, "status": "Skipped (Already Active)"})
                else:
                    # New Enrollment
                    enrollments_to_insert.append({
                        "student_id": student_id,
                        "program_id": program_id,
                        "enrollment_date": today_str,
                        "roll_no": next_roll,
                        "status": "Active"
                    })
                    next_roll += 1
            
            # 3. Bulk Insert for this program
            if enrollments_to_insert:
                response = supabase.table(self.table).insert(enrollments_to_insert).execute()
                for inserted in response.data:
                    results.append({"student_id": inserted['student_id'], "program_id": inserted['program_id'], "status": "Enrolled"})

        return results
