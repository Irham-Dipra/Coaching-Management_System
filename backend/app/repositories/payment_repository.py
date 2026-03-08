from app.core.supabase import supabase
from app.core.stats_cache import (
    get_cached_quick, set_cached_quick,
    get_cached_dues, set_cached_dues,
    invalidate_stats_cache
)
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
        # Generate one ID for the whole batch -> NO, user wants unique per student.
        # Logic: Iterate and assign unique ID per record (or per student if multiple records exist per student)
        # Assuming data_list is [StudentA_Jan, StudentB_Jan, StudentC_Jan], each needs unique ID.
        
        # Prepare batch payload
        batch_payload = []
        
        print(f"Processing Bulk Payment of {len(data_list)} months...")
        
        failed_payments = []
        successful_students = []
        
        # Prepare a lookup set for (student_id, month, year) to check if we are paying the due now
        paying_set = set()
        for d in data_list:
            paying_set.add((d['student_id'], int(d['month']), int(d['year'])))

        # Group ID Cache per student to ensure all months for ONE student get SAME Transaction ID
        student_group_map = {}

        for data in data_list:
            sid = data['student_id']
            if sid not in student_group_map:
                student_group_map[sid] = str(uuid.uuid4())
            
            group_id = student_group_map[sid]
            
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

            
            # --- VALIDATION: Check for Prior Dues ---
            # We must ensure the student has cleared all previous months before paying for this one.
            # Get current status (ledger)
            status = self.get_payment_status(eid)
            
            # Check if there is any 'Unpaid' or 'Partial' month BEFORE the target month
            # Target: data['month'], data['year']
            target_date = date(int(data['year']), int(data['month']), 1)
            
            has_prior_dues = False
            prior_due_month = None
            
            if status and status.get('ledger'):
                for entry in status['ledger']:
                    entry_date = date(entry['year'], entry['month'], 1)
                    
                    # If this ledger month is BEFORE our target month
                    if entry_date < target_date:
                        # And it is NOT fully paid
                        if entry['status'] != 'Paid':
                            # CHECK: Are we paying this 'entry' in the current batch?
                            if (data['student_id'], entry['month'], entry['year']) in paying_set:
                                # We are paying it now, so it's fine. Continue checking other months.
                                continue
                                
                            has_prior_dues = True
                            prior_due_month = f"{date(entry['year'], entry['month'], 1).strftime('%b %Y')}"
                            break
            
            if has_prior_dues:
                # SKIP THIS PAYMENT
                failed_payments.append({
                    "student_name": f"Student {data['student_id']}", # Ideally fetch name, but ID is fast
                    "reason": f"Has uncleared dues for {prior_due_month}"
                })
                print(f"Skipping Payment for Student {data['student_id']}: Prior due in {prior_due_month}")
                continue

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
            successful_students.append(data['student_id'])
            
        inserted_data = []
        if batch_payload:
            try:
                # Atomic Batch Insert
                print(f"Executing Batch Insert for Group {group_id}")
                response = supabase.table(self.table).insert(batch_payload).execute()
                inserted_data = response.data
                invalidate_stats_cache()  # Revenue + dues changed
            except Exception as e:
                print(f"Bulk Insert Failed: {e}")
                raise e
                
        return {
            "success": len(batch_payload),
            "failed": failed_payments,
            "successful_student_ids": successful_students,
            "data": inserted_data
        }


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
        
        # 2. Fetch Fee History for this month/year
        # We need the atomic Fee to calculate the Cap for this specific month.
        history_res = supabase.table("enrollment_fee_history")\
            .select("fee_amount, effective_month, effective_year")\
            .eq("enrollment_id", enrollment_id)\
            .execute().data
            
        if not history_res:
             raise Exception("Fee history not found for validation")
             
        # Sort history chronologically
        history_res.sort(key=lambda x: (x['effective_year'], x['effective_month']))
        
        # Find the active fee for the payment's month/year
        monthly_fee = 0
        for h in history_res:
             if h['effective_year'] < year or (h['effective_year'] == year and h['effective_month'] <= month):
                  monthly_fee = float(h['fee_amount'])
             else:
                  break
        
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
        
        result = supabase.table(self.table)\
            .update(safe_updates)\
            .eq("payment_id", payment_id)\
            .execute().data
        invalidate_stats_cache()  # Payment amount changed — revenue affected
        return result

    def delete_payment(self, payment_id: int):
        """
        Deletes a payment record.
        Strictly enforces that ONLY the most recent payment for an enrollment can be deleted
        to maintain ledger integrity.
        """
        # 1. Fetch the payment to identify enrollment
        current = supabase.table(self.table).select("enrollment_id").eq("payment_id", payment_id).single().execute().data
        if not current:
            raise Exception("Payment record not found")
            
        enrollment_id = current['enrollment_id']
        
        # 2. Integrity Check: Ensure no newer payments exist for this enrollment
        newer_exists = supabase.table(self.table)\
            .select("payment_id")\
            .eq("enrollment_id", enrollment_id)\
            .gt("payment_id", payment_id)\
            .execute().data
            
        if newer_exists:
            raise Exception("Integrity Error: You can only delete the most recent transaction for this student to maintain ledger consistency.")

        # 3. Delete
        result = supabase.table(self.table).delete().eq("payment_id", payment_id).execute().data
        invalidate_stats_cache()  # Revenue + dues changed
        return result

    def get_payment_status(self, enrollment_id: int):
        """
        Calculates the current financial standing for a specific enrollment.
        Used by the Frontend to determining which months are paid/unpaid.
        """
        # 1. Get Enrollment Details & Fee History
        enrollment = supabase.table(self.enrollment_table)\
            .select("enrollment_date, program(end_date)")\
            .eq("enrollment_id", enrollment_id)\
            .single()\
            .execute().data
            
        if not enrollment:
            return None
            
        start_date = datetime.strptime(enrollment['enrollment_date'], "%Y-%m-%d").date()
        
        # Pre-fetch fee history to avoid N+1 queries in the loop
        history_res = supabase.table("enrollment_fee_history")\
            .select("fee_amount, effective_month, effective_year")\
            .eq("enrollment_id", enrollment_id)\
            .execute().data
            
        history_res.sort(key=lambda x: (x['effective_year'], x['effective_month']))
        
        def get_fee_for_month(y, m):
            fee = 0
            for h in history_res:
                if h['effective_year'] < y or (h['effective_year'] == y and h['effective_month'] <= m):
                    fee = float(h['fee_amount'])
                else:
                    break
            return fee
        
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
        calc_end_date = max(today.replace(day=1), last_payment_date)
        
        # FIX: Check if program has an End Date (Soft Deleted or Completed)
        # If the program ended, we should NOT calculate dues beyond that date.
        program_end_str = enrollment.get('program', {}).get('end_date')
        if program_end_str:
            program_end = datetime.strptime(program_end_str, "%Y-%m-%d").date().replace(day=1)
            # If the calculated end date goes beyond the program end, cap it.
            # However, if the student PAID beyond the program end (advance), we should still show it (ledger logic).
            # But the 'Due' logic loop will stop at 'end'.
            # So, we set 'end' to min(calc_end_date, program_end) UNLESS they paid more?
            # Actually, simply capping the 'Due Generation' loop is enough.
            # If they paid beyond, they paid.
            
            # Logic: We only generate ledger rows up to the program end OR the last payment (whichever is later).
            # AND we definitely do not generate NEW dues after program_end.
            
            effective_end = program_end
            
            # If they paid past the end date, we must extend to show that payment
            if last_payment_date > effective_end:
                effective_end = last_payment_date
                
            # If 'today' is past the end date, we should NOT extend to today.
            # So:
            # Base end is max(today, last_payment) --> this assumes active.
            # With limit:
            # If today > program_end: end at MAX(program_end, last_payment)
            # If today <= program_end: end at MAX(today, last_payment)
            
            if today > program_end:
                calc_end_date = max(program_end, last_payment_date)
        
        end = calc_end_date
        
        # Track the latest month with any payment
        last_active_payment = None
        is_last_partial = False
        
        # We loop until we cover the range. 
        # Note: If we just want to show "Active" dues, we might separate "Future Ledger" from "Due Ledger".
        # But for "Greying out" logic, we need to know status of future months too.
        
        while curr < end or (curr.month == end.month and curr.year == end.year): 
             # Logic carefully checked
            
            if curr > end: break # Safety
            
            # Resolve the atomic fee for this specific month/year
            monthly_fee = get_fee_for_month(curr.year, curr.month)
            
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

            # Calculate Arrears (For past months OR future months that are partially paid)
            # If a student starts paying for a future month, the remainder is considered 'Due' in this context.
            # FIX: User requested that future partial payments should NOT count as Due.
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
            
            # Get fee for the dynamic FUM month
            target_fee = get_fee_for_month(fum_y, fum_m)
            
            fum = {
                "month": fum_m,
                "year": fum_y,
                "fee": target_fee,
                "paid": 0,
                "due": target_fee,
                "status": "Unpaid"
            }
                
        return {
            "total_due": total_due,
            "paid_up_to": paid_up_to_str,
            "ledger": ledger,
            "fum": fum, # Frontend will use this to lock input
            "enrollment_date": enrollment['enrollment_date'] # For UI Transparency
        }

    def get_payments_paginated(self, page: int = 1, page_size: int = 50, search: str = None, filters: dict = None):
        """
        Fetches payments with server-side pagination, search, and filtering.
        CORRECTED LOGIC:
        1. Fetch ALL (id, group_id) pairs matching filters.
        2. Group them in Python to determine REAL transaction count.
        3. Slice the groups for pagination.
        4. Fetch details only for the payments in the current page.
        """
        # --- Step 1: Fetch Search/Filter Hits (IDs only) ---
        # Detect whether any filters require joining enrollment/student/program tables.
        # month, year, start_date, end_date are flat payment columns — no join needed.
        needs_join = bool(search) or bool(
            filters and (
                filters.get('program_id') or
                filters.get('roll_no') or
                filters.get('class') or
                filters.get('batch_id')
            )
        )

        if needs_join:
            # Full join required: filters touch enrollment/student columns
            select_clause = "payment_id, transaction_group_id, enrollment!inner(enrollment_id, roll_no, student!inner(name, class, batch_id), program(program_id))"
        else:
            # Slim select: enrollment_id is a flat FK column on the payment table — no join overhead
            select_clause = "payment_id, transaction_group_id, enrollment_id"

        query = supabase.table(self.table)\
            .select(select_clause)\
            .order("payment_id", desc=True)

        # Apply Search
        if search:
            if search.isdigit():
                query = query.eq("payment_id", int(search))
            else:
                query = query.ilike("enrollment.student.name", f"%{search}%")

        # Apply Filters
        if filters:
            if filters.get('month'):
                query = query.eq("month", int(filters['month']))
            if filters.get('year'):
                query = query.eq("year", int(filters['year']))
            if filters.get('program_id'):
                query = query.eq("enrollment.program_id", int(filters['program_id']))
            if filters.get('roll_no'):
                query = query.ilike("enrollment.roll_no", f"%{filters['roll_no']}%")
            if filters.get('class'):
                query = query.eq("enrollment.student.class", int(filters['class']))
            if filters.get('batch_id'):
                query = query.eq("enrollment.student.batch_id", int(filters['batch_id']))
            # Date Range Filters (flat payment columns — work with both selects)
            if filters.get('start_date'):
                query = query.gte("payment_date", filters['start_date'])
            if filters.get('end_date'):
                query = query.lte("payment_date", filters['end_date'])

        # Execute (Fetch ALL simplified rows)
        try:
            # We request a large range to simulate "Fetch All".
            response = query.range(0, 99999).execute()
            all_hits = response.data
        except Exception as e:
            print(f"Pagination Query Failed: {e}")
            return { "data": [], "total_count": 0 }

        if not all_hits:
            return { "data": [], "total_count": 0 }

        # --- Step 2: Grouping (In-Memory) ---
        grouped_hits = {} # Map[gid -> { max_id, pids[] }]
        group_order = []  # List[gid] to maintain DESC sort order
        
        for r in all_hits:
            pid = r['payment_id']
            gid = r.get('transaction_group_id')
            
            if not gid:
                gid = f"single_{pid}"
                
            if gid not in grouped_hits:
                grouped_hits[gid] = {
                    "gid": gid,
                    "max_pid": pid,
                    "payment_ids": []
                }
                group_order.append(gid)
            
            grouped_hits[gid]['payment_ids'].append(pid)

        # Total "Transaction" Count
        total_count = len(group_order)
        
        # --- Step 3: Pagination Slice ---
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        paged_gids = group_order[start_idx:end_idx]
        
        if not paged_gids:
             return { "data": [], "total_count": total_count }
             
        # Collect target payment IDs
        target_payment_ids = []
        for gid in paged_gids:
            target_payment_ids.extend(grouped_hits[gid]['payment_ids'])
            
        # --- Step 4: Fetch Full Details ---
        details_response = supabase.table(self.table)\
            .select("*, enrollment!inner(enrollment_id, roll_no, student!inner(student_id, name, class, batch_id), program(program_name, program_id))")\
            .in_("payment_id", target_payment_ids)\
            .order("payment_id", desc=True)\
            .execute()
            
        raw_rows = details_response.data
        
        # --- Step 5: Resolve Latest Payment IDs for Editability (Batch Optimization) ---
        # 1. Collect all enrollment_ids from the *displayed* groups
        # Let's index all_hits by payment_id first for O(1) lookup
        # Note: This `all_hits_pid_map` contains only partial data (payment_id, transaction_group_id, enrollment_id, etc.)
        # It's used to quickly get enrollment_id from any payment_id in `all_hits`.
        all_hits_pid_map = { r['payment_id']: r for r in all_hits }
        
        # Collect distinct enrollment IDs for the current page
        page_enrollment_ids = set()
        for gid in paged_gids:
             pids = grouped_hits[gid]['payment_ids']
             if pids:
                 first_pid = pids[0]
                 if first_pid in all_hits_pid_map:
                     # enrollment_id may be flat (slim select) or nested (join select)
                     row = all_hits_pid_map[first_pid]
                     eid = row.get('enrollment_id') or row.get('enrollment', {}).get('enrollment_id')
                     if eid: page_enrollment_ids.add(eid)

        # 2. Fetch MAX(payment_id) for each of these enrollments
        latest_payment_map = {}
        if page_enrollment_ids:
             try:
                 # Fetch all payments for these enrollments to find max.
                 # Selecting just payment_id and enrollment_id
                 latest_rows = supabase.table('payment')\
                     .select('enrollment_id, payment_id')\
                     .in_('enrollment_id', list(page_enrollment_ids))\
                     .execute().data
                 
                 # Calc max in memory
                 for lr in latest_rows:
                     eid = lr['enrollment_id']
                     pid = lr['payment_id']
                     if pid > latest_payment_map.get(eid, 0):
                         latest_payment_map[eid] = pid
             except Exception as e:
                 print(f"Error fetching latest payments: {e}")

        # --- Step 6: Re-Group for Display (Same logic as before) ---
        # This `rows_by_pid` contains the full details for the payments on the current page.
        # It comes from 'details_response' (Step 4) NOT all_hits.
        rows_by_pid = { r['payment_id']: r for r in raw_rows }
        
        results = []
        
        for gid in paged_gids:
            group_data = grouped_hits[gid]  # { gid, max_pid, payment_ids }
            valid_pids = group_data['payment_ids']
            
            # Sort PIDs desc so primary is latest
            valid_pids.sort(reverse=True)
            primary_pid = valid_pids[0]
            
            primary_row = rows_by_pid.get(primary_pid)
            if not primary_row: continue
            
            # Enrollment Info
            enroll = primary_row.get('enrollment') or {}
            student = enroll.get('student') or {}
            program = enroll.get('program') or {}
            
            # Check Editability: Is this the LATEST payment for this enrollment?
            # For a group (Bulk), if the primary_pid (max in group) is the absolute max for the enrollment, it's editable.
            current_enrollment_id = primary_row.get("enrollment_id")
            # Default to False if logic fails
            is_latest = False
            if current_enrollment_id and current_enrollment_id in latest_payment_map:
                is_latest = (primary_pid == latest_payment_map[current_enrollment_id])
            
            group_obj = {
                "id": group_data['gid'], # sort_id
                "sort_id": primary_row['payment_id'],
                "payment_ids": [], 
                "payment_id": primary_row['payment_id'], 
                "student_id": student.get("student_id"),
                "enrollment_id": primary_row.get("enrollment_id"),
                "student_name": student.get("name") or "Unknown",
                "student_code": student.get("student_code") or student.get("student_id"), 
                "class": student.get("class"),       
                "batch_id": student.get("batch_id"), 
                "roll_no": enroll.get("roll_no"),    
                "program_name": program.get("program_name") or "Unknown Program",
                "program_id": program.get("program_id"), 
                "amount": 0.0, 
                "months": [],
                "payment_date": primary_row.get('payment_date'), 
                "payment_method": primary_row.get('payment_method'),
                "type": "Single", 
                "remarks": primary_row.get('remarks') or "",
                "is_editable": is_latest, 
                "raw_group_id": primary_row.get('transaction_group_id'),
                "sub_payments": [] 
            }
            
            # Aggregate
            for pid in valid_pids:
                r = rows_by_pid[pid]
                amt = r.get('paid_amount')
                if amt is not None:
                    group_obj['amount'] += float(amt)
                    
                y = r.get('year')
                m = r.get('month')
                if y and m:
                    group_obj['months'].append( (y, m) )
                    sub_p = { "month": m, "year": y, "amount": float(amt) }
                    
                    # Avoid duplicates manually if needed, but dict compare works
                    is_dup = False
                    for existing in group_obj['sub_payments']:
                        if existing == sub_p:
                            is_dup = True
                            break
                    if not is_dup:
                        group_obj['sub_payments'].append(sub_p)
                
                group_obj['payment_ids'].append(pid)
                
            if len(group_obj['payment_ids']) > 1:
                group_obj['type'] = "Bulk"
                
            # Date Range Display Logic
            if group_obj['months']:
                try:
                    group_obj['months'].sort()
                    start_y, start_m = group_obj['months'][0]
                    end_y, end_m = group_obj['months'][-1]
                    
                    start_name = date(start_y, start_m, 1).strftime("%b %Y")
                    end_name = date(end_y, end_m, 1).strftime("%b %Y")
                    
                    if len(group_obj['months']) > 1:
                        if start_y == end_y:
                             start_month = date(start_y, start_m, 1).strftime("%b")
                             group_obj['date_display'] = f"{start_month} - {end_name}"
                        else:
                             group_obj['date_display'] = f"{start_name} - {end_name}"
                    else:
                        group_obj['date_display'] = start_name
                except Exception:
                    group_obj['date_display'] = "-"
            else:
                group_obj['date_display'] = "-"
            
            results.append(group_obj)
                
        return {
            "data": results,
            "total_count": total_count
        }

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
                    "raw_group_id": r.get('transaction_group_id'),
                    "sub_payments": []
                }
                group_order.append(gid)
            
            group = grouped_map[gid]
            group['total_amount'] += float(r['paid_amount'])
            group['months'].append( (r['year'], r['month']) )
            group['sub_payments'].append({
                "month": r['month'],
                "year": r['year'],
                "amount": float(r['paid_amount'])
            })
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

    def get_finance_stats_quick(self):
        """Fast stats: student count, program count, revenue. Cached with short TTL."""
        cached = get_cached_quick()
        if cached:
            return cached

        today = date.today()
        revenue_data = supabase.table(self.table).select("paid_amount, payment_date").execute().data
        total_revenue = sum(float(p['paid_amount'] or 0) for p in revenue_data)
        curr_month_prefix = f"{today.year}-{today.month:02d}"
        if today.month == 1:
            last_month_prefix = f"{today.year - 1}-12"
        else:
            last_month_prefix = f"{today.year}-{today.month - 1:02d}"

        revenue_this_month = sum(
            float(p['paid_amount'] or 0) for p in revenue_data
            if p.get('payment_date') and p['payment_date'].startswith(curr_month_prefix)
        )
        
        revenue_last_month = sum(
            float(p['paid_amount'] or 0) for p in revenue_data
            if p.get('payment_date') and p['payment_date'].startswith(last_month_prefix)
        )

        if revenue_last_month > 0:
            growth_percent = round(((revenue_this_month - revenue_last_month) / revenue_last_month) * 100, 1)
        else:
            growth_percent = 100.0 if revenue_this_month > 0 else 0.0

        student_res = supabase.table("student").select("*", count="exact", head=True).execute()
        prog_res = supabase.table("program").select("*", count="exact", head=True).execute()

        result = {
            "total_students": student_res.count or 0,
            "total_programs": prog_res.count or 0,
            "revenue_this_month": revenue_this_month,
            "revenue_last_month": revenue_last_month,
            "growth_percent": growth_percent,
            "revenue_total": total_revenue,
        }
        set_cached_quick(result)
        return result

    def get_finance_stats_dues(self):
        """Heavy due stats: total_due + due_this_month. Cached with longer TTL."""
        cached = get_cached_dues()
        if cached:
            return cached

        today = date.today()
        overall = self.get_due_breakdown_list()
        total_due = sum(s.get('total_due', 0) for s in overall.get('students', []))
        monthly = self.get_due_breakdown_monthly(today.month, today.year)
        due_this_month = sum(s.get('total_due', 0) for s in monthly.get('students', []))

        result = {
            "total_due": total_due,
            "due_total": total_due,
            "due_this_month": due_this_month,
        }
        set_cached_dues(result)
        return result

    def get_finance_stats(self):
        """Combined stats for backward compatibility. Merges quick + dues."""
        quick = self.get_finance_stats_quick()
        dues = self.get_finance_stats_dues()
        return {**quick, **dues}


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
            .eq("status", "Active")\
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
            # Check for Soft Deleted Program
            # User requirement: Deleted programs should NOT show due.
            prog = env.get('program')
            if not prog: continue
            
            if prog.get('is_active') is False:
                continue

            eid = env['enrollment_id']
            prog_name = prog['program_name']
            # BUGFIX: Use explicit None check — `or` treats 0 as falsy, 
            # causing a student with agreed_fee=0 to incorrectly display the program default.
            raw_fee = env.get('current_agreed_fee')
            fee = float(raw_fee if raw_fee is not None else (prog.get('monthly_fee') or 0))
            joined = env['enrollment_date']
            
            # Reuse core logic
            status = self.get_payment_status(eid)
            
            summary['total_due'] += status['total_due']
            
            summary['breakdown'].append({
                "program_name": prog_name,
                "enrollment_date": joined,
                "monthly_fee": fee,   # Now correctly shows the student's agreed fee (0 if free)
                "paid_up_to": status['paid_up_to'],
                "due_amount": status['total_due'],
                "status_highlight": status['fum']
            })
            
        return summary
            

        return stats

    def get_revenue_breakdown(self, month: int = None, year: int = None, program_id: int = None):
        """
        Phase 23: Detailed breakdown of revenue for a specific month.
        Phase 27 Update: Added program_id filter.
        """
        today = date.today()
        target_month = month if month else today.month
        target_year = year if year else today.year
        
        # 1. Fetch Payments for this month using Date Range (Postgres safe)
        start_date = date(target_year, target_month, 1)
        if target_month == 12:
            next_month_date = date(target_year + 1, 1, 1)
        else:
            next_month_date = date(target_year, target_month + 1, 1)
        
        # Need to join with student/program for display
        query = supabase.table(self.table)\
            .select("*, enrollment(program_id, student(name, student_id), program(program_name, program_id, batch(batch_name)))")\
            .gte("payment_date", start_date.isoformat())\
            .lt("payment_date", next_month_date.isoformat())\
            .order("payment_date", desc=True)

        if program_id:
            # Strict Filtering: Get all payments, then filter in Python if Join fails, 
            # OR fetch enrollments for program first.
            
            # Method A: Fetch Enrollment IDs for this program
            er = supabase.table(self.enrollment_table).select("enrollment_id").eq("program_id", program_id).execute()
            valid_eids = [x['enrollment_id'] for x in er.data]
            
            if not valid_eids:
                 # No enrollments = No revenue
                 raw_payments = []
            else:
                 # Fetch payments for these enrollments
                 # We reuse the Query structure but add .in_()
                 query = query.in_("enrollment_id", valid_eids)
                 raw_payments = query.execute().data
        else:
            raw_payments = query.execute().data
            
        # 2. Grouping & Aggregation
        grouped_map = {}
        group_order = []
        
        # for Program Summary (Tuple Key: ID, Name)
        prog_revenue = {} 

        for r in raw_payments:
            amount = float(r.get('paid_amount', 0))
            
            # Program Revenue Aggr
            enroll = r.get('enrollment') or {}
            # Check if filtered program matches (double check if desired)
            
            prog = enroll.get('program') or {}
            pid = prog.get('program_id') or enroll.get('program_id') # fallback
            pname = f"{prog.get('program_name')} ({prog.get('batch', {}).get('batch_name')})"
            
            if pid:
                key = (pid, pname)
                prog_revenue[key] = prog_revenue.get(key, 0) + amount

            # Transaction Grouping
            gid = r.get('transaction_group_id')
            if not gid:
                 gid = f"single_{r['payment_id']}"
            
            if gid not in grouped_map:
                grouped_map[gid] = {
                    "payment_id": r['payment_id'],
                    "payment_date": r['payment_date'],
                    "student_name": enroll.get('student', {}).get('name', 'Unknown'),
                    "student_id": enroll.get('student', {}).get('student_id'),
                    "program_name": pname,
                    "amount": 0.0,
                    "payment_method": r['payment_method'],
                    "months": [],
                    "type": "Single",
                    "enrollment_id": r['enrollment_id'],
                    "transaction_group_id": r.get('transaction_group_id'),
                    "paid_amount": 0.0, 
                    "total_amount": 0.0, 
                    "remarks": r.get('remarks') or "",
                    "is_editable": False
                }
                group_order.append(gid)
            
            group = grouped_map[gid]
            group['amount'] += amount
            group['total_amount'] += amount
            group['paid_amount'] += amount
            
            if r.get('month') and r.get('year'):
                group['months'].append( (r['year'], r['month']) )
                
            if len(group['months']) > 1:
                group['type'] = "Bulk"
                
        # 3. Finalize Transactions List
        transactions = []
        
        for gid in group_order:
            g = grouped_map[gid]
            
            # Format Date Display
            if g['months']:
                g['months'].sort()
                start_y, start_m = g['months'][0]
                end_y, end_m = g['months'][-1]
                
                start_name = date(start_y, start_m, 1).strftime("%b %Y")
                end_name = date(end_y, end_m, 1).strftime("%b %Y")
                
                if len(g['months']) > 1:
                    if start_y == end_y:
                         g['date_display'] = f"{date(start_y, start_m, 1).strftime('%b')} - {end_name}"
                    else:
                         g['date_display'] = f"{start_name} - {end_name}"
                else:
                    g['date_display'] = start_name
            else:
                 g['date_display'] = "-"
                 
            transactions.append(g)
            
        # 4. Best-Effort "Latest" Check
        seen_students = set()
        for t in transactions:
            sid = t.get('student_id')
            if sid and sid not in seen_students:
                t['is_editable'] = True
                seen_students.add(sid)
            else:
                t['is_editable'] = False

        # Convert Tuple Key to List of Dicts
        program_summary = [{"program_id": k[0], "name": k[1], "amount": v} for k, v in prog_revenue.items()]
        program_summary.sort(key=lambda x: x['amount'], reverse=True)
        
        return {
            "month": f"{date(target_year, target_month, 1).strftime('%B %Y')}",
            "program_summary": program_summary,
            "transactions": transactions
        }
        
    def get_due_breakdown_list(self, program_id: int = None):
        """
        Detailed list of WHO owes money and for WHICH months (Lifetime Arrears).
        PERFORMANCE: Uses 3 bulk DB queries regardless of student count.
        CORRECTNESS: Applies per-month fee history for accurate due calculation.
        """
        today = date.today()

        # QUERY 1: All active enrollments with program / student info
        query = supabase.table(self.enrollment_table)\
            .select("enrollment_id, roll_no, enrollment_date, program_id, "
                    "student(name, student_id), "
                    "program(program_name, monthly_fee, is_active, batch(batch_name))")\
            .eq("status", "Active")

        if program_id:
            query = query.eq("program_id", program_id)

        enrollments = query.execute().data

        if not enrollments:
            return {"program_summary": [], "students": []}

        # Filter out inactive/deleted programs and invalid records upfront
        valid_enrollments = []
        enrollment_ids = []
        for env in enrollments:
            prog = env.get('program')
            if not prog or not env.get('enrollment_date'):
                continue
            if prog.get('is_active') is False:
                continue
            valid_enrollments.append(env)
            enrollment_ids.append(env['enrollment_id'])

        if not enrollment_ids:
            return {"program_summary": [], "students": []}

        # QUERY 2: Bulk-fetch ALL fee histories for all relevant enrollments
        all_histories_raw = []
        chunk_size = 200
        for i in range(0, len(enrollment_ids), chunk_size):
            chunk = enrollment_ids[i:i + chunk_size]
            res = supabase.table("enrollment_fee_history")\
                .select("enrollment_id, fee_amount, effective_month, effective_year")\
                .in_("enrollment_id", chunk)\
                .execute()
            if res.data:
                all_histories_raw.extend(res.data)

        # Group histories by enrollment_id, sorted chronologically
        history_map: dict = {}
        for h in all_histories_raw:
            eid = h['enrollment_id']
            if eid not in history_map:
                history_map[eid] = []
            history_map[eid].append(h)
        for eid in history_map:
            history_map[eid].sort(key=lambda x: (x['effective_year'], x['effective_month']))

        # QUERY 3: Bulk-fetch ALL payments for all relevant enrollments
        all_payments_raw = []
        for i in range(0, len(enrollment_ids), chunk_size):
            chunk = enrollment_ids[i:i + chunk_size]
            res = supabase.table(self.table)\
                .select("enrollment_id, month, year, paid_amount")\
                .in_("enrollment_id", chunk)\
                .execute()
            if res.data:
                all_payments_raw.extend(res.data)

        # Group payments by enrollment_id then (year, month)
        payments_map: dict = {}
        for p in all_payments_raw:
            eid = p['enrollment_id']
            key = (p['year'], p['month'])
            if eid not in payments_map:
                payments_map[eid] = {}
            payments_map[eid][key] = payments_map[eid].get(key, 0) + float(p['paid_amount'])

        # HELPER: resolve fee for a specific (year, month) from sorted history
        def get_fee_for_month(histories, y, m):
            fee = 0.0
            for h in histories:
                if h['effective_year'] < y or (h['effective_year'] == y and h['effective_month'] <= m):
                    fee = float(h['fee_amount'])
                else:
                    break
            return fee

        # IN-PYTHON LEDGER COMPUTATION
        due_list = []
        prog_due_map = {}

        for env in valid_enrollments:
            eid = env['enrollment_id']
            prog = env['program']

            histories = history_map.get(eid, [])
            month_payments = payments_map.get(eid, {})

            try:
                start = datetime.strptime(env['enrollment_date'], "%Y-%m-%d").date().replace(day=1)
            except ValueError:
                continue

            # Find max paid month to ensure we cover advance payments
            max_paid_key = max(month_payments.keys(), default=None)
            if max_paid_key:
                mp_year, mp_month = max_paid_key
                if mp_month == 12:
                    last_paid_date = date(mp_year + 1, 1, 1)
                else:
                    last_paid_date = date(mp_year, mp_month + 1, 1)
            else:
                last_paid_date = today.replace(day=1)

            end = max(today.replace(day=1), last_paid_date)

            total_due = 0.0
            detail_parts = []
            curr = start

            while curr <= end:
                monthly_fee = get_fee_for_month(histories, curr.year, curr.month)
                paid_sum = month_payments.get((curr.year, curr.month), 0.0)

                is_past_or_present = (curr.year < today.year) or (curr.year == today.year and curr.month <= today.month)
                is_fully_paid = paid_sum >= monthly_fee

                if not is_fully_paid and is_past_or_present:
                    remaining = monthly_fee - paid_sum
                    total_due += remaining
                    if len(detail_parts) < 6:
                        month_label = curr.strftime("%b %Y")
                        if paid_sum > 0:
                            detail_parts.append(f"{month_label} (Partial - {int(remaining)})")
                        else:
                            detail_parts.append(f"{month_label} (Full)")

                # Advance month
                if curr.month == 12:
                    curr = curr.replace(year=curr.year + 1, month=1)
                else:
                    curr = curr.replace(month=curr.month + 1)

            if total_due <= 0:
                continue

            if len(detail_parts) >= 6:
                detail_parts.append("...")
            status_str = ", ".join(detail_parts)

            prog_name = f"{prog['program_name']} ({prog.get('batch', {}).get('batch_name')})"
            prog_key = (env.get('program_id', 0), prog_name)
            prog_due_map[prog_key] = prog_due_map.get(prog_key, 0) + total_due

            due_list.append({
                "student_id": env.get('student', {}).get('student_id'),
                "student_name": env.get('student', {}).get('name'),
                "roll_no": env.get('roll_no'),
                "program_name": prog_name,
                "total_due": total_due,
                "status_detail": status_str
            })

        program_summary = [{"program_id": k[0], "name": k[1], "amount": v} for k, v in prog_due_map.items()]
        program_summary.sort(key=lambda x: x['amount'], reverse=True)
        due_list.sort(key=lambda x: x['total_due'], reverse=True)

        return {
            "program_summary": program_summary,
            "students": due_list
        }

    def get_due_breakdown_monthly(self, month: int = None, year: int = None, program_id: int = None):
        """
        Breakdown of Due Fees for a SPECIFIC MONTH only.
        Returns Program Summary and Student List.
        """
        today = date.today()
        target_month = month if month else today.month
        target_year = year if year else today.year
        
        # 1. Active Enrollments (that started before or during target month)
        query = supabase.table(self.enrollment_table)\
            .select("*, roll_no, student(name, student_id), program(program_name, monthly_fee, is_active, batch(batch_name)), current_agreed_fee")\
            .eq("status", "Active")
            
        if program_id:
            query = query.eq("program_id", program_id)
            
        enrollments = query.execute().data
        
        if not enrollments:
             return {"program_summary": [], "students": []}
             
        # Filter by start date
        valid_enrollments = []
        enrollment_ids = []
        target_date_start = date(target_year, target_month, 1)
        
        for e in enrollments:
            if not e.get('enrollment_date'): continue
            try:
                s_date = datetime.strptime(e['enrollment_date'], "%Y-%m-%d").date()
                # Must be enrolled on or before the target month
                # Logic: If joined in March, they have due for March.
                # If joined April, no due for March.
                if s_date.year < target_year or (s_date.year == target_year and s_date.month <= target_month):
                    valid_enrollments.append(e)
                    enrollment_ids.append(e['enrollment_id'])
            except ValueError:
                continue
                
        if not enrollment_ids:
             return {"program_summary": [], "students": []}

        # 2. Bulk-fetch fee histories for this set of enrollments
        all_histories_raw = []
        chunk_size = 100
        for i in range(0, len(enrollment_ids), chunk_size):
            chunk = enrollment_ids[i:i + chunk_size]
            h_res = supabase.table("enrollment_fee_history")\
                .select("enrollment_id, fee_amount, effective_month, effective_year")\
                .in_("enrollment_id", chunk).execute()
            if h_res.data:
                all_histories_raw.extend(h_res.data)

        history_map: dict = {}
        for h in all_histories_raw:
            eid = h['enrollment_id']
            if eid not in history_map:
                history_map[eid] = []
            history_map[eid].append(h)
        for eid in history_map:
            history_map[eid].sort(key=lambda x: (x['effective_year'], x['effective_month']))

        def get_fee_for_target(histories, y, m):
            fee = 0.0
            for h in histories:
                if h['effective_year'] < y or (h['effective_year'] == y and h['effective_month'] <= m):
                    fee = float(h['fee_amount'])
                else:
                    break
            return fee

        # 3. Fetch Payments for Target Month only
        payments_map = {}
        for i in range(0, len(enrollment_ids), chunk_size):
            chunk = enrollment_ids[i:i + chunk_size]
            res = supabase.table(self.table)\
                .select("enrollment_id, paid_amount")\
                .in_("enrollment_id", chunk)\
                .eq("month", target_month)\
                .eq("year", target_year)\
                .execute()
            if res.data:
                for p in res.data:
                    payments_map[p['enrollment_id']] = payments_map.get(p['enrollment_id'], 0) + float(p['paid_amount'])

        # 4. Calculate Due
        due_list = []
        prog_due_map = {}

        for env in valid_enrollments:
            prog = env.get('program')
            if not prog: continue
            if prog.get('is_active') is False:
                continue

            eid = env['enrollment_id']
            # Resolve fee from history for the target month
            histories = history_map.get(eid, [])
            fee = get_fee_for_target(histories, target_year, target_month)
            if fee == 0:
                continue

            paid = payments_map.get(eid, 0)
            due = max(0, fee - paid)

            if due > 0:
                prog_name = f"{prog['program_name']} ({prog.get('batch', {}).get('batch_name')})"
                status = "Partial" if paid > 0 else "Unpaid"
                prog_key = (env['program_id'], prog_name)
                prog_due_map[prog_key] = prog_due_map.get(prog_key, 0) + due

                due_list.append({
                    "student_id": env.get('student', {}).get('student_id'),
                    "student_name": env.get('student', {}).get('name'),
                    "roll_no": env.get('roll_no') or env.get('student', {}).get('roll_no'),
                    "program_name": prog_name,
                    "total_due": due,
                    "status_detail": f"{status} (Paid: {paid})"
                })

        program_summary = [{"program_id": k[0], "name": k[1], "amount": v} for k, v in prog_due_map.items()]
        program_summary.sort(key=lambda x: x['amount'], reverse=True)
        due_list.sort(key=lambda x: x['total_due'], reverse=True)

        return {
            "program_summary": program_summary,
            "students": due_list
        }

    def _get_finance_stats_impl(self):
        """
        Aggregates key financial and operational metrics for the Dashboard.
        1. Total Active Students
        2. Total Programs
        3. Revenue This Month
        4. Total Due (All Time for Active Enrollments)
        """
        try:
            today = date.today()
            current_month = today.month
            current_year = today.year

            # 1. Total Students (All Registered Students)
            student_res = supabase.table("student").select("*", count="exact", head=True).execute()
            unique_students = student_res.count if student_res.count else 0 # Fixed: Count ALL students, not just active enrollments.

            # 2. Total Programs (All Programs)
            prog_res = supabase.table("program").select("*", count="exact", head=True).execute()
            total_programs = prog_res.count if prog_res.count else 0

            # 3. Revenue This Month
            # Sum paid_amount where month = current_month and year = current_year? 
            # OR where payment_date is in current month? 
            # Prompt says: "where payment_date falls within the current calendar month".
            # payment_date is YYYY-MM-DD.
            import calendar
            last_day = calendar.monthrange(current_year, current_month)[1]
            start_date = f"{current_year}-{current_month:02d}-01"
            end_date = f"{current_year}-{current_month:02d}-{last_day}"

            rev_res = supabase.table(self.table)\
                .select("paid_amount")\
                .gte("payment_date", start_date)\
                .lte("payment_date", end_date)\
                .execute()
            
            revenue_this_month = sum(item['paid_amount'] for item in rev_res.data) if rev_res.data else 0

            # 4. Total Due Overall
            # "Sum of all arrears (expected fees - actual payments) for all ACTIVE enrollments."
            # Logic:
            #  Iterate all active enrollments.
            #  For each, Calculate Expected = (Months since enrollment) * Monthly Fee
            #  Calculate Paid = Sum of payments for that enrollment.
            #  Due = Expected - Paid.
            #  Sum Dues.
            # This is N+1 heavy.
            # OPTIMIZATION: 
            #  Fetch all Active Enrollments with Program (Fee).
            #  Fetch all Payments for these enrollments.
            #  Process in Python.
            
            # A. Fetch Active Enrollments + Program Data
            enrollments = supabase.table(self.enrollment_table)\
                .select("enrollment_id, enrollment_date, program(monthly_fee, is_active), current_agreed_fee")\
                .eq("status", "Active")\
                .execute().data
            
            if not enrollments:
                total_due = 0
                due_this_month = 0
            else:
                enrollment_ids = [e['enrollment_id'] for e in enrollments]

                # Filter out broken/inactive program links
                valid_enrollments = []
                for e in enrollments:
                    prog = e.get('program')
                    if not prog or not e.get('enrollment_date'):
                        continue
                    if prog.get('is_active') is False:
                        continue
                    valid_enrollments.append(e)

                valid_ids = [e['enrollment_id'] for e in valid_enrollments]

                # Bulk-fetch ALL fee histories
                all_histories_raw = []
                chunk_size = 200
                for i in range(0, len(valid_ids), chunk_size):
                    chunk = valid_ids[i:i + chunk_size]
                    h_res = supabase.table("enrollment_fee_history")\
                        .select("enrollment_id, fee_amount, effective_month, effective_year")\
                        .in_("enrollment_id", chunk).execute()
                    if h_res.data:
                        all_histories_raw.extend(h_res.data)

                history_map = {}
                for h in all_histories_raw:
                    eid = h['enrollment_id']
                    if eid not in history_map:
                        history_map[eid] = []
                    history_map[eid].append(h)
                for eid in history_map:
                    history_map[eid].sort(key=lambda x: (x['effective_year'], x['effective_month']))

                # Bulk-fetch ALL payments for valid enrollments (with month/year for current-month calc)
                all_payments_raw = []
                for i in range(0, len(valid_ids), chunk_size):
                    chunk = valid_ids[i:i + chunk_size]
                    p_res = supabase.table(self.table)\
                        .select("enrollment_id, paid_amount, month, year")\
                        .in_("enrollment_id", chunk).execute()
                    if p_res.data:
                        all_payments_raw.extend(p_res.data)

                # Group payments by enrollment_id then (year, month)
                payments_map = {}
                for p in all_payments_raw:
                    eid = p['enrollment_id']
                    key = (p['year'], p['month'])
                    if eid not in payments_map:
                        payments_map[eid] = {}
                    payments_map[eid][key] = payments_map[eid].get(key, 0) + float(p['paid_amount'])

                def get_fee_for_month(histories, y, m):
                    fee = 0.0
                    for h in histories:
                        if h['effective_year'] < y or (h['effective_year'] == y and h['effective_month'] <= m):
                            fee = float(h['fee_amount'])
                        else:
                            break
                    return fee

                total_due = 0
                due_this_month = 0

                for env in valid_enrollments:
                    eid = env['enrollment_id']
                    histories = history_map.get(eid, [])
                    month_payments = payments_map.get(eid, {})

                    try:
                        start = datetime.strptime(env['enrollment_date'], "%Y-%m-%d").date().replace(day=1)
                    except ValueError:
                        continue

                    # Find end of ledger range
                    max_paid_key = max(month_payments.keys(), default=None)
                    if max_paid_key:
                        mp_y, mp_m = max_paid_key
                        last_paid_date = date(mp_y + 1, 1, 1) if mp_m == 12 else date(mp_y, mp_m + 1, 1)
                    else:
                        last_paid_date = today.replace(day=1)

                    end = max(today.replace(day=1), last_paid_date)
                    curr = start

                    while curr <= end:
                        monthly_fee = get_fee_for_month(histories, curr.year, curr.month)
                        paid_sum = month_payments.get((curr.year, curr.month), 0.0)
                        is_past_or_present = (curr.year < today.year) or (curr.year == today.year and curr.month <= today.month)

                        if is_past_or_present and paid_sum < monthly_fee:
                            total_due += monthly_fee - paid_sum

                        # Due this month specifically
                        if curr.year == today.year and curr.month == today.month:
                            if paid_sum < monthly_fee:
                                due_this_month += monthly_fee - paid_sum

                        if curr.month == 12:
                            curr = curr.replace(year=curr.year + 1, month=1)
                        else:
                            curr = curr.replace(month=curr.month + 1)

            return {
                "total_students": unique_students,
                "total_programs": total_programs,
                "revenue_this_month": revenue_this_month,
                "total_due": total_due,
                
                # Aliases for Finance Page capability
                "due_total": total_due,
                "due_this_month": due_this_month
            }
        except Exception as e:
            print(f"Error fetching finance stats: {e}")
            return {
                "total_students": 0,
                "total_programs": 0,
                "revenue_this_month": 0,
                "total_due": 0,
                "due_total": 0,
                "due_this_month": 0
            }

    def get_program_payment_status(self, program_id: int, month: int, year: int):
        """
        Fetches payment status for ALL active students in a program for a specific month.
        Returns a list of dicts with student details and payment status (Paid, Unpaid, Partial).
        """
        # 1. Get all ACTIVE enrollments for this program

        # We need student details (name, student_id, roll_no) and enrollment_id
        enrollments = supabase.table(self.enrollment_table)\
            .select("enrollment_id, roll_no, enrollment_date, student(student_id, name), program(program_id, monthly_fee, start_date), current_agreed_fee")\
            .eq("program_id", program_id)\
            .eq("status", "Active")\
            .execute().data
            
        if not enrollments:
            return []
            
        results = []
        
        
        # 2. Filter enrollments by date and prepare IDs
        enrollment_ids = []
        valid_enrollments = []
        
        for e in enrollments:
            # Check Enrollment Date
            e_date_str = e.get('enrollment_date')
            if e_date_str:
                try:
                    e_year = int(e_date_str[:4])
                    e_month = int(e_date_str[5:7])
                    
                    # If enrolled AFTER the target month/year, skip (not due yet)
                    if (e_year > year) or (e_year == year and e_month > month):
                        continue
                except ValueError:
                    pass # Invalid date format, include by default
            
            valid_enrollments.append(e)
            enrollment_ids.append(e['enrollment_id'])
        
        if not enrollment_ids:
            return []

        payments = supabase.table(self.table)\
            .select("enrollment_id, paid_amount")\
            .in_("enrollment_id", enrollment_ids)\
            .eq("month", month)\
            .eq("year", year)\
            .execute().data
            
        # Map payments by enrollment_id
        payment_map = {}
        for p in payments:
            eid = p['enrollment_id']
            payment_map[eid] = payment_map.get(eid, 0) + p['paid_amount']

        # Bulk-fetch ALL fee histories for relevant enrollments at once
        all_histories = supabase.table("enrollment_fee_history")\
            .select("enrollment_id, fee_amount, effective_month, effective_year")\
            .in_("enrollment_id", enrollment_ids)\
            .execute().data

        # Group histories by enrollment_id
        history_map: dict = {}
        for h in all_histories:
            eid = h['enrollment_id']
            if eid not in history_map:
                history_map[eid] = []
            history_map[eid].append(h)

        # 3. Build Result
        for enroll in valid_enrollments:
            student = enroll.get('student') or {}
            program = enroll.get('program') or {}

            eid = enroll['enrollment_id']
            default_fee = float(program.get('monthly_fee', 0))

            # Resolve the correct fee for this specific (month, year)
            # Find the most recent history entry whose (effective_year, effective_month) <= (year, month)
            histories = history_map.get(eid, [])
            applicable_fee = None
            best_key = None
            for h in histories:
                h_year = h['effective_year']
                h_month = h['effective_month']
                # Only consider histories that are "active by" the target month
                if (h_year < year) or (h_year == year and h_month <= month):
                    key = (h_year, h_month)
                    if best_key is None or key > best_key:
                        best_key = key
                        applicable_fee = float(h['fee_amount'])

            # Fall back to cached current_agreed_fee or program default
            monthly_fee = applicable_fee if applicable_fee is not None else float(enroll.get('current_agreed_fee') or default_fee)

            paid = payment_map.get(eid, 0)
            due = monthly_fee - paid
            
            status = 'Unpaid'
            if paid >= monthly_fee:
                status = 'Paid'
                due = 0
            elif paid > 0:
                status = 'Partial'
            
            results.append({
                "student_id": student.get('student_id'),
                "name": student.get('name'),
                "roll_no": enroll.get('roll_no') or student.get('roll_no'),
                "enrollment_id": eid,
                "monthly_fee": monthly_fee,
                "paid_amount": paid,
                "due_amount": due,
                "status": status
            })
            
        return results
