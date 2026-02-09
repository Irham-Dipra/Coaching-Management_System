import asyncio
from app.repositories.schedule_repository import ScheduleRepository

# Mocking Supabase call or just calling the repo method if it connects to real DB
# Assuming the environment is set up correctly in this shell

def debug_rooms():
    print("--- Fetching Rooms ---")
    rooms = ScheduleRepository.get_rooms()
    print(f"Found {len(rooms)} rooms.")
    for r in rooms:
        print(f"ID: {r['room_id']}, Name: {r['room_name']}")
        
        print(f"  Fetching windows for Room {r['room_id']}...")
        windows = ScheduleRepository.search_windows(room_id=r['room_id'])
        print(f"  Found {len(windows)} windows.")
        for w in windows:
            print(f"    Window ID: {w['window_id']}, Day: {w['day_of_week']}, Time: {w['start_time']}-{w['end_time']}")
            progs = w.get('program_schedule', [])
            print(f"      Programs: {len(progs)}")
            print(f"      Data: {w}")

if __name__ == "__main__":
    try:
        debug_rooms()
    except Exception as e:
        print(f"Error: {e}")
