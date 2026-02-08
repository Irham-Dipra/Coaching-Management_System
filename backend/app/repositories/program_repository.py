# ==========================================
# REPOSITORY PATTERN EXPLAINED
# ==========================================
# A "Repository" is a design pattern that isolates the database logic.
# Instead of writing raw SQL or Supabase queries directly in your API routes/endpoints,
# you put them methods here.
# BENEFITS:
# 1. Reusability: You can call 'get_all_programs()' from multiple places without rewriting the query.
# 2. Maintainability: If you change your database (e.g., from Supabase to Firebase), you only change this file.
# 3. Readability: API routes become cleaner and just focus on HTTP logic (requests/responses), not DB complexities.

# 1. IMPORT STATEMENTS
from fastapi.encoders import jsonable_encoder
# 'jsonable_encoder' is a FastAPI utility. Pydantic models (schemas) are strict objects.
# Databases often expect simple "JSON-like" types (strings, integers, lists, dicts).
# This function converts complex objects (like Dates, Pydantic Models) into standard Python dicts/lists.

from app.core.supabase import supabase
# This imports our configured Supabase client instance. It's the "connection" to our database.

from app.schemas.program import ProgramCreate, BatchCreate
# Imports Pydantic models. These define the "Shape" of data we expect to receive when creating things.
# They act as a contract/validation layer.


class ProgramRepository:
    def __init__(self):
        # Define table names as constants to avoid typos later.
        self.program_table = "program"
        self.batch_table = "batch"

    # ==========================================
    # BATCH OPERATIONS
    # ==========================================
    # We manage Batches here too because they are so closely related to Programs.
    # In a larger app, you might split this into its own 'BatchRepository'.
    
    def get_all_batches(self):
        # Query: SELECT * FROM batch
        result = supabase.table(self.batch_table).select("*").execute()
        return result.data 
        # '.data' contains the actual list of rows returned by Supabase.

    def create_batch(self, batch: BatchCreate):
        # 1. Convert Pydantic model -> Dict (e.g., BatchCreate(name="B1") -> {"name": "B1"})
        data = jsonable_encoder(batch)
        
        # 2. Insert into DB
        # Query: INSERT INTO batch (...) VALUES (...)
        response = supabase.table(self.batch_table).insert(data).execute()
        
        # 3. Return the created object (so the frontend gets the new ID immediately)
        return response.data[0] # Return the first (and only) item created.

    # ==========================================
    # PROGRAM OPERATIONS
    # ==========================================
    
    def get_all_programs(self):
        # Fetch status to filter Active counts only
        response = supabase.table(self.program_table)\
            .select("*, batch(*), enrollment(status)")\
            .execute()
        
        data = response.data
        for p in data:
            # Manual count of Active students
            active_count = sum(1 for e in p.get('enrollment', []) if e.get('status') == 'Active')
            p['student_count'] = active_count
            # Remove the raw enrollment list to keep response clean
            if 'enrollment' in p:
                del p['enrollment']
                
        return data

    def get_program_by_id(self, program_id: int):
        # This is a "Heavy" query for the Details Page. We want EVERYTHING connected to this program.
        
        # The Query String Syntax:
        # We are asking for nested relationships. Supabase (PostgREST) allows deep fetching.
        
        query = """
            *,                             
            batch(*),                      
            enrollment(                    
                *,                         
                student(*),                
                payment(*)                 
            ),
            program_exam(
                exam(*)
            ),
            teacher_program_enrollment(    
                teacher(*)                 
            )
        """
        # Translation:
        # 1. Get Program fields (*)
        # 2. Get the Batch info (*)
        # 3. Get all Enrollments -> inside each enrollment, get the Student details AND their Payments.
        # 4. Get all Exams linked to this program.
        # 5. Get all Teachers linked (via the junction table teacher_program_enrollment).

        response = supabase.table(self.program_table)\
            .select(query)\
            .eq("program_id", program_id)\
            .execute()
            
        # Return the single object if found, otherwise None
        return response.data[0] if response.data else None

    def create_program(self, program: ProgramCreate):
        # The 'program' object coming from the user already has 'batch_id'.
        # We use jsonable_encoder to ensure dates are strings, not objects (e.g. date(2024,1,1) -> "2024-01-01")
        data = jsonable_encoder(program)
        
        # Perform Insert
        response = supabase.table(self.program_table).insert(data).execute()
        
        # Return the newly created program
        return response.data[0]
