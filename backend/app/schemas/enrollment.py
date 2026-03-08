from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.schemas.program import ProgramResponse

class EnrollmentBase(BaseModel):
    program_id: int
    enrollment_date: Optional[date] = None

class EnrollmentCreate(EnrollmentBase):
    student_id: int

class EnrollmentResponse(EnrollmentBase):
    enrollment_id: int
    # We will nest the full program details here so the frontend can show "Physics 2024"
    program: Optional[ProgramResponse] = None
    status: Optional[str] = "Active"
    is_reenrollment: Optional[bool] = False
    current_agreed_fee: Optional[float] = None

    class Config:
        from_attributes = True

class EnrollmentBulkRequest(BaseModel):
    student_ids: list[int]
    program_ids: list[int]
    enrollment_date: Optional[str] = None # YYYY-MM-DD
    # Program ID -> { Student ID -> Custom Fee }
    custom_fees: Optional[dict[str, dict[str, float]]] = None

class EnrollmentFeeUpdate(BaseModel):
    new_fee: float
    effective_date: str # YYYY-MM-DD
