from app.core.supabase import supabase
from app.schemas.schedule import RoomCreate, ScheduleWindowCreate, ProgramScheduleAssign
from typing import List, Dict, Any

class ScheduleRepository:
    
    # --- ROOMS ---
    @staticmethod
    def get_rooms():
        res = supabase.table('room').select('*').execute()
        return res.data

    @staticmethod
    def create_room(room: RoomCreate):
        res = supabase.table('room').insert(room.dict()).execute()
        return res.data[0] if res.data else None

    @staticmethod
    def delete_room(room_id: int):
        res = supabase.table('room').delete().eq('room_id', room_id).execute()
        return res.data

    # --- SCHEDULE WINDOWS ---
    @staticmethod
    def get_all_windows():
        # Query the VIEW which has pre-calculated counts and flattened programs
        try:
            res = supabase.table('master_schedule_view').select('*').execute()
            # The view returns 'programs' as a JSONB list. Pydantic should handle it if names match.
            # room_name is top level in view, but schema expects nested 'room' object?
            # Schema: room: Optional[RoomObj]
            # View: room_name
            # We need to map it or update schema.
            # Let's map it manually to match Schema structure for frontend compatibility (mostly).
            # OR Update Schema to accept flat 'room_name'.
            # I updated Schema to have 'room' as Optional[RoomObj].
            # Let's map the View data to the Schema structure.
            data = []
            for row in res.data:
                # Reconstruct nested objects if needed or just pass as is if schema allows.
                # 'room' object needed
                if row.get('room_name'):
                    row['room'] = {'room_name': row['room_name']}
                
                # 'programs' is already a list of {program_id, program_name}
                # row['programs'] = row['programs']
                
                # Ensure time objects for Pydantic? Supabase returns strings. Pydantic parses strings.
                data.append(row)
            return data
        except Exception:
            # Fallback if view doesn't exist yet (Migration safety)
            # Old logic
            res = supabase.table('schedule_window')\
                .select('*, room(room_name), program_schedule(program(program_id, program_name))')\
                .execute()
            return res.data

    @staticmethod
    @staticmethod
    def _parse_time(t):
        from datetime import datetime
        if isinstance(t, str):
            # Try full format first
            try:
                return datetime.strptime(t, "%H:%M:%S").time()
            except ValueError:
                # Try short format
                try:
                    return datetime.strptime(t, "%H:%M").time()
                except ValueError:
                     raise ValueError(f"Invalid time format: {t}. Expected HH:MM:SS or HH:MM")
        return t

    @staticmethod
    def _validate_capacity(room_id, program_ids):
        if not room_id or not program_ids: return

        # 1. Get Room Capacity
        room_res = supabase.table('room').select('capacity, room_name').eq('room_id', room_id).execute()
        if not room_res.data: return
        room = room_res.data[0]
        capacity = room.get('capacity')
        
        if not capacity: return # No capacity limit set
        
        # 2. Get Total Active Students in these Programs
        # We can't easily do a sum of counts for multiple programs in one simple query without a view or group by.
        # But we can just count all active enrollments that match ANY of the program_ids.
        enroll_res = supabase.table('enrollment')\
            .select('*', count='exact', head=True)\
            .in_('program_id', program_ids)\
            .eq('status', 'Active')\
            .execute()
            
        total_students = enroll_res.count
        
        if total_students > capacity:
             raise ValueError(f"Capacity Error: Room '{room['room_name']}' (Cap: {capacity}) cannot fit {total_students} active students.")

    def create_schedule_window(window: ScheduleWindowCreate):
        # 0. Capacity Validation
        if window.program_ids:
            ScheduleRepository._validate_capacity(window.room_id, window.program_ids)

        # 1. Conflict Validation (Same Room Overlap)
        existing = supabase.table('schedule_window').select('*')\
            .eq('room_id', window.room_id)\
            .eq('day_of_week', window.day_of_week)\
            .execute()
        
        new_start = ScheduleRepository._parse_time(window.start_time)
        new_end = ScheduleRepository._parse_time(window.end_time)
        
        if new_start >= new_end:
            raise ValueError("Invalid Time Range: Start time must be before End time.")
        
        for w in existing.data:
            exist_start = ScheduleRepository._parse_time(w['start_time'])
            exist_end = ScheduleRepository._parse_time(w['end_time'])
            
            if new_start < exist_end and new_end > exist_start:
                raise ValueError(f"Room Conflict: Room is already booked from {w['start_time']} to {w['end_time']} on {window.day_of_week}.")

        # 2. Program Conflict Validation
        if window.program_ids:
            try:
                # Fetch windows for these programs on the same day, JOINING ROOM to get the name
                prog_conflicts = supabase.table('program_schedule')\
                    .select('program_id, program(program_name), schedule_window!inner(start_time, end_time, day_of_week, room(room_name))')\
                    .in_('program_id', window.program_ids)\
                    .eq('schedule_window.day_of_week', window.day_of_week)\
                    .execute()
                
                for row in prog_conflicts.data:
                    w = row['schedule_window']
                    exist_start = ScheduleRepository._parse_time(w['start_time'])
                    exist_end = ScheduleRepository._parse_time(w['end_time'])
                    
                    if new_start < exist_end and new_end > exist_start:
                        prog_name = row['program']['program_name'] if row.get('program') else f"Program {row['program_id']}"
                        room_name = w['room']['room_name'] if w.get('room') else "another room"
                        raise ValueError(f"Program Conflict: '{prog_name}' is already scheduled in '{room_name}' from {w['start_time']} to {w['end_time']} on {window.day_of_week}.")
            except ValueError as ve:
                raise ve
            except Exception as e:
                print(f"Validation Error: {e}")
                pass

        # 2. Insert Window
        payload = window.dict(exclude={'program_ids'}) 
        payload['start_time'] = str(window.start_time)
        payload['end_time'] = str(window.end_time)
        # payload includes 'window_name' automatically from Base model
        
        res = supabase.table('schedule_window').insert(payload).execute()
        if not res.data: return None
        
        new_window = res.data[0]
        
        # 3. Assign Programs (if any)
        if window.program_ids:
            assign_payload = [{"program_id": pid, "window_id": new_window['window_id']} for pid in window.program_ids]
            supabase.table('program_schedule').insert(assign_payload).execute()
            
        return new_window

    @staticmethod
    def delete_window(window_id: int):
        res = supabase.table('schedule_window').delete().eq('window_id', window_id).execute()
        return res.data

    # --- PROGRAM ASSIGNMENT ---
    @staticmethod
    def get_program_schedule(program_id: int):
        # Join program_schedule -> schedule_window -> room
        res = supabase.table('program_schedule')\
            .select('window_id, schedule_window(*, room(room_name))')\
            .eq('program_id', program_id)\
            .execute()
        
        # Flatten: Return list of Windows
        windows = [item['schedule_window'] for item in res.data]
        return windows

    @staticmethod
    def search_windows(room_id: int = None, day: str = None, program_id: int = None):
        query = supabase.table('schedule_window').select('*, room(room_name), program_schedule!inner(program_id, program(program_name))')
        
        if room_id:
            query = query.eq('room_id', room_id)
        if day:
            query = query.eq('day_of_week', day)
        if program_id:
            query = query.eq('program_schedule.program_id', program_id)
            
        res = query.execute()
        return res.data

    @staticmethod
    def check_program_conflict(program_id: int, day: str, start_time: str, end_time: str):
        # Fetch all windows for this program on this day
        windows = ScheduleRepository.get_program_schedule(program_id)
        day_windows = [w for w in windows if w['day_of_week'] == day]
        
        new_start = ScheduleRepository._parse_time(start_time)
        new_end = ScheduleRepository._parse_time(end_time)
        
        for w in day_windows:
            exist_start = ScheduleRepository._parse_time(w['start_time'])
            exist_end = ScheduleRepository._parse_time(w['end_time'])
            
            if new_start < exist_end and new_end > exist_start:
                return True, f"Conflict with existing class: {w['start_time']} - {w['end_time']}"
        
        return False, None



    @staticmethod
    def get_window_details(window_id: int):
        # 1. Fetch Window + Room + Programs + Enrollments
        res = supabase.table('schedule_window')\
            .select('*, room(room_name), program_schedule(program(program_id, program_name, enrollment(roll_no, status, student(student_id, name, contact))))')\
            .eq('window_id', window_id)\
            .single()\
            .execute()
        
        if not res.data: return None
        window = res.data

        # 2. Aggregate Students (Active Only)
        students = []
        programs = window.get('program_schedule', [])
        for ps in programs:
            prog = ps['program']
            enrolls = prog.get('enrollment', [])
            for enroll in enrolls:
                if enroll.get('status') != 'Active': continue # Filter Withdrawn/Deleted

                student = enroll['student']
                if not any(s['student_id'] == student['student_id'] for s in students):
                    students.append({
                        **student,
                        'roll_no': enroll['roll_no'],
                        'program_name': prog['program_name']
                    })
        
        window['students'] = students
        return window

    @staticmethod
    def update_window(window_id: int, updates: Dict[str, Any]):
        # 0. Capacity Validation (if changing room or programs)
        # We need to check capacity if:
        # A) Room changed
        # B) Programs changed
        # C) Both changed
        
        check_capacity = False
        target_room_id = updates.get('room_id')
        target_programs = updates.get('program_ids')
        
        if 'program_ids' in updates: # Programs changing, MUST check
             check_capacity = True
        elif 'room_id' in updates: # Room changing, existing programs might not fit
             check_capacity = True
             
        if check_capacity:
             # Need full context. If something is missing in updates, fetch current.
             current_data = None
             if not target_room_id or (target_programs is None and 'program_ids' not in updates):
                  current_data = supabase.table('schedule_window').select('*').eq('window_id', window_id).single().execute().data
             
             final_room_id = target_room_id if target_room_id else current_data['room_id']
             
             if 'program_ids' in updates:
                 final_program_ids = target_programs
             else:
                 # Fetch existing programs
                 prog_res = supabase.table('program_schedule').select('program_id').eq('window_id', window_id).execute()
                 final_program_ids = [p['program_id'] for p in prog_res.data]
            
             if final_program_ids:
                 ScheduleRepository._validate_capacity(final_room_id, final_program_ids)


        # 1. Validation (Room Conflict - Check Exclusion)
        if 'room_id' in updates or 'day_of_week' in updates or 'start_time' in updates or 'end_time' in updates:
            # We need current values for any missing updates to check full context
            current = supabase.table('schedule_window').select('*').eq('window_id', window_id).single().execute().data
            if not current: raise ValueError("Window not found")
            
            rid = updates.get('room_id', current['room_id'])
            day = updates.get('day_of_week', current['day_of_week'])
            start = updates.get('start_time', current['start_time'])
            end = updates.get('end_time', current['end_time'])
            
            # Check Room Conflict (Exclude self)
            existing = supabase.table('schedule_window').select('*')\
                .eq('room_id', rid)\
                .eq('day_of_week', day)\
                .neq('window_id', window_id)\
                .execute()
            
            new_start_t = ScheduleRepository._parse_time(start)
            new_end_t = ScheduleRepository._parse_time(end)
            
            if new_start_t >= new_end_t:
                raise ValueError("Invalid Time Range: Start time must be before End time.")

            for w in existing.data:
                exist_start = ScheduleRepository._parse_time(w['start_time'])
                exist_end = ScheduleRepository._parse_time(w['end_time'])
                if new_start_t < exist_end and new_end_t > exist_start:
                    raise ValueError(f"Room Conflict: Room is busy from {w['start_time']} to {w['end_time']}.")

        # 2. Program Management & Conflict Check
        # If program_ids are passed, we must validate them first!
        if 'program_ids' in updates:
            program_ids = updates['program_ids']
            # We need the day/time to check context. (Might be updated or current)
            # Re-fetch if not already established above (optimize later)
            if 'current' not in locals():
                 current = supabase.table('schedule_window').select('*').eq('window_id', window_id).single().execute().data
            
            day = updates.get('day_of_week', current['day_of_week'])
            start = updates.get('start_time', current['start_time'])
            end = updates.get('end_time', current['end_time'])
             
            # Validation: Check if these programs are busy elsewhere (Exclude THIS window)
            if program_ids:
                 prog_conflicts = supabase.table('program_schedule')\
                    .select('program_id, program(program_name), schedule_window!inner(window_id, start_time, end_time, day_of_week, room(room_name))')\
                    .in_('program_id', program_ids)\
                    .eq('schedule_window.day_of_week', day)\
                    .neq('window_id', window_id)\
                    .execute()
                 
                 new_start_t = ScheduleRepository._parse_time(start)
                 new_end_t = ScheduleRepository._parse_time(end)

                 for row in prog_conflicts.data:
                    w = row['schedule_window']
                    exist_start = ScheduleRepository._parse_time(w['start_time'])
                    exist_end = ScheduleRepository._parse_time(w['end_time'])
                    
                    if new_start_t < exist_end and new_end_t > exist_start:
                         prog_name = row['program']['program_name'] if row.get('program') else f"Program {row['program_id']}"
                         room_name = w['room']['room_name'] if w.get('room') else "another room"
                         raise ValueError(f"Program Conflict: '{prog_name}' is already scheduled in '{room_name}' from {w['start_time']} to {w['end_time']} on {day}.")

            # If Valid, Sync
            # 1. Delete old
            supabase.table('program_schedule').delete().eq('window_id', window_id).execute()
            # 2. Insert new
            if program_ids:
                payload = [{"program_id": pid, "window_id": window_id} for pid in program_ids]
                supabase.table('program_schedule').insert(payload).execute()
            
            # Remove from updates dict so we don't try to update schedule_window with it
            del updates['program_ids']

        # 3. Update core fields
        if updates:
            supabase.table('schedule_window').update(updates).eq('window_id', window_id).execute()
        
        return ScheduleRepository.get_window_details(window_id)

    @staticmethod
    def assign_program_schedule(program_id: int, window_ids: List[int]):
        # 1. Clear existing assignments for this program
        # Note: This removes this program from all windows, then re-adds it to selected ones.
        supabase.table('program_schedule').delete().eq('program_id', program_id).execute()
        
        # 2. Insert new assignments
        if window_ids:
            payload = [{"program_id": program_id, "window_id": wid} for wid in window_ids]
            supabase.table('program_schedule').insert(payload).execute()
            
        return ScheduleRepository.get_program_schedule(program_id)
