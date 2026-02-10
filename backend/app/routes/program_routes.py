from fastapi import APIRouter, HTTPException
from app.repositories.program_repository import ProgramRepository
from app.schemas.program import ProgramCreate, BatchCreate

router = APIRouter()
repo = ProgramRepository()

# ==========================================
# BATCH ENDPOINTS
# ==========================================

@router.get("/batches")
def get_batches():
    return repo.get_all_batches()

@router.post("/batches")
def create_batch(batch: BatchCreate):
    try:
        return repo.create_batch(batch)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/batches/{batch_id}")
def get_batch_details(batch_id: int):
    batch = repo.get_batch_by_id(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

@router.put("/batches/{batch_id}")
def update_batch(batch_id: int, batch_update: BatchCreate):
    try:
        # Pydantic model -> dict
        updates = batch_update.dict(exclude_unset=True)
        return repo.update_batch(batch_id, updates)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# PROGRAM ENDPOINTS
# ==========================================

@router.get("/programs")
def get_programs():
    return repo.get_all_programs()

@router.get("/programs/{program_id}")
def get_program_details(program_id: int):
    return repo.get_program_by_id(program_id)

@router.post("/programs")
def create_program(program: ProgramCreate):
    try:
        return repo.create_program(program)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/programs/{program_id}")
def update_program(program_id: int, program_update: ProgramCreate):
    try:
        # Pydantic model -> JSON-compatible dict (handles Dates, etc.)
        from fastapi.encoders import jsonable_encoder
        updates = jsonable_encoder(program_update, exclude_unset=True)
        return repo.update_program(program_id, updates)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

