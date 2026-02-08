from fastapi import APIRouter
from app.repositories.exam_repository import ExamRepository
from app.repositories.result_repository import ResultRepository
from app.schemas.exam import ExamCreate
from app.schemas.result import BulkResultRequest

router = APIRouter()
exam_repo = ExamRepository()
result_repo = ResultRepository()

# ==========================
# EXAMS
# ==========================

@router.post("/exams")
def create_exam(exam: ExamCreate):
    return exam_repo.create_exam(exam)

@router.get("/exams")
def get_all_exams():
    return exam_repo.get_all_exams()

@router.get("/programs/{program_id}/exams")
def get_program_exams(program_id: int):
    return exam_repo.get_exams_by_program(program_id)

@router.get("/exams/{exam_id}")
def get_exam_details(exam_id: int):
    return exam_repo.get_exam_by_id(exam_id)

@router.delete("/exams/{exam_id}")
def delete_exam(exam_id: int):
    return exam_repo.delete_exam(exam_id)

@router.put("/exams/{exam_id}")
def update_exam(exam_id: int, exam: ExamCreate):
    return exam_repo.update_exam(exam_id, exam)

# ==========================
# RESULTS (BULK & STATS)
# ==========================

@router.post("/results/bulk")
def submit_bulk_results(bulk_data: BulkResultRequest):
    return result_repo.submit_bulk_results(bulk_data)

@router.get("/exams/{exam_id}/results")
def get_exam_merit_list(exam_id: int):
    return result_repo.get_exam_results(exam_id)

@router.get("/exams/{exam_id}/analytics")
def get_exam_analytics(exam_id: int):
    try:
        return result_repo.get_exam_analytics(exam_id)
    except Exception as e:
        print(f"ERROR in get_exam_analytics: {e}")
        raise e

@router.get("/exams/{exam_id}/candidates")
def get_exam_candidates(exam_id: int):
    return result_repo.get_exam_candidates(exam_id)
