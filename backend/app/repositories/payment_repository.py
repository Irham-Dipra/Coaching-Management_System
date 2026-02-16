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
            except Exception as e:
                print(f"Bulk Insert Failed: {e}")
                # If the batch fails (system error), re-raise
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
        return supabase.table(self.table).delete().eq("payment_id", payment_id).execute().data

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

            # Calculate Arrears (For past months OR future months that are partially paid)
            # If a student starts paying for a future month, the remainder is considered 'Due' in this context.
            arrears_amount = balance_remaining if (is_past_or_present or paid_sum > 0) else 0
            
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
        query = supabase.table(self.table)\
            .select("payment_id, transaction_group_id, enrollment!inner(enrollment_id, roll_no, student!inner(name, class, batch_id), program(program_id))")\
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
            # Date Range Filters
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
                     # Access enrollment_id from the partial data in all_hits_pid_map
                     # enrollment is nested now
                     eid = all_hits_pid_map[first_pid].get('enrollment', {}).get('enrollment_id')
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

    def get_finance_stats(self):
        """
        Calculates financial dashboards stats: Total Revenue and Total Due.
        
        Optimized Phase 25:
        1. Fetch Active Enrollments first.
        2. Calculate Revenue (All Time & This Month) using lightweight queries.
        3. Calculate Due only for ACTIVE students to save resources.
        """
        today = date.today()
        month_start = f"{today.year}-{today.month:02d}-01"
        
        # 1. Total Revenue (Global) - Lightweight Query
        # We only need paid_amount. To avoid timeout on huge datasets, we really should use an RPC/View in future.
        # For now, just fetching paid_amount column is 90% lighter than select(*).
        revenue_data = supabase.table(self.table).select("paid_amount, payment_date").execute().data
        
        total_revenue = sum(float(p['paid_amount'] or 0) for p in revenue_data)
        
        # Revenue This Month (Filter in Python for flexibility or add filter query? Python is fine for now on reduced data)
        # Optimized: Pre-calculate current month string to match
        curr_month_prefix = f"{today.year}-{today.month:02d}"
        revenue_this_month = sum(float(p['paid_amount'] or 0) for p in revenue_data if p['payment_date'] and p['payment_date'].startswith(curr_month_prefix))

        # 2. Fetch Active Enrollments
        enrollments = supabase.table(self.enrollment_table)\
            .select("enrollment_id, enrollment_date, program(monthly_fee)")\
            .eq("status", "Active")\
            .execute().data
            
        if not enrollments:
             return {
                "revenue_total": total_revenue,
                "revenue_this_month": revenue_this_month,
                "due_total": 0,
                "due_this_month": 0
            }

        # 3. Fetch Payments ONLY for Active Students (For Due Calculation)
        # Filtering by enrollment_id.in_([]) avoids processing dropped students' history for Dues.
        active_ids = [e['enrollment_id'] for e in enrollments]
        
        # Batching: If > 500 active students, filtering by IN might fail URL limit.
        # Safe strategy: If list is huge, fetch all (we already have revenue_data!). 
        # Actually, we already fetched 'revenue_data' which contains ALL payments (enrollment_id is missing above!).
        # Let's re-use 'revenue_data' but we need 'enrollment_id' in it.
        
        # RE-OPTIMIZATION:
        # Fetch "enrollment_id, paid_amount, payment_date" in the FIRST query.
        # Use that for everything.
        # That logic was arguably what caused the crash ("Fetching thousands of columns? No, just 4 columns").
        # The crash was likely purely connection/time related.
        # So, adding 'enrollment_id' back to revenue_data allows us to do it all in ONE fetch, which is usually better than 2 large ones.
        
        # Let's do a refined Single Fetch with timeout protection (already added in core/supabase.py).
        # We process in memory.
        
        all_payments = supabase.table(self.table).select("enrollment_id, paid_amount, payment_date").execute().data
        
        # Recalculate Revenue (just to be safe/consistent)
        # (Same as above)
        
        # Index payments by Enrollment ID
        payments_by_enrollment = {}
        for p in all_payments:
            eid = p['enrollment_id']
            if eid not in payments_by_enrollment:
                payments_by_enrollment[eid] = []
            payments_by_enrollment[eid].append(p)
            
        # --- DUE CALCULATION ---
        total_due_overall = 0
        total_due_this_month = 0
        
        for env in enrollments:
            prog = env.get('program')
            if not prog or not env['enrollment_date']: continue
            
            fee = float(prog['monthly_fee'] or 0)
            if fee == 0: continue
            
            # History
            student_payments = payments_by_enrollment.get(env['enrollment_id'], [])
            
            # A. Lifetime Due
            start_date_obj = datetime.strptime(env['enrollment_date'], "%Y-%m-%d").date()
            # Calculate months passed
            months_passed = (today.year - start_date_obj.year) * 12 + (today.month - start_date_obj.month) + 1
            months_passed = max(0, months_passed)
            
            expected_lifetime = months_passed * fee
            paid_lifetime = sum(float(p['paid_amount'] or 0) for p in student_payments)
            
            student_due_total = max(0, expected_lifetime - paid_lifetime)
            total_due_overall += student_due_total
             
             # B. Due This Month (Simplified: Active Debt contribution)
             # If they owe money, how much of it is for the current month?
             # We assume if they have Arrears, at least 1 month's worth is "Due Now"
            paid_this_month = sum(float(p['paid_amount'] or 0) for p in student_payments if p['payment_date'] and p['payment_date'].startswith(curr_month_prefix))
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
        Phase 23: Detailed list of WHO owes money and for WHICH months (Lifetime Arrears).
        Aggregated by student.
        Phase 27: Added program_id filter.
        """
        # 1. Get Active Enrollments with Student/Program info
        query = supabase.table(self.enrollment_table)\
            .select("*, roll_no, student(name, student_id), program(program_name, monthly_fee, batch(batch_name))")\
            .eq("status", "Active")
            
        if program_id:
            query = query.eq("program_id", program_id)
            
        enrollments = query.execute().data
            
        today = date.today()
        
        if not enrollments:
            return {
                "program_summary": [],
                "students": []
            }
            
        enrollment_ids = [e['enrollment_id'] for e in enrollments]
        
        # Optimize: Fetch ALL payments for these enrollments
        # Batch if necessary, but for now assuming reasonable size
        all_payments = []
        chunk_size = 100
        for i in range(0, len(enrollment_ids), chunk_size):
            chunk = enrollment_ids[i:i+chunk_size]
            res = supabase.table(self.table).select("enrollment_id, paid_amount").in_("enrollment_id", chunk).execute()
            if res.data:
                all_payments.extend(res.data)

        payments_map = {}
        for p in all_payments:
            eid = p['enrollment_id']
            payments_map[eid] = payments_map.get(eid, 0) + float(p['paid_amount'])
            
        due_list = []
        prog_due_map = {}
        
        for env in enrollments:
            prog = env.get('program')
            if not prog or not env.get('enrollment_date'): continue
            
            fee = float(prog.get('monthly_fee', 0))
            if fee == 0: continue
            
            # Calc Lifetime Due
            try:
                start = datetime.strptime(env['enrollment_date'], "%Y-%m-%d").date()
            except ValueError:
                continue

            months_passed = (today.year - start.year) * 12 + (today.month - start.month) + 1
            months_passed = max(0, months_passed)
            
            expected = months_passed * fee
            paid = payments_map.get(env['enrollment_id'], 0)
            arrears = max(0, expected - paid)
            
            # If program_id is filtered, we include even if 0 due? 
            # Usually breakdowns only show where there IS due.
            if arrears <= 0: continue 
            
            # --- STATUS DETAIL GENERATION ---
            months_covered_count = paid / fee 
            fully_paid_months = int(months_covered_count)
            remainder = paid % fee
            
            current_idx = 0
            detail_parts = []
            
            curr_date = start
            
            while curr_date <= today:
                if current_idx < fully_paid_months:
                    pass
                elif current_idx == fully_paid_months and remainder > 0:
                    due_amt = fee - remainder
                    month_name = curr_date.strftime("%b")
                    detail_parts.append(f"{month_name} (Partial - {int(due_amt)})")
                else:
                    month_name = curr_date.strftime("%b")
                    detail_parts.append(f"{month_name} (Full)")
                
                if curr_date.month == 12:
                    curr_date = date(curr_date.year + 1, 1, 1)
                else:
                    curr_date = date(curr_date.year, curr_date.month + 1, 1)
                
                if len(detail_parts) > 6:
                    detail_parts.append("...")
                    break
                    
                current_idx += 1
                
            status_str = ", ".join(detail_parts)
            
            prog_name = f"{prog['program_name']} ({prog.get('batch', {}).get('batch_name')})"
            
            # Aggregate Program Due
            # Note: If filtering by program_id, prog_due_map will only have 1 entry.
            prog_key = (env['program_id'], prog_name)
            prog_due_map[prog_key] = prog_due_map.get(prog_key, 0) + arrears

            due_list.append({
                "student_id": env.get('student', {}).get('student_id'),
                "student_name": env.get('student', {}).get('name'),
                "roll_no": env.get('roll_no') or env.get('student', {}).get('roll_no'),
                "program_name": prog_name,
                "total_due": arrears,
                "status_detail": status_str
            })
            
        # Program Summary List
        program_summary = [{"program_id": k[0], "name": k[1], "amount": v} for k, v in prog_due_map.items()]
        program_summary.sort(key=lambda x: x['amount'], reverse=True)
        # Sort Students by highest due
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
            .select("*, roll_no, student(name, student_id), program(program_name, monthly_fee, batch(batch_name))")\
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

        # 2. Fetch Payments for Target Month
        # We need payments that cover this specific month.
        # Strict logic: payments with month=target_month AND year=target_year
        
        # Batching for safety
        payments_map = {}
        chunk_size = 100
        for i in range(0, len(enrollment_ids), chunk_size):
            chunk = enrollment_ids[i:i+chunk_size]
            res = supabase.table(self.table)\
                .select("enrollment_id, paid_amount")\
                .in_("enrollment_id", chunk)\
                .eq("month", target_month)\
                .eq("year", target_year)\
                .execute()
            
            if res.data:
                for p in res.data:
                    payments_map[p['enrollment_id']] = payments_map.get(p['enrollment_id'], 0) + float(p['paid_amount'])

        # 3. Calculate Due
        due_list = []
        prog_due_map = {} # (id, name) -> amount
        
        for env in valid_enrollments:
            prog = env.get('program')
            if not prog: continue
            fee = float(prog.get('monthly_fee', 0))
            if fee == 0: continue
            
            eid = env['enrollment_id']
            paid = payments_map.get(eid, 0)
            
            due = max(0, fee - paid)
            
            if due > 0:
                prog_name = f"{prog['program_name']} ({prog.get('batch', {}).get('batch_name')})"
                
                status = "Unpaid"
                if paid > 0:
                    status = "Partial"
                
                # Prog Agg
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
                
        # Format
        program_summary = [{"program_id": k[0], "name": k[1], "amount": v} for k, v in prog_due_map.items()]
        program_summary.sort(key=lambda x: x['amount'], reverse=True)
        due_list.sort(key=lambda x: x['total_due'], reverse=True)
        
        return {
            "program_summary": program_summary,
            "students": due_list
        }

    def get_finance_stats(self):
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
                .select("enrollment_id, enrollment_date, program(monthly_fee)")\
                .eq("status", "Active")\
                .execute().data
            
            if not enrollments:
                total_due = 0
                due_this_month = 0
            else:
                enrollment_ids = [e['enrollment_id'] for e in enrollments]
                
                # B. Fetch All Payments for these IDs
                # We can't pass thousands of IDs in .in_(). 
                # If list is small (<100), okay. If large, might need strict loop or separate approach.
                # Let's assume < 1000 for now.
                
                # To be creating "High-Impact", let's be robust.
                # Constructing a map of enrollment_id -> total_paid.
                
                # Fetch all payments? No, too big.
                # Fetch payments linked to active enrollments?
                # We can join? payment -> enrollment.
                # Supabase JS: .select('*, enrollment!inner(status)') .eq('enrollment.status', 'Active')
                # Python client: similar.
                
                paid_res = supabase.table(self.table)\
                    .select("enrollment_id, paid_amount")\
                    .execute() # Fetching ALL payments might be too much eventually.
                
                # Filter in Python for now or assume we just iterate enrollments if we can't do complex joins easily here.
                # Better: `supabase.rpc('get_total_dues')` -- but I can't create RPCs easily without SQL tool.
                # Let's use the Python loop for "Active Enrollments" assuming < 500 students.
                
                # We need payments for these specific enrollments.
                # If we have 50 students, fetching all payments for them is okay.
                
                # Let's try to do it in memory.
                # 1. Create Map: { enrollment_id: { fee: X, date: Y, paid: 0 } }
                edu_map = {}
                for e in enrollments:
                    if e.get('program'): # Handle broken links
                        edu_map[e['enrollment_id']] = {
                            'fee': e['program']['monthly_fee'],
                            'start': datetime.strptime(e['enrollment_date'], "%Y-%m-%d").date() if e.get('enrollment_date') else date.today(),
                            'paid': 0
                        }
                
                # 2. Sum payments
                # We need to fetch payments for these IDs. 
                # .in_('enrollment_id', all_ids)
                all_ids = list(edu_map.keys())
                
                # Batched fetch if necessary. 
                # For this MVP, let's fetch all payment records where enrollment_id is in list.
                payments_data = []
                if all_ids:
                    # chunking (Supabase URL limit)
                    chunk_size = 50 # Safe number
                    for i in range(0, len(all_ids), chunk_size):
                        chunk = all_ids[i:i+chunk_size]
                        p_res = supabase.table(self.table).select("enrollment_id, paid_amount").in_("enrollment_id", chunk).execute()
                        if p_res.data:
                            payments_data.extend(p_res.data)

                for p in payments_data:
                    eid = p['enrollment_id']
                    if eid in edu_map:
                        edu_map[eid]['paid'] += p['paid_amount']
                
                # 3. Calculate Due
                total_due = 0
                due_this_month = 0
                
                # Fetch payments specifically for THIS month (for "Due This Month" stat)
                # We need to filter payments where month=current & year=current
                # Note: 'payment' table has 'month' and 'year' columns.
                current_month_payments = supabase.table(self.table)\
                    .select("enrollment_id, paid_amount")\
                    .eq("month", current_month)\
                    .eq("year", current_year)\
                    .execute().data
                
                # Map of paid-this-month by enrollment
                paid_this_month_map = {}
                for p in current_month_payments:
                    paid_this_month_map[p['enrollment_id']] = paid_this_month_map.get(p['enrollment_id'], 0) + p['paid_amount']

                for eid, data in edu_map.items():
                    fee = data['fee']
                    
                    # A. Total Due Calculation
                    # Months active (inclusive of start month and current month)
                    months_active = (today.year - data['start'].year) * 12 + (today.month - data['start'].month) + 1
                    months_active = max(0, months_active) # Align with get_due_breakdown_list logic
                    
                    expected = months_active * fee
                    due = expected - data['paid']
                    if due < 0: due = 0
                    total_due += due
                    
                    # B. Due This Month Calculation
                    # Expected This Month = Fee (if active)
                    # Paid This Month = Look up from map
                    # This implies "Unpaid fees for the current month"
                    
                    # Only if started before or during this month
                    if data['start'] <= today:
                        paid_now = paid_this_month_map.get(eid, 0)
                        month_due = fee - paid_now
                        if month_due < 0: month_due = 0
                        due_this_month += month_due

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
            .select("enrollment_id, roll_no, enrollment_date, student(student_id, name), program(program_id, monthly_fee, start_date)")\
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
            
        
        # 3. Build Result
        for enroll in valid_enrollments:
            student = enroll.get('student') or {} # Handle potential missing join
            program = enroll.get('program') or {}
            
            eid = enroll['enrollment_id']
            monthly_fee = program.get('monthly_fee', 0)
            paid = payment_map.get(eid, 0)
            due = monthly_fee - paid
            
            status = 'Unpaid'
            if paid >= monthly_fee:
                status = 'Paid'
                due = 0 # No negative due
            elif paid > 0:
                status = 'Partial'
            
            results.append({
                "student_id": student.get('student_id'),
                "name": student.get('name'),
                "roll_no": enroll.get('roll_no') or student.get('roll_no'), # Prioritize enrollment roll
                # Use student roll for now as per current schema viewing.
                "enrollment_id": eid,
                "monthly_fee": monthly_fee,
                "paid_amount": paid,
                "due_amount": due,
                "status": status
            })
            
        return results
