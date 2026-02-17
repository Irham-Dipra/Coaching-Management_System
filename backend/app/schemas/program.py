from pydantic import BaseModel
from typing import Optional
from datetime import date

# ==========================================
# Phase 4: Academic Hub (Programs & Batches)
# ==========================================
# In your database, a 'Program' (like "Physics 2024") belongs to a 'Batch' (like "HSC 2024").
# We need schemas for BOTH to handle nested data.

# ------------------------------------------
# 1. BATCH SCHEMAS
# ------------------------------------------
class BatchBase(BaseModel):
    batch_name: str

class BatchCreate(BatchBase):
    pass

class BatchResponse(BatchBase):
    batch_id: int
    
    class Config:
        from_attributes = True

# ------------------------------------------
# 2. PROGRAM SCHEMAS
# ------------------------------------------
class ProgramBase(BaseModel):
    program_name: str
    monthly_fee: Optional[float] = 0.0
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = True
    routine: Optional[str] = None # Google Drive Link
    # We use the ID to link it to a batch
    batch_id: Optional[int] = None

class ProgramCreate(ProgramBase):
    pass

class ProgramResponse(ProgramBase):
    program_id: int
    # Optional: We can nest the full batch details here if we do a "Join" query later!
    # batch: Optional[BatchResponse] = None

    class Config:
        from_attributes = True
