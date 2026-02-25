from pydantic import BaseModel
from typing import Optional, List

# Single Record Entry
class ResultBase(BaseModel):
    enrollment_id: int
    exam_id: int
    written_marks: Optional[float] = None
    mcq_marks: Optional[float] = None

class ResultCreate(ResultBase):
    pass

class ResultResponse(ResultBase):
    result_id: int
    total_score: float # Computed in DB or Python

    class Config:
        from_attributes = True

# For Bulk Entry (e.g. from Excel or Grid)
class BulkResultItem(BaseModel):
    student_id: int # We map Student ID to Enrollment ID in logic
    written_marks: Optional[float] = None
    mcq_marks: Optional[float] = None

class BulkResultRequest(BaseModel):
    exam_id: int
    results: List[BulkResultItem]
