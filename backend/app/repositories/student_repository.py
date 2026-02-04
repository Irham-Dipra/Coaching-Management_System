# Imports the 'supabase' connection object we created in app/core/supabase.py
from app.core.supabase import supabase
from app.schemas.student import StudentCreate

class StudentRepository:
    def __init__(self):
        # Define the table name once so we don't typo it later
        # NOTE: Postgres table names are usually lowercase!
        self.table = "student"

    def get_all_students(self):
        # Fetch students with Batch info and Enrollment (Program) info
        response = supabase.table(self.table)\
            .select("*, batch(batch_name), enrollment(program_id, roll_no, program(program_name))")\
            .execute()
        
        # Return only the 'data' part (ignoring status codes, etc.)
        return response.data

    def enroll_new_student(self, student_data: StudentCreate):
        # Convert Pydantic object to a dictionary
        data_dict = student_data.dict()
        
        # FIX: The database column is named "class", but our Pydantic field is "class_grade"
        # We need to rename it before sending to Supabase
        if 'class_grade' in data_dict:
            data_dict['class'] = data_dict.pop('class_grade')

        # Insert the corrected dictionary
        response = supabase.table(self.table).insert(data_dict).execute()
        
        # Return only the 'data' part (ignoring status codes, etc.)
        return response.data[0]

    def get_student_by_id(self, student_id: int):
        # Join enrollment -> program to see what they are studying
        response = supabase.table(self.table)\
            .select("*, batch(*), enrollment(*, program(*))")\
            .eq("student_id", student_id)\
            .execute()
        return response.data[0] if response.data else None

    def update_student(self, student_id: int, updates: dict):
        # 1. Clean the payload
        #    Remove fields that shouldn't be updated or are nested objects from Joins
        start_keys = list(updates.keys())
        for key in start_keys:
            # Remove nested objects (dicts/lists) because they are joins (e.g. 'batch': {...})
            if isinstance(updates[key], (dict, list)):
                del updates[key]
            # Remove PK/Audit fields
            if key in ['student_id', 'created_at']:
                del updates[key]

        # 2. Handle simple renaming
        if 'class_grade' in updates:
            updates['class'] = updates.pop('class_grade')
            
        # 3. Execute Update
        response = supabase.table(self.table)\
            .update(updates)\
            .eq("student_id", student_id)\
            .execute()
        return response.data[0] if response.data else None