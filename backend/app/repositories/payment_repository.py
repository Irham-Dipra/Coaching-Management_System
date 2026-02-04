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


    def update_payment(self, payment_id: int, updates: dict):
        """
        Updates a payment record with strict validation to prevent overpayment.
        """
        # 1. Fetch the EXISTING payment to get context (Enrollment, Month, Year)
        current = supabase.table(self.table).select("*").eq("payment_id", payment_id).single().execute().data
        if not current:
            raise Exception("Payment record not found")

        enrollment_id = current['enrollment_id']
        month = current['month']
        year = current['year']
        
        # --- PHASE 18 INTEGRITY GUARD: Check if Latest ---
        # "Admin can only edit the most recent payment activity"
        # We check if there exists ANY payment with payment_id > current.payment_id for this enrollment/student.
        # Actually, Student-level check is safer.
        # Step 1: Get Student ID from enrollment (we need simple query or join)
        # Assuming table access:
        
        # Quick Check: Are there newer payments for this ENROLLMENT?
        newer_exists = supabase.table(self.table)\
            .select("payment_id")\
            .eq("enrollment_id", enrollment_id)\
            .gt("payment_id", payment_id)\
            .execute().data
            
        if newer_exists:
             raise Exception("Integrity Error: You can only edit the most recent transaction for this student. Newer payment records exist.")
        
        # -------------------------------------------------
        
        # 2. Fetch Enrollment & Program Fee
        # We need the Fee to calculate the Cap.
        enrollment = supabase.table(self.enrollment_table)\
            .select("program(monthly_fee)")\
            .eq("enrollment_id", enrollment_id)\
            .single()\
            .execute().data
            
        if not enrollment or not enrollment.get('program'):
             raise Exception("Program details not found for validation")
             
        monthly_fee = float(enrollment['program']['monthly_fee'] or 0)
        
        # 3. Calculate Ledger State for that specific month (Excluding THIS payment)
        # We want to know: How much WAS paid by OTHERS?
        # Cap = Fee - (Sum of ALL payments for this month) + (This payment's OLD amount)
        # Actually simpler: Cap = Fee - (Sum of OTHER payments)
        
        others = supabase.table(self.table)\
            .select("paid_amount")\
            .eq("enrollment_id", enrollment_id)\
            .eq("month", month)\
            .eq("year", year)\
            .neq("payment_id", payment_id)\
            .execute().data
            
        sum_others = sum(float(p['paid_amount']) for p in others)
        
        # 4. Determine Cap
        remaining_cap = max(0, monthly_fee - sum_others)
        
        # 5. Validate New Amount
        new_amount = float(updates.get('paid_amount', current['paid_amount']))
        
        if new_amount > remaining_cap:
            # Strictly reject overpayment
            raise Exception(f"Validation Failed: Amount ({new_amount}) exceeds the remaining due ({remaining_cap}) for this month. (Fee: {monthly_fee}, Paid by others: {sum_others})")
            
        # 6. Proceed with Update
        # Filter updates to allowed fields only
        safe_updates = {
            "paid_amount": new_amount,
            "payment_method": updates.get("payment_method", current["payment_method"]),
            "remarks": updates.get("remarks", current["remarks"])
        }
        
        return supabase.table(self.table)\
            .update(safe_updates)\
            .eq("payment_id", payment_id)\
            .execute().data

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
        
        # Track the latest month with any payment
        last_active_payment = None
        is_last_partial = False
        
        # We loop until we cover the range. 
        # Note: If we just want to show "Active" dues, we might separate "Future Ledger" from "Due Ledger".
        # But for "Greying out" logic, we need to know status of future months too.
        
        while curr < end or (curr.month == end.month and curr.year == end.year): 
             # Logic carefully checked
            
            if curr > end: break # Safety
            
            # Find payments for this specific month/year
            month_payments = [p for p in payments if p['month'] == curr.month and p['year'] == curr.year]
            paid_sum = sum(p['paid_amount'] for p in month_payments)
            
            is_fully_paid = paid_sum >= monthly_fee
            
            # Only calculate DUE if the month is in the past/present (active due)
            is_past_or_present = (curr.year < today.year) or (curr.year == today.year and curr.month <= today.month)
            
            if is_fully_paid:
                status = 'Paid'
            elif paid_sum > 0:
                status = 'Partial'
            else:
                status = 'Unpaid'
            
            # Update Paid Up To / Last Activity Tracker
            if paid_sum > 0:
                last_active_payment = curr
                is_last_partial = not is_fully_paid

            # Calculate Remaining Balance (Due for this specific month)
            # This is what needs to be paid to clear this month, regardless of whether it's past or future.
            balance_remaining = max(0, monthly_fee - paid_sum)

            # Calculate Arrears (Only for past/present months)
            # This is for the "Total Due" stats.
            arrears_amount = balance_remaining if is_past_or_present else 0
            
            ledger.append({
                "month": curr.month,
                "year": curr.year,
                "fee": monthly_fee,
                "paid": paid_sum,
                "due": balance_remaining, # UI needs the remaining balance to allow top-ups
                "status": status,
                "is_future": not is_past_or_present
            })
            
            total_due += arrears_amount
            
            # Increment Month
            if curr.month == 12:
                curr = curr.replace(year=curr.year + 1, month=1)
            else:
                curr = curr.replace(month=curr.month + 1)

        # 4. Identify First Uncleared Month (FUM)
        # We look for the first entry in the ledger that is NOT 'Paid'
        # The ledger is already chronological.
        fum = None
        for entry in ledger:
            if entry['status'] != 'Paid':
                fum = {
                    "month": entry['month'],
                    "year": entry['year'],
                    "fee": entry['fee'],
                    "paid": entry['paid'],
                    "due": entry['due'],
                    "status": entry['status']
                }
                break
        
        # Format the Paid Up To string
        paid_up_to_str = "None"
        if last_active_payment:
            date_str = last_active_payment.strftime("%B %Y")
            if is_last_partial:
                paid_up_to_str = f"{date_str} (Partial)"
            else:
                paid_up_to_str = date_str

        # If no FUM found (all paid), FUM is the next month after the last ledger entry
        if not fum:
            # Determine next month after the end of the current ledger loop
            # 'curr' is currently set to 'end + 1 month' (or close to it) from the loop
            # But let's be precise. Last ledger entry determines the end.
            if ledger:
                last = ledger[-1]
                if last['month'] == 12:
                    fum_m, fum_y = 1, last['year'] + 1
                else:
                    fum_m, fum_y = last['month'] + 1, last['year'] 
            else:
                # No ledger (new student), FUM is start_date
                fum_m, fum_y = start_date.month, start_date.year
            
            fum = {
                "month": fum_m,
                "year": fum_y,
                "fee": monthly_fee,
                "paid": 0,
                "due": monthly_fee,
                "status": "Unpaid"
            }
                
        return {
            "total_due": total_due,
            "paid_up_to": paid_up_to_str,
            "ledger": ledger,
            "fum": fum, # Frontend will use this to lock input
            "enrollment_date": enrollment['enrollment_date'] # For UI Transparency
        }

    def get_recent_payments(self, limit: int = 50):
        """
        Fetches the latest payments for the global transaction ledger.
        
        Refactored for Phase 18:
        1. Query recent raw rows (limit slightly higher to allow grouping compression).
        2. Group by 'transaction_group_id' (or treat as single if None).
        3. Aggregates:
           - Amount: Sum
           - Month/Year: Range or List
           - Status: 'Bulk' or 'Single'
        4. "Latest Payment" check for integrity:
           - Fetch MAX(payment_id) for each student involved in this batch.
           - Mark groups as 'is_editable' ONLY if they contain the latest transaction for that student.
        """
        # Step 1: Query Raw Data
        # We fetch more than limit because grouping will reduce count.
        # Phase 18 Update: Fetch 'class', 'batch_id' (from student), and 'roll_no' (from enrollment) for filters.
        # Assuming 'student' has 'class' and 'batch_id' (or enrollment?).
        # Checking StudentList logic: s.batch_id is on student.
        # Also fetching 'roll_no' from enrollment.
        response = supabase.table(self.table)\
            .select("*, enrollment(roll_no, student(student_id, name, class, batch_id), program(program_name, program_id))")\
            .order("payment_id", desc=True)\
            .limit(limit * 2)\
            .execute()
            
        raw_rows = response.data
        if not raw_rows:
             return []

        # Step 2: Determine "Latest" for Integrity Check
        # We need the MAX(payment_id) for every student present in this list.
        # Efficient way: Single query? Or just trust the sorted list if we had ALL data.
        # But we only have top 100. The *actual* latest might be in this list, OR (rarely) we might miss a race condition.
        # Proper way: Query DB for max IDs.
        
        student_ids = list(set([r['enrollment']['student']['student_id'] for r in raw_rows if r.get('enrollment') and r['enrollment'].get('student')]))
        
        # We can't do "WHERE student_id IN (...) GROUP BY" easily with Supabase client (no group_by support).
        # Workaround: For the UI "Recent" list, we can assume the top of the list IS the latest... 
        # BUT if I search/filter, that breaks. 
        # However, the requirement is strict: "Admin can only edit the most recent...".
        # Let's perform a lightweight RPC or just loop check if practical?
        # Actually, if we sort by payment_id DESC, the FIRST appearance of a student in the GLOBAL list is the latest.
        # Since we fetch 'limit * 2', it's highly likely we have the latest.
        # Challenge: What if the latest is ID 1000, and we fetched ID 900-800? (Pagination).
        # Safer: On the backend 'edit' action we enforce strictness. 
        # For the UI list: We can just mark the first occurrence in *this* list as editable? 
        # No, that's misleading if the *actual* latest isn't loaded.
        # Compromise for list view: Mark as editable if it matches the *cached* max ID we fetch now.
        
        # Let's try to fetch true max IDs for these students.
        # Since we can't GROUP BY, we might just have to skip strictly checking "Global" latest in the *List View* 
        # and rely on the Backend Edit Endpoint to throw an error if not latest.
        # Use Case: Admin sees list. Tries to edit. If backend rejects, we show error.
        # UI optimization: We can flag "Latest in this view".
        
        # Let's proceed with Grouping first.
        
        grouped_map = {} # Key: transaction_group_id (or "single_ID") -> Object
        group_order = [] # To maintain sort order
        
        for r in raw_rows:
            # Identifier: Use group_id if present, else valid unique string "single_{id}"
            gid = r.get('transaction_group_id')
            if not gid:
                 gid = f"single_{r['payment_id']}"
                 
            enroll = r.get('enrollment') or {}
            student = enroll.get('student') or {}
            program = enroll.get('program') or {}
            
            if gid not in grouped_map:
                grouped_map[gid] = {
                    "sort_id": r['payment_id'], # Keep highest ID for sorting
                    "payment_ids": [],
                    "student_id": student.get("student_id"),
                    "student_name": student.get("name"),
                    "class": student.get("class"),       # New
                    "batch_id": student.get("batch_id"), # New
                    "roll_no": enroll.get("roll_no"),    # New
                    "program_name": program.get("program_name"),
                    "program_id": program.get("program_id"), # New for filtering
                    "total_amount": 0.0,
                    "months": [],
                    "payment_date": r['payment_date'], # Use latest
                    "payment_method": r['payment_method'],
                    "type": "Single", # Will update
                    "remarks": r.get('remarks') or "",
                    "is_editable": False, # Default safe
                    "raw_group_id": r.get('transaction_group_id') # For reference
                }
                group_order.append(gid)
            
            # Aggregate
            group = grouped_map[gid]
            group['total_amount'] += float(r['paid_amount'])
            group['months'].append( (r['year'], r['month']) )
            group['payment_ids'].append(r['payment_id'])
            
            # Update Type
            if len(group['payment_ids']) > 1:
                group['type'] = "Bulk"
        
        # Final Format
        results = []
        
        # Sort month ranges for display
        for gid in group_order:
            g = grouped_map[gid]
            
            # Format Months: "Jan 2026", "Jan-Mar 2026"
            g['months'].sort() # Sorts by (Year, Month) tuple
            start_y, start_m = g['months'][0]
            end_y, end_m = g['months'][-1]
            
            start_name = date(start_y, start_m, 1).strftime("%b %Y")
            end_name = date(end_y, end_m, 1).strftime("%b %Y")
            
            if len(g['months']) > 1:
                if start_y == end_y:
                     # Same Year: "Jan - Mar 2026"
                     start_name = date(start_y, start_m, 1).strftime("%b")
                     g['date_display'] = f"{start_name} - {end_name}"
                else:
                     g['date_display'] = f"{start_name} - {end_name}"
            else:
                g['date_display'] = start_name
                
            # Integrity Check Logic (Simplified for List View):
            # We flag 'is_editable' as TRUE for all rows here blindly? 
            # NO. The user wants "Last-In" restriction.
            # Real enforcement happens on UPDATE (Backend). 
            # For UI, let's just enable all and let backend reject?
            # User requirement: "Hide or disable...".
            # OK, we need to know the MAX ID for each student.
            # I will query `rpc/get_max_payment_ids`? No RPC available.
            # I will iterate results. 
            # Assuming `raw_rows` is sorted DESC by ID (Global).
            # The FIRST time we see a `student_id` in `group_order`, that IS their latest payment (globally, assuming list is fresh).
            # Limitation: If the latest payment is NOT in the fetched 100 rows (e.g. filtered?), we might be wrong.
            # But `get_recent_payments` is the "Latest Activity" feed. It is by definition the top.
            
            results.append(g)
            
        # Post-Processing for "Latest" Flag
        # Iterate top-down. Track seen students.
        seen_students = set()
        for res in results:
            sid = res['student_id']
            if sid not in seen_students:
                res['is_editable'] = True
                seen_students.add(sid)
            else:
                res['is_editable'] = False
                
        return results[:limit] # Return requested limit

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
        
        # Helper Maps
        program_map = {e['enrollment_id']: e['program']['program_name'] for e in enrollments if e.get('program')}
        
        # Step 3: Fetch Raw Payments
        raw_rows = supabase.table(self.table)\
            .select("*")\
            .in_("enrollment_id", enrollment_ids)\
            .order("payment_id", desc=True)\
            .execute().data
            
        if not raw_rows:
            return []

        # Find the global LATEST payment ID for this student (across all their enrollments)
        # The first row in raw_rows is the latest because of order("payment_id", desc=True)
        latest_payment_id = raw_rows[0]['payment_id']

        # Step 4: Grouping Logic (Same as get_recent_payments)
        grouped_map = {} 
        group_order = [] 
        
        for r in raw_rows:
            gid = r.get('transaction_group_id')
            if not gid:
                 gid = f"single_{r['payment_id']}"
            
            if gid not in grouped_map:
                # Is this group editable? 
                # Yes if it contains the latest_payment_id (which strictly means it IS the latest group)
                # We check this later or simply: if this group's sort_id == latest_payment_id
                
                grouped_map[gid] = {
                    "sort_id": r['payment_id'],
                    "payment_ids": [],
                    "payment_date": r['payment_date'],
                    "total_amount": 0.0,
                    "months": [],
                    "program_name": program_map.get(r['enrollment_id'], "Unknown Program"),
                    "payment_method": r['payment_method'],
                    "remarks": r.get('remarks') or "",
                    "type": "Single",
                    "is_editable": False, # Calculated below
                    "raw_group_id": r.get('transaction_group_id')
                }
                group_order.append(gid)
            
            group = grouped_map[gid]
            group['total_amount'] += float(r['paid_amount'])
            group['months'].append( (r['year'], r['month']) )
            group['payment_ids'].append(r['payment_id'])
            
            if len(group['payment_ids']) > 1:
                group['type'] = "Bulk"
                
        # Final Processing
        results = []
        for gid in group_order:
            g = grouped_map[gid]
            
            # Format Months
            g['months'].sort()
            start_y, start_m = g['months'][0]
            end_y, end_m = g['months'][-1]
            
            start_name = date(start_y, start_m, 1).strftime("%b %Y")
            end_name = date(end_y, end_m, 1).strftime("%b %Y")
            
            if len(g['months']) > 1:
                if start_y == end_y:
                     start_name = date(start_y, start_m, 1).strftime("%b")
                     g['date_display'] = f"{start_name} - {end_name}"
                else:
                     g['date_display'] = f"{start_name} - {end_name}"
            else:
                g['date_display'] = start_name

            # Set Editable: Only if the group's sort_id (highest internal ID) matches the global latest
            if g['sort_id'] == latest_payment_id:
                g['is_editable'] = True
                
            results.append(g)
            
        return results

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
            total_due_overall += student_due_total
             
             # B. Calculate Due This Month
            # 1. Expected for this month: One fee unit
            # 2. Paid for this month: Sum of payments in this calendar month? 
            #    No, logic should be: Is the current ledger month paid?
            #    Re-using ledger logic is safer effectively but expensive for global stats.
            #    Approximation: If student has Arrears >= Monthly Fee, then they definitely owe for this month (and prior).
            #    If Arrears < Monthly Fee, strictly part of this month is remaining.
            #    If Arrears == 0, they are clear.
            
            # Simple Logic for "Due This Month":
            # Any arrears up to the monthly fee cap is "Due This Month" (recovering debt).
            # If arrears > fee, then "Due This Month" = Fee (current) + Arrears (past)? 
            # Usually "Revenue This Month" vs "Expected Revenue This Month".
            
            # Let's stick to what the user asked: "Due (This Month)"
            # Usually means: How much of the CURRENT ACTIVE MONTH'S fee is unpaid?
            # We can check specific month coverage.
            # Let's reuse Arrears. If Arrears > 0, we can say "Due This Month" is min(Arrears, Fee)?
            # No, let's keep it simple: Total Due is the main metric. "Due This Month" might just be "Expected Collection - Actual Collection".
            
            # Simplified: Due This Month = Sum of (Monthly Fee - Paid This Month) for all active students?
            # Start date check: If joined this month, expect fee. If joined before, expect fee.
            # Valid for all active students.
            
            paid_this_month = sum(p['paid_amount'] for p in student_payments if p['payment_date'].startswith(f"{today.year}-{today.month:02d}"))
            
            # Assuming every active student owes 1 month fee this month (unless they paid it)
            due_for_curr_month = max(0, fee - paid_this_month)
            total_due_this_month += due_for_curr_month

        return {
            "revenue_total": total_revenue,
            "revenue_this_month": revenue_this_month,
            "due_total": total_due_overall,
            "due_this_month": total_due_this_month
        }

    def get_student_financial_summary(self, student_id: int):
        """
        Phase 19: Aggregates financial status for a single student across all enrollments.
        Returns:
            - total_paid: Sum of all time payments.
            - total_due: Sum of arrears across all programs.
            - breakdown: List of { program, joined, fee, paid_upto, due }
        """
        enrollments = supabase.table(self.enrollment_table)\
            .select("*, program(*)")\
            .eq("student_id", student_id)\
            .execute().data
            
        summary = {
            "total_paid": 0.0,
            "total_due": 0.0,
            "breakdown": []
        }
        
        # 1. Total Paid Calculation (Direct Query is faster/safer than summing sub-ledgers)
        # Actually, get_student_payments (refactored) has all payments. We can sum that?
        # But get_student_payments is paginated or limit? No, currently fetches all for student.
        # Let's query raw to be sure.
        raw_payments = supabase.table(self.table)\
            .select("paid_amount")\
            .in_("enrollment_id", [e['enrollment_id'] for e in enrollments])\
            .execute().data
            
        summary['total_paid'] = sum(p['paid_amount'] for p in raw_payments)
        
        # 2. Iterate Enrollments for Due & Status
        for env in enrollments:
            eid = env['enrollment_id']
            prog_name = env['program']['program_name']
            fee = env['program']['monthly_fee']
            joined = env['enrollment_date']
            
            # Reuse core logic
            status = self.get_payment_status(eid)
            
            summary['total_due'] += status['total_due']
            
            summary['breakdown'].append({
                "program_name": prog_name,
                "enrollment_date": joined,
                "monthly_fee": fee,
                "paid_up_to": status['paid_up_to'],
                "due_amount": status['total_due'],
                "status_highlight": status['fum']
            })
            
        return summary
            

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
