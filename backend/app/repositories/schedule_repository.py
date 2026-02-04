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
        # Join with room AND program_schedule -> program to get assignments
        # Supabase syntax: select(*, room(*), program_schedule(program(*)))
        res = supabase.table('schedule_window')\
            .select('*, room(room_name), program_schedule(program(program_id, program_name))')\
            .execute()
        return res.data

    @staticmethod
    def create_schedule_window(window: ScheduleWindowCreate):
        # 1. Conflict Validation (Same Room Overlap)
        existing = supabase.table('schedule_window').select('*')\
            .eq('room_id', window.room_id)\
            .eq('day_of_week', window.day_of_week)\
            .execute()
        
        new_start = window.start_time
        new_end = window.end_time
        
        for w in existing.data:
            from datetime import datetime
            exist_start = datetime.strptime(w['start_time'], "%H:%M:%S").time()
            exist_end = datetime.strptime(w['end_time'], "%H:%M:%S").time()
            
            if new_start < exist_end and new_end > exist_start:
                raise ValueError(f"Time overlapping with existing window in this Room: {w['start_time']} - {w['end_time']}")

        # 2. Insert Window
        payload = window.dict(exclude={'program_ids'}) # Exclude field not in DB table
        payload['start_time'] = str(window.start_time)
        payload['end_time'] = str(window.end_time)
        
        res = supabase.table('schedule_window').insert(payload).execute()
        if not res.data: return None
        
        new_window = res.data[0]
        
        # 3. Assign Programs (if any)
        if window.program_ids:
            # Note: We should technically check for program conflicts (Student/Teacher double booking) here too.
            # For now, let's just insert.
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
        
        new_start = datetime.strptime(start_time, "%H:%M:%S").time() if isinstance(start_time, str) else start_time
        new_end = datetime.strptime(end_time, "%H:%M:%S").time() if isinstance(end_time, str) else end_time
        
        for w in day_windows:
            exist_start = datetime.strptime(w['start_time'], "%H:%M:%S").time()
            exist_end = datetime.strptime(w['end_time'], "%H:%M:%S").time()
            
            if new_start < exist_end and new_end > exist_start:
                return True, f"Conflict with existing class: {w['start_time']} - {w['end_time']}"
        
        return False, None

    @staticmethod
    def get_window_details(window_id: int):
        # 1. Fetch Window + Room + Programs
        res = supabase.table('schedule_window')\
            .select('*, room(room_name), program_schedule(program(program_id, program_name, enrollment(student(student_id, name, roll_no, contact))))')\
            .eq('window_id', window_id)\
            .single()\
            .execute()
        
        if not res.data: return None
        window = res.data

        # 2. Aggregate Students
        students = []
        programs = window.get('program_schedule', [])
        for ps in programs:
            prog = ps['program']
            enrolls = prog.get('enrollment', [])
            for enroll in enrolls:
                student = enroll['student']
                # Avoid duplicates if student is in multiple programs in same slot (unlikely but possible)
                if not any(s['student_id'] == student['student_id'] for s in students):
                    students.append({
                        **student,
                        'program_name': prog['program_name'] # Tag source program
                    })
        
        window['students'] = students
        return window

    @staticmethod
    def update_window(window_id: int, updates: Dict[str, Any]):
        # Handle Program Re-assignment if 'program_ids' is present
        if 'program_ids' in updates:
            program_ids = updates.pop('program_ids')
            # 1. Clear existing
            supabase.table('program_schedule').delete().eq('window_id', window_id).execute()
            # 2. Add new
            if program_ids:
                payload = [{"program_id": pid, "window_id": window_id} for pid in program_ids]
                supabase.table('program_schedule').insert(payload).execute()

        # Update core fields if any
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
