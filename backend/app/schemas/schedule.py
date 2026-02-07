from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import time

# --- ROOM SCHEMAS ---
class RoomBase(BaseModel):
    room_name: str
    capacity: Optional[int] = None

class RoomCreate(RoomBase):
    pass

class RoomResponse(RoomBase):
    room_id: int
    
    class Config:
        from_attributes = True

# --- SCHEDULE WINDOW SCHEMAS ---
class ScheduleWindowBase(BaseModel):
    room_id: int
    day_of_week: str  # 'Saturday', 'Sunday', etc.
    start_time: time
    end_time: time
    window_name: Optional[str] = None

    @validator('end_time')
    def end_time_must_be_after_start_time(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v

class ScheduleWindowCreate(ScheduleWindowBase):
    program_ids: Optional[List[int]] = None

class ProgramShortObj(BaseModel):
    program_id: int
    program_name: str

class ProgramScheduleObj(BaseModel):
    program: ProgramShortObj

class RoomObj(BaseModel):
    room_name: str

class ScheduleWindowResponse(ScheduleWindowBase):
    window_id: int
    room: Optional[RoomObj] = None
    # Legacy nested structure
    program_schedule: Optional[List[ProgramScheduleObj]] = None
    # New flattened structure from View
    programs: Optional[List[ProgramShortObj]] = None 
    student_count: Optional[int] = 0

    class Config:
        from_attributes = True

# --- PROGRAM SCHEDULE ASSIGNMENT ---
class ProgramScheduleAssign(BaseModel):
    program_id: int
    window_ids: List[int] # Assign multiple slots at once
