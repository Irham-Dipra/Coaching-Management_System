from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.schemas.schedule import (
    RoomCreate, RoomResponse, 
    ScheduleWindowCreate, ScheduleWindowResponse,
    ProgramScheduleAssign
)
from app.repositories.schedule_repository import ScheduleRepository

router = APIRouter()

# --- ROOMS ---
@router.get("/rooms", response_model=List[RoomResponse])
def get_rooms():
    return ScheduleRepository.get_rooms()

@router.post("/rooms", response_model=RoomResponse)
def create_room(room: RoomCreate):
    try:
        data = ScheduleRepository.create_room(room)
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/rooms/{room_id}")
def delete_room(room_id: int):
    try:
        ScheduleRepository.delete_room(room_id)
        return {"message": "Room deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- WINDOWS ---
@router.get("/schedule-windows", response_model=List[ScheduleWindowResponse])
def get_windows():
    return ScheduleRepository.get_all_windows()

@router.post("/schedule-windows", response_model=ScheduleWindowResponse)
def create_window(window: ScheduleWindowCreate):
    try:
        data = ScheduleRepository.create_schedule_window(window)
        return data
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) # ValidOverlap Error
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/schedule-windows/search")
def search_windows(room_id: Optional[int] = None, day: Optional[str] = None, program_id: Optional[int] = None):
    return ScheduleRepository.search_windows(room_id, day, program_id)

@router.delete("/schedule-windows/{window_id}")
def delete_window(window_id: int):
    try:
        ScheduleRepository.delete_window(window_id)
        return {"message": "Window deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/schedule-windows/{window_id}")
def get_window_details(window_id: int):
    data = ScheduleRepository.get_window_details(window_id)
    if not data:
        raise HTTPException(status_code=404, detail="Window not found")
    return data

@router.put("/schedule-windows/{window_id}")
def update_window(window_id: int, payload: dict):
    try:
        data = ScheduleRepository.update_window(window_id, payload)
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- ASSIGNMENT ---
@router.get("/programs/{program_id}/schedule", response_model=List[ScheduleWindowResponse])
def get_program_schedule(program_id: int):
    return ScheduleRepository.get_program_schedule(program_id)

@router.post("/programs/schedule-assign")
def assign_schedule(payload: ProgramScheduleAssign):
    try:
        data = ScheduleRepository.assign_program_schedule(payload.program_id, payload.window_ids)
        return {"message": "Schedule updated", "data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
