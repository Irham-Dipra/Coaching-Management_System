from pydantic import BaseModel
from typing import Optional
from datetime import date

class ExamBase(BaseModel):
    exam_name: str
    exam_date: Optional[date] = None
    exam_type: str = "Weekly"  # Weekly, Monthly, Term
    subject: Optional[str] = None
    total_marks: float
    question_link: Optional[str] = None
    solution_link: Optional[str] = None

class ExamCreate(ExamBase):
    program_ids: list[int]

class ExamResponse(ExamBase):
    exam_id: int
    
    class Config:
        from_attributes = True
