from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.repositories.student_repository import StudentRepository
from app.repositories.enrollment_repository import EnrollmentRepository
from app.repositories.payment_repository import PaymentRepository
from app.schemas.enrollment import EnrollmentCreate, EnrollmentResponse, EnrollmentBulkRequest, EnrollmentFeeUpdate
from app.schemas.student import StudentCreate, StudentEnrollmentRequest

# 1. Create a Router (like a mini-app for students)
router = APIRouter()

# 2. Add the Logic
# 2. Add the Logic
repo = StudentRepository()
enrollment_repo = EnrollmentRepository()
payment_repo = PaymentRepository()

# 3. Define the "Endpoints" (URL paths)

@router.get("/students")
def get_students(
    page: int = 1, 
    page_size: int = 50, 
    search: str = None, 
    roll_search: str = None,
    class_filter: str = None,
    batch_filter: str = None,
    program_filter: str = None,
    sort_by: str = None,
    sort_desc: bool = False
):
    filters = {}
    if class_filter: filters['class'] = class_filter
    if batch_filter: filters['batch_id'] = batch_filter
    if program_filter: filters['program_id'] = program_filter
    
    # If no params, it acts like get_all (but paginated default Page 1)
    # The frontend was calling getAllStudents which expected List.
    # We must be careful not to break existing calls if they expect List.
    # The existing repo.get_all_students() returned a List.
    # If we change "/students" to return dict {data, total}, we might break other pages (e.g. BatchDetails, Batches?) if they use it.
    # Let's check usages.
    # `StudentList` used it. `PrintBatch` used it.
    # To be safe, we can either:
    # 1. Create separate endpoint "/students/list" or "/students/paginated".
    # 2. Or detect if pagination params are present.
    # But for cleaner API, usually Query Params defaults apply.
    # If I change return type, I MUST update frontend.
    # The User asked to "paginate the students list".
    # I will update frontend to handle {data, total}.
    # But wait, other components might break.
    # Let's check `PrintBatch.tsx` lines 27:
    # `const { data: students } = useQuery ... StudentRepository.getAllStudents`
    # It expects array.
    
    # DECISION: Create NEW endpoint or update existing and fix all callers.
    # "page" param is optional.
    # If I make it optional and return List if not present?
    # No, consistent return type is better.
    # I will create a NEW function in repo `get_students_paginated` (done) and call it if params are passed?
    # Or just use a different endpoint path.
    # Let's use the SAME path but return different structure? No, bad practice.
    # Let's use `/students/paginated` to be safe and incremental.
    # Or just use params and if `all=true` return list?
    
    # Existing `get_all_students` does NOT take params.
    # `get_students` in router calls `repo.get_all_students()`.
    
    # I will REPLACE `get_students` logic to use pagination, AND I will update Frontend to handle it.
    # I will update `PrintBatch.tsx` later or now?
    # Better: Keep `get_all_students` for legacy/dropdowns?
    # But `PrintBatch` loads ALL students (could be thousands). It SHOULD use pagination or search api.
    # For now, I will add `paginated` mode.
    
    return repo.get_students_paginated(page, page_size, search, roll_search, filters, sort_by, sort_desc)

@router.get("/students/all")
def get_all_students_no_page():
    return repo.get_all_students()

@router.post("/students")
def create_student(student: StudentCreate):
    # FastAPI automatically validates 'student' against your Pydantic rules here!
    return repo.enroll_new_student(student)

@router.post("/students/register-with-enrollment")
def register_student_with_enrollment(request: StudentEnrollmentRequest):
    try:
        return repo.register_student_with_enrollment(request.student, request.program_ids, request.enrollment_date, request.custom_fees)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/students/{student_id}")
def get_student(student_id: int):
    return repo.get_student_by_id(student_id)

@router.patch("/students/{student_id}")
def update_student(student_id: int, student_data: dict):
    # We accept a dict so we can do partial updates
    return repo.update_student(student_id, student_data)

@router.delete("/students/{student_id}")
def delete_student(student_id: int):
    return repo.delete_student(student_id)

# ==========================================
# ENROLLMENT ENDPOINTS
# ==========================================

@router.get("/students/{student_id}/enrollments")
def get_student_enrollments(student_id: int):
    return enrollment_repo.get_by_student(student_id)

@router.post("/enrollments")
def enroll_student(enrollment: EnrollmentCreate):
    try:
        return enrollment_repo.enroll_student(enrollment)
    except Exception as e:
        # Catch duplicate error and return 400
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/enrollments/bulk")
def enroll_students_bulk(request: EnrollmentBulkRequest):
    return enrollment_repo.enroll_student_bulk(
        request.student_ids, 
        request.program_ids,
        request.enrollment_date,
        request.custom_fees
    )

@router.delete("/enrollments/{enrollment_id}")
def delete_enrollment(enrollment_id: int):
    return enrollment_repo.delete_enrollment(enrollment_id)

@router.patch("/enrollments/{enrollment_id}/fee")
def update_enrollment_fee(enrollment_id: int, fee_update: EnrollmentFeeUpdate):
    return enrollment_repo.update_agreed_fee(enrollment_id, fee_update.new_fee, fee_update.effective_date)

@router.get("/students/{student_id}/financial-summary")
def get_student_financial_summary(student_id: int):
    return payment_repo.get_student_financial_summary(student_id)

@router.get("/students/{student_id}/analytics")
def get_student_analytics(student_id: int):
    data = repo.get_student_analytics(student_id)
    if not data:
        return {
            "summary": {"avg_percentage": 0, "highest_score": 0, "lowest_score": 0, "total_exams": 0, "attendance_present": 0, "attendance_total": 0},
            "exams": [],
            "attendance_trend": []
        }
    return data