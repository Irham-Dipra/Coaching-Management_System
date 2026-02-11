from pydantic import BaseModel
from typing import Optional

# ==========================================
# TUTORIAL: What is Pydantic?
# ==========================================
# Pydantic is a library that enforces "Type Hints" at runtime.
# Standard Python:
#    def add(x: int): ...
#    If I call add("hello"), Python crashes INSIDE the function.
#
# Pydantic:
#    If I send "hello" to an integer field, Pydantic stops it AT THE DOOR.
#    It says: "Error: value is not a valid integer" before your code even runs.

# 1. We start by inheriting from 'BaseModel'. 
#    This gives our class the magical validation powers.
class StudentCreate(BaseModel):
    
    # 2. REQUIRED FIELDS
    #    'name: str' means this field MUST be present and MUST be text.
    name: str

    # 3. OPTIONAL FIELDS
    #    'Optional[str]' means it can be a string OR it can be None (empty).
    # 4. RENAMING
    #    We call this 'class_grade' in Python because 'class' is a reserved keyword.
    #    (We will map this back to the database column 'class' later).
    class_grade: Optional[int] = None
    
    # 5. BATCH
    #    Links student to a specific batch (Cohort).
    batch_id: Optional[int] = None

    # 6. DEMOGRAPHICS (Missing previously)
    fathers_name: Optional[str] = None
    school: Optional[str] = None
    contact: Optional[str] = None

class StudentEnrollmentRequest(BaseModel):
    student: StudentCreate
    program_ids: list[int]
