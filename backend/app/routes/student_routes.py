from fastapi import APIRouter, HTTPException
from app.repositories.student_repository import StudentRepository
from app.schemas.student import StudentCreate
from app.repositories.enrollment_repository import EnrollmentRepository
from app.repositories.payment_repository import PaymentRepository
from app.schemas.enrollment import EnrollmentCreate, EnrollmentResponse
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
def get_students():
    return repo.get_all_students()

@router.post("/students")
def create_student(student: StudentCreate):
    # FastAPI automatically validates 'student' against your Pydantic rules here!
    return repo.enroll_new_student(student)

@router.post("/students/register-with-enrollment")
def register_student_with_enrollment(request: StudentEnrollmentRequest):
    try:
        return repo.register_student_with_enrollment(request.student, request.program_ids)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/students/{student_id}")
def get_student(student_id: int):
    return repo.get_student_by_id(student_id)

@router.patch("/students/{student_id}")
def update_student(student_id: int, student_data: dict):
    # We accept a dict so we can do partial updates
    return repo.update_student(student_id, student_data)

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

@router.delete("/enrollments/{enrollment_id}")
def delete_enrollment(enrollment_id: int):
    return enrollment_repo.delete_enrollment(enrollment_id)

@router.get("/students/{student_id}/financial-summary")
def get_student_financial_summary(student_id: int):
    return payment_repo.get_student_financial_summary(student_id)