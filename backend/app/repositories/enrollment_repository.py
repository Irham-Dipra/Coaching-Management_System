from app.core.supabase import supabase
from app.core.stats_cache import invalidate_stats_cache
from app.core.students_cache import invalidate_students_cache
from app.schemas.enrollment import EnrollmentCreate
from fastapi.encoders import jsonable_encoder
from datetime import date, datetime
import uuid

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
            
        # Filter out soft-deleted programs
        data = [
            e for e in response.data 
            if e.get('program') and e.get('program').get('is_active') is not False
        ]
            
        return data


    def enroll_student(self, enrollment: EnrollmentCreate):
        try:
            data = jsonable_encoder(enrollment)
            
            # Set default date if missing
            if not data.get('enrollment_date'):
                data['enrollment_date'] = date.today().isoformat()
            
            # 0.5 FETCH PROGRAM FEE
            prog_res = supabase.table("program").select("monthly_fee").eq("program_id", data['program_id']).execute()
            monthly_fee = prog_res.data[0]['monthly_fee'] if prog_res.data else 0
            
            # Set default agreed fee
            data['current_agreed_fee'] = monthly_fee
            
            dt = datetime.strptime(data['enrollment_date'], "%Y-%m-%d")
            
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
                        "enrollment_date": date.today().isoformat(),
                        "current_agreed_fee": monthly_fee
                        # Keep original roll_no or other history
                    }).eq("enrollment_id", record['enrollment_id']).execute()
                    
                    result = updated_record.data[0]
                    result['is_reenrollment'] = True
                    
                    # Log History
                    history_data = {
                        "history_id": str(uuid.uuid4()),
                        "enrollment_id": result['enrollment_id'],
                        "fee_amount": monthly_fee,
                        "effective_month": dt.month,
                        "effective_year": dt.year
                    }
                    supabase.table("enrollment_fee_history").insert(history_data).execute()
                    
                    # Re-enrollment: program badges on student row changed
                    invalidate_students_cache()
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
            
            # Log Initial History
            history_data = {
                "history_id": str(uuid.uuid4()),
                "enrollment_id": result['enrollment_id'],
                "fee_amount": monthly_fee,
                "effective_month": dt.month,
                "effective_year": dt.year
            }
            supabase.table("enrollment_fee_history").insert(history_data).execute()
            
            # New enrollment: program badge appears on student row
            invalidate_students_cache()
            return result
        except Exception as e:
            print(f"ERROR in enroll_student: {e}")
            raise e

    def delete_enrollment(self, enrollment_id: int):
        # 1. Always hard-delete the fee history for this enrollment
        supabase.table("enrollment_fee_history").delete().eq("enrollment_id", enrollment_id).execute()

        # 2. Check for existing payments linked to this enrollment
        payments = supabase.table("payment")\
            .select("payment_id", count="exact")\
            .eq("enrollment_id", enrollment_id)\
            .execute()

        has_payments = payments.count and payments.count > 0

        if has_payments:
            # Soft Delete: Mark as 'Withdrawn' so payment history is preserved
            print(f"Soft deleting enrollment {enrollment_id} (Has {payments.count} payments)")
            response = supabase.table(self.table)\
                .update({"status": "Withdrawn"})\
                .eq("enrollment_id", enrollment_id)\
                .execute()
        else:
            # Hard Delete: Safe to remove entirely
            print(f"Hard deleting enrollment {enrollment_id} (No payments)")
            response = supabase.table(self.table).delete().eq("enrollment_id", enrollment_id).execute()

        invalidate_stats_cache()           # Enrollment change affects dues
        invalidate_students_cache()         # Enrollment badge removed from student row
        return response.data

    def enroll_student_bulk(self, student_ids: list[int], program_ids: list[int], enrollment_date: str = None, custom_fees: dict = None):
        results = []
        
        # Process one program at a time to manage roll numbers correctly
        for program_id in program_ids:
            # 0.5 Fetch Program Fee
            prog_res = supabase.table("program").select("monthly_fee").eq("program_id", program_id).execute()
            monthly_fee = prog_res.data[0]['monthly_fee'] if prog_res.data else 0
            
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
            
            today_str = enrollment_date or date.today().isoformat()
            dt = datetime.strptime(today_str, "%Y-%m-%d")
            
            history_inserts = []
            
            for student_id in student_ids:
                # Resolve Custom Fee
                prog_custom = custom_fees.get(str(program_id), {}) if custom_fees else {}
                final_fee = prog_custom.get(str(student_id), monthly_fee)
                
                if student_id in existing_map:
                    # Handle Re-enrollment or Skip
                    rec = existing_map[student_id]
                    if rec['status'] != 'Active':
                        # Re-activate
                        supabase.table(self.table).update({
                            "status": "Active", 
                            "enrollment_date": today_str,
                            "current_agreed_fee": final_fee
                        }).eq("enrollment_id", rec['enrollment_id']).execute()
                        results.append({"student_id": student_id, "program_id": program_id, "status": "Re-enrolled"})
                        
                        history_inserts.append({
                            "history_id": str(uuid.uuid4()),
                            "enrollment_id": rec['enrollment_id'],
                            "fee_amount": final_fee,
                            "effective_month": dt.month,
                            "effective_year": dt.year
                        })
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
                        "status": "Active",
                        "current_agreed_fee": final_fee
                    })
                    next_roll += 1
            
            # 3. Bulk Insert for this program
            if enrollments_to_insert:
                response = supabase.table(self.table).insert(enrollments_to_insert).execute()
                for inserted in response.data:
                    results.append({"student_id": inserted['student_id'], "program_id": inserted['program_id'], "status": "Enrolled"})
                    
                    history_inserts.append({
                        "history_id": str(uuid.uuid4()),
                        "enrollment_id": inserted['enrollment_id'],
                        "fee_amount": inserted['current_agreed_fee'],
                        "effective_month": dt.month,
                        "effective_year": dt.year
                    })
            
            # 4. Insert History Logging
            if history_inserts:
                supabase.table("enrollment_fee_history").insert(history_inserts).execute()

        # Enrollment badges on student rows have changed
        invalidate_students_cache()
        return results

    def update_agreed_fee(self, enrollment_id: int, new_fee: float, effective_date: str):
        # 1. Fetch enrollment logic to validate dates
        enroll_res = supabase.table(self.table).select('enrollment_date').eq('enrollment_id', enrollment_id).execute()
        if not enroll_res.data:
            raise Exception("Enrollment record not found")
        
        enroll_dt = datetime.strptime(enroll_res.data[0]['enrollment_date'], "%Y-%m-%d")
        new_dt = datetime.strptime(effective_date, "%Y-%m-%d")
        
        # Validation 1: Cannot set fee before the student even enrolled
        if (new_dt.year < enroll_dt.year) or (new_dt.year == enroll_dt.year and new_dt.month < enroll_dt.month):
            raise Exception("Cannot adjust a fee for a date before the student's enrollment date.")

        # 2. Update the cache current_agreed_fee
        supabase.table(self.table).update({
            "current_agreed_fee": new_fee
        }).eq("enrollment_id", enrollment_id).execute()
        
        # 3. Handle Historical Overlaps (The "Sweep")
        # If the user sets a new fee from June, we must delete any existing 
        # fee histories from June onwards so the new fee acts as the active override.
        # Supabase doesn't easily do complex OR logic in Python client, so we can fetch and delete OR delete via RPC.
        # Alternatively, delete by fetching IDs first.
        histories = supabase.table("enrollment_fee_history").select("history_id, effective_year, effective_month").eq("enrollment_id", enrollment_id).execute()
        
        ids_to_delete = []
        for h in histories.data:
            h_year = h['effective_year']
            h_month = h['effective_month']
            if h_year > new_dt.year or (h_year == new_dt.year and h_month >= new_dt.month):
                ids_to_delete.append(h['history_id'])
                
        if ids_to_delete:
            supabase.table("enrollment_fee_history").delete().in_("history_id", ids_to_delete).execute()
        
        # 4. Add the new entry to 'enrollment_fee_history'
        history_data = {
            "history_id": str(uuid.uuid4()),
            "enrollment_id": enrollment_id,
            "fee_amount": new_fee,
            "effective_month": new_dt.month,
            "effective_year": new_dt.year
        }
        supabase.table("enrollment_fee_history").insert(history_data).execute()
        invalidate_stats_cache()  # Fee change affects future dues
        return {"success": True, "message": "Fee updated successfully", "new_fee": new_fee, "effective_date": effective_date}

