import sys
import os
from datetime import date

# Add current directory to path so we can import app modules
sys.path.append(os.getcwd())

from app.repositories.enrollment_repository import EnrollmentRepository
from app.repositories.student_repository import StudentRepository
from app.repositories.program_repository import ProgramRepository
from app.schemas.enrollment import EnrollmentCreate

def test_enrollment():
    print("--- STARTING DEBUG ---")
    
    # 1. Get Dependencies
    student_repo = StudentRepository()
    program_repo = ProgramRepository()
    enroll_repo = EnrollmentRepository()
    
    # 2. Fetch a dummy student and program
    print("Fetching student...")
    students = student_repo.get_all_students()
    if not students:
        print("ERROR: No students found to test with.")
        return
    
    student_id = students[0]['student_id']
    print(f"Using Student ID: {student_id}")

    print("Fetching program...")
    programs = program_repo.get_all_programs()
    if not programs:
        print("ERROR: No programs found to test with.")
        return
    
    program_id = programs[0]['program_id']
    print(f"Using Program ID: {program_id}")
    
    # 3. Create Payload
    print("Creating payload...")
    payload = EnrollmentCreate(
        student_id=student_id,
        program_id=program_id,
        enrollment_date=date.today(),
        status="active"
    )
    
    # 4. Attempt Enrollment
    print("Attempting enrollment...")
    try:
        result = enroll_repo.enroll_student(payload)
        print("SUCCESS! Enrolled:", result)
    except Exception as e:
        print("\n!!! CAUGHT EXCEPTION !!!")
        print(e)
        # Import traceback to see full details
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_enrollment()
