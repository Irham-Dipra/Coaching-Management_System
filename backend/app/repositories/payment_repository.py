from app.core.supabase import supabase
from datetime import datetime, date

class PaymentRepository:
    """
    Repository class for handling all database operations related to Payments.
    It uses Supabase (a backend-as-a-service wrapping PostgreSQL) to store and retrieve data.
    """
    def __init__(self):
        # define the table names we will be working with
        self.table = "payment"
        self.enrollment_table = "enrollment"

    def create_bulk_payment(self, data_list: list):
        """
        Creates multiple payment records in a SINGLE ATOMIC TRANSACTION.
        
        Args:
            data_list: List of dictionaries, each containing payment details for a specific month.
            
        Algorithm:
            1. Validate that all entries belong to the same student/program (optional but good practice).
            2. Generate a single 'transaction_group_id' to link them all together.
            3. Prepare the list of objects for Supabase.
            4. Execute a single .insert([list]) call. Supabase/Postgres treats this as an atomic batch.
        """
        if not data_list:
            raise Exception("No payment data provided")
            
        import uuid
        # Generate one ID for the whole batch
        group_id = str(uuid.uuid4())
        
        # Prepare batch payload
        batch_payload = []
        
        print(f"Processing Bulk Payment of {len(data_list)} months...")
        
        for data in data_list:
            # Resolve Enrollment ID (Optimization: Could be done once if UI sends enrollment_id directly, 
            # but usually UI sends StudentID+ProgramID. We'll resolve strict.)
            
            # For efficiency, if the UI sends 'enrollment_id' we skip the query. 
            # If not, we query. To keep it robust, let's assume UI sends enrollment_id or we fetch it.
            # Let's start simple: UI *should* send enrollment_id. If not, we fetch it.
            
            eid = data.get('enrollment_id')
            if not eid:
                # Fetch logic repeated for robustness (or assume UI sends it)
                enrollment = supabase.table(self.enrollment_table)\
                    .select("enrollment_id")\
                    .eq("student_id", data['student_id'])\
                    .eq("program_id", data['program_id'])\
                    .execute().data
                if not enrollment:
                    raise Exception(f"Enrollment not found for Student {data['student_id']} Program {data['program_id']}")
                eid = enrollment[0]['enrollment_id']

            record = {
                "enrollment_id": eid,
                "paid_amount": float(data['paid_amount']),
                "payment_date": data['payment_date'],
                "month": int(data['month']),
                "year": int(data['year']),
                "payment_method": data.get('payment_method'),
                "remarks": data.get('remarks'),
                "transaction_group_id": group_id
            }
            batch_payload.append(record)
            
        try:
            # Atomic Batch Insert
            print(f"Executing Batch Insert for Group {group_id}")
            response = supabase.table(self.table).insert(batch_payload).execute()
            return response.data
        except Exception as e:
            print(f"Bulk Insert Failed: {e}")
            raise e

    def get_payment_status(self, enrollment_id: int):
        """
        Calculates the current financial standing for a specific enrollment.
        Used by the Frontend to determining which months are paid/unpaid.
        """
        # 1. Get Enrollment Details (Start Date, Fee)
        enrollment = supabase.table(self.enrollment_table)\
            .select("enrollment_date, program(monthly_fee)")\
            .eq("enrollment_id", enrollment_id)\
            .single()\
            .execute().data
            
        if not enrollment:
            return None
            
        start_date = datetime.strptime(enrollment['enrollment_date'], "%Y-%m-%d").date()
        monthly_fee = float(enrollment['program']['monthly_fee'] or 0)
        
        # 2. Get All Payments for this enrollment
        payments = supabase.table(self.table)\
            .select("month, year, paid_amount")\
            .eq("enrollment_id", enrollment_id)\
            .execute().data
            
        today = date.today()
        
        # 3. Calculate Ledger
        
        # Determine the range: Start from Enrollment, End at MAX(Today, Last Payment Date)
        ledger = []
        total_due = 0
        
        # Helper to iterate months
        curr = start_date.replace(day=1)
        
        # Find the latest payment date to ensure we cover advance payments
        last_payment_date = today
        if payments:
            max_p_month = max(p['month'] for p in payments)
            max_p_year = max(p['year'] for p in payments)
            # Create a date object from max payment (approximate to end of that month)
            # Handle December overlap
            if max_p_month == 12:
                 last_payment_date = date(max_p_year + 1, 1, 1)
            else:
                 last_payment_date = date(max_p_year, max_p_month + 1, 1) 
                 # This sets it to first day of NEXT month, ensuring the loop covers the payment month.
        
        # End date is the later of Today or the last paid month
        end = max(today.replace(day=1), last_payment_date)
        
        paid_up_to = None
        
        # We loop until we cover the range. 
        # Note: If we just want to show "Active" dues, we might separate "Future Ledger" from "Due Ledger".
        # But for "Greying out" logic, we need to know status of future months too.
        
        while curr < end or (curr.month == end.month and curr.year == end.year): # curr <= end logic carefully
             # Actually, simpler: loop while curr < something? 
             # Let's stick to standard curr <= end where end is inclusive of the last interesting month.
             # If I set last_payment_date to "Start of Next Month of Max Payment", then `curr < last_payment_date` is clean.
            
            if curr > end: break # Safety
            
            # Find payments for this specific month/year
            month_payments = [p for p in payments if p['month'] == curr.month and p['year'] == curr.year]
            paid_sum = sum(p['paid_amount'] for p in month_payments)
            
            is_fully_paid = paid_sum >= monthly_fee
            
            # Only calculate DUE if the month is in the past/present (active due)
            is_past_or_present = (curr.year < today.year) or (curr.year == today.year and curr.month <= today.month)
            
            if is_fully_paid:
                status = 'Paid'
                # Only update "Paid Up To" if this is a continuous sequence (optional, but requested)
                # Or just update it to the latest fully paid month? 
                # "Paid Up To" usually implies a sequence. If I skip Feb and pay March, am I paid up to March? No.
                # But simple logic: Update paid_up_to if curr > paid_up_to?
                # Let's keep it simple: "Paid Up To" = Latest fully paid month.
                # Or adhere to strict sequence? 
                # Let's stick to: "Paid Up To" updates if current month is paid. (Handling gaps is complex).
                paid_up_to = curr 
            elif paid_sum > 0:
                status = 'Partial'
            else:
                status = 'Unpaid'
            
            due_for_month = 0
            if is_past_or_present:
                 due_for_month = max(0, monthly_fee - paid_sum)
            
            ledger.append({
                "month": curr.month,
                "year": curr.year,
                "fee": monthly_fee,
                "paid": paid_sum,
                "due": due_for_month, # Will be 0 for future months, which is correct
                "status": status,
                "is_future": not is_past_or_present
            })
            
            total_due += due_for_month
            
            # Increment Month
            if curr.month == 12:
                curr = curr.replace(year=curr.year + 1, month=1)
            else:
                curr = curr.replace(month=curr.month + 1)
                
        return {
            "total_due": total_due,
            "paid_up_to": paid_up_to.strftime("%B %Y") if paid_up_to else "None",
            "ledger": ledger # Frontend can use this to disable dropdowns
        }

    def get_recent_payments(self, limit: int = 50):
        """
        Fetches the latest payments for the global transaction ledger.
        
        Algorithm:
        1. Select all columns (*) from payment.
        2. JOIN with enrollment table to get student and program details.
           - Syntax: enrollment(student(name, roll_no), program(program_name))
           - This is Supabase's powerful nested join syntax. It goes Payment -> Enrollment -> Student/Program.
        3. Order by date descending (newest first).
        4. Flatten the nested structure for easier use in the frontend.
        """
        # Step 1 & 2: Query with Joins
        response = supabase.table(self.table)\
            .select("*, enrollment(student(name), program(program_name))")\
            .order("payment_date", desc=True)\
            .limit(limit)\
            .execute()
            
        result = []
        # Step 4: Transform/Flatten Data
        # The raw data looks like: { "paid_amount": 500, "enrollment": { "student": { "name": "John" } } }
        # We want: { "paid_amount": 500, "student_name": "John" }
        for r in response.data:
            enroll = r.get('enrollment') or {}
            student = enroll.get('student') or {}
            program = enroll.get('program') or {}
            
            result.append({
                **r,
                "student_name": student.get("name"),
                # "roll_no": student.get("roll_no"), # Removed as it's not in student table anymore
                "program_name": program.get("program_name")
            })
        return result

    def get_student_payments(self, student_id: int):
        """
        Fetches payment history for a specific student.
        
        Algorithm:
        1. Find all `enrollment_ids` belonging to this student.
        2. Create a map of ID -> Program Name so we can label payments later.
        3. Query the `payment` table for ALL payments that match ANY of these enrollment IDs (using '.in_').
        4. Attach the program name to each payment record.
        """
        # Step 1: Get Enrollments
        enrollments = supabase.table(self.enrollment_table)\
            .select("enrollment_id, program(program_name)")\
            .eq("student_id", student_id)\
            .execute().data
            
        if not enrollments:
            return []
            
        # Extract IDs list: [1, 5, 8]
        enrollment_ids = [e['enrollment_id'] for e in enrollments]
        # Create Helper Map: {1: "English", 5: "Math"}
        program_map = {e['enrollment_id']: e['program']['program_name'] for e in enrollments if e.get('program')}
        
        # Step 3: Fetch Payments for these enrollments
        response = supabase.table(self.table)\
            .select("*")\
            .in_("enrollment_id", enrollment_ids)\
            .order("payment_date", desc=True)\
            .execute()
            
        result = []
        for r in response.data:
            # Step 4: Attach Program Name
            result.append({
                **r,
                "program_name": program_map.get(r['enrollment_id'], "Unknown Program")
            })
        return result

    def get_finance_stats(self):
        """
        Calculates financial dashboards stats: Total Revenue and Total Due.
        This is the most complex function logic-wise.
        
        Algorithm:
        1. Fetch ALL payments (lightweight query, just amounts and dates).
        2. Fetch ALL active enrollments (to know who SHOULD be paying).
        3. Calculate Revenue:
           - Sum of checks/cash collected. Simple addition.
        4. Calculate Due (The tricky part):
           - Can't just check if (Fee * Months) > Paid, because one student might have overpaid 
             and another underpaid. We can't let Student A's surplus hide Student B's debt.
           - We must iterate STUDENT BY STUDENT.
           - For each student:
             a. Calculate expected fee (Months since joining * Monthly Fee).
             b. Sum their total payments.
             c. If Expected > Paid, the difference is their DUE.
             d. If Paid > Expected, their Due is 0 (they are in advance).
           - Sum up all the individual "Dues" to get the Total Arrears.
        5. Calculate 'Due This Month':
           - The amount specifically expected for the current calendar month that hasn't been paid precisely for this month.
        """
        # Step 1: Fetch Raw Payment Data
        # We need 'month' and 'year' to check specific monthly dues
        all_payments = supabase.table(self.table).select("enrollment_id, paid_amount, payment_date, month, year").execute().data
        
        # Step 2: Fetch Active Enrollments
        # We only care about 'Active' students for calculating current dues.
        enrollments = supabase.table(self.enrollment_table)\
            .select("enrollment_id, enrollment_date, program(monthly_fee)")\
            .execute().data

        # --- REVENUE CALCULATION ---
        # Total Cash in hand (All time)
        total_revenue = sum(p['paid_amount'] for p in all_payments)
        
        today = date.today()
        # Revenue This Month: Sum of payments made in the current calendar month (by payment_date)
        revenue_this_month = sum(p['paid_amount'] for p in all_payments if p['payment_date'].startswith(f"{today.year}-{today.month:02d}"))

        # --- DUE CALCULATION ---
        total_due_overall = 0
        total_due_this_month = 0
        
        # Optimization: Group payments by enrollment_id dictionary for O(1) lookup inside the loop
        # Format: { 101: [PaymentA, PaymentB], 102: [PaymentC] }
        payments_by_enrollment = {}
        for p in all_payments:
            eid = p['enrollment_id']
            if eid not in payments_by_enrollment:
                payments_by_enrollment[eid] = []
            payments_by_enrollment[eid].append(p)

        # Iterate through every single student (enrollment)
        for env in enrollments:
            prog = env.get('program')
            if not prog or not env['enrollment_date']: continue
            
            fee = float(prog['monthly_fee'] or 0)
            if fee == 0: continue
            
            # Get this specific student's payment history
            student_payments = payments_by_enrollment.get(env['enrollment_id'], [])
            
            # A. Calculate Total Arrears (Lifetime Due)
            # How many months have they been here?
            start = datetime.strptime(env['enrollment_date'], "%Y-%m-%d").date()
            months_passed = (today.year - start.year) * 12 + (today.month - start.month) + 1
            months_passed = max(0, months_passed)
            
            expected_lifetime = months_passed * fee
            paid_lifetime = sum(p['paid_amount'] for p in student_payments)
            
            # IMPORTANT: max(0, ...) ensures we don't count negative due (advance payment)
            student_due_total = max(0, expected_lifetime - paid_lifetime)
            
            # Add to the global accumulator
            total_due_overall += student_due_total
            
            # B. Calculate Due This Specific Month
            # Logic: Fee - (Sum of payments tagged specifically for THIS month/year)
            if start <= today:
                fee_this_month = fee
                # Filter payments that have month=CurrentMonth AND year=CurrentYear
                paid_for_this_month = sum(p['paid_amount'] for p in student_payments if p.get('month') == today.month and p.get('year') == today.year)
                
                student_due_this_month = max(0, fee_this_month - paid_for_this_month)
                total_due_this_month += student_due_this_month
        
        return {
            "total_revenue": total_revenue,
            "revenue_this_month": revenue_this_month,
            "due_total": total_due_overall,
            "due_this_month": total_due_this_month
        }

    def get_program_finance_stats(self):
        """
        Aggregates financial data by Program (e.g. "Physics Batch A" has collected X amount).
        Used for reports.
        """
        # Return list of programs with their financial breakdown
        programs = supabase.table("program").select("program_id, program_name, monthly_fee, batch(batch_name)").execute().data
        enrollments = supabase.table(self.enrollment_table).select("enrollment_id, program_id").execute().data
        all_payments = supabase.table(self.table).select("enrollment_id, paid_amount, payment_date").execute().data
        
        stats = []
        today = date.today()
        
        for prog in programs:
            pid = prog['program_id']
            # Find all students enrolled in this program
            prog_enrollments = [e['enrollment_id'] for e in enrollments if e['program_id'] == pid]
            
            # Find all payments linked to these enrollments
            prog_payments = [p for p in all_payments if p['enrollment_id'] in prog_enrollments]
            
            revenue_overall = sum(p['paid_amount'] for p in prog_payments)
            revenue_this_month = sum(p['paid_amount'] for p in prog_payments if p['payment_date'].startswith(f"{today.year}-{today.month:02d}"))
            
            stats.append({
                "program_id": pid,
                "program_name": f"{prog['program_name']} ({prog.get('batch', {}).get('batch_name')})",
                "total_revenue": revenue_overall,
                "revenue_this_month": revenue_this_month,
                "active_students": len(prog_enrollments)
            })
            
        return stats
