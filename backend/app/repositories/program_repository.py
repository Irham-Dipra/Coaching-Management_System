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

    def get_batch_by_id(self, batch_id: int):
        # Fetch batch details along with all programs in this batch
        # We can also fetch students via filtered queries later, but basic batch info first.
        query = """
            *,
            program(*)
        """
        response = supabase.table(self.batch_table)\
            .select(query)\
            .eq("batch_id", batch_id)\
            .execute()
            
        return response.data[0] if response.data else None

    def update_batch(self, batch_id: int, updates: dict):
        response = supabase.table(self.batch_table)\
            .update(updates)\
            .eq("batch_id", batch_id)\
            .execute()
        return response.data[0] if response.data else None

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


    def update_program(self, program_id: int, updates: dict):
        response = supabase.table(self.program_table)\
            .update(updates)\
            .eq("program_id", program_id)\
            .execute()
        return response.data[0] if response.data else None

    # ==========================================
    # ANALYTICS SUBSYSTEM
    # ==========================================
    def get_program_analytics(self, program_id: int):
        # 1. Fetch Basic Scope (Program, Enrollments, Linked Exams)
        
        # A. Program & Enrollment IDs
        # We need all enrollments to map student_ids and track attendance
        enrollments = supabase.table("enrollment")\
            .select("enrollment_id, student_id")\
            .eq("program_id", program_id)\
            .execute().data
            
        if not enrollments:
            return None # No data
            
        enrollment_ids = [e['enrollment_id'] for e in enrollments]
        student_ids = list(set([e['student_id'] for e in enrollments]))
        
        # B. Linked Exams
        linked_exams = supabase.table("program_exam")\
            .select("exam_id, exam(total_marks, exam_date, exam_name)")\
            .eq("program_id", program_id)\
            .execute().data
            
        exam_ids = [e['exam_id'] for e in linked_exams]
        exam_map = {e['exam_id']: e['exam'] for e in linked_exams if e.get('exam')}
        
        # 2. Fetch DATA: Results & Attendance
        
        # A. Results (Filter by student_ids AND exam_ids)
        # Note: We manually filter because supabase-py "in_" is limited.
        # Actually, let's fetch results for these EXAMS, then filter by student_id in python
        if not exam_ids:
            results = []
        else:
            raw_results = supabase.table("student_individual_result")\
                .select("*")\
                .in_("exam_id", exam_ids)\
                .execute().data
            # Filter for our students only
            results = [r for r in raw_results if r['student_id'] in student_ids]

        # B. Attendance
        if not enrollment_ids:
            attendance_records = []
        else:
            attendance_records = supabase.table("attendance")\
                .select("status, date")\
                .in_("enrollment_id", enrollment_ids)\
                .execute().data

        # 2. Fetch Results (Granular: obtain written/mcq breakdown if available)
        # Note: We already fetched 'raw_results' above, but let's just re-use the clean logic here if needed.
        # actually, let's just ensure 'results' has the fields we need. 
        # The query at 188 was `select("*")`, which includes total/written/mcq.
        # So we don't need to re-fetch.
        
        # However, to be safe and clean, I will just ensure 'results' is populated correctly.
        # If exam_ids is empty, results is [].
        if not results and exam_ids:
             # Just in case the previous block failed or I am misreading.
             # The block 182-194 should have done it.
             pass
        
        # 3. Process Data per Exam
        exam_analytics = []
        
        for eid, exam_meta in exam_map.items():
            exam_results = [r for r in results if r['exam_id'] == eid]
            count = len(exam_results)
            
            if count == 0:
                continue

            # Aggregates
            total_sum = 0
            written_sum = 0
            mcq_sum = 0
            
            highest = 0
            lowest = 1000 # Arbitrary high
            
            # Setup Distribution Buckets for this exam
            # 0-40, 41-60, 61-80, 81-100
            dist = {
                "0-40%": 0,
                "41-60%": 0,
                "61-80%": 0,
                "81-100%": 0
            }
            
            max_marks = exam_meta.get('total_marks', 100) or 100
            
            for r in exam_results:
                score = r.get('total_score', 0) or 0
                # Try new column names first, fall back to old if needed (or 0)
                # Schema migration suggests 'written_marks' and 'mcq_marks'
                w_score = r.get('written_marks', 0) or r.get('obt_written_mark', 0) or 0
                m_score = r.get('mcq_marks', 0) or r.get('obt_mcq_mark', 0) or 0
                
                total_sum += score
                written_sum += w_score
                mcq_sum += m_score
                
                if score > highest: highest = score
                if score < lowest: lowest = score
                
                # Distribution
                pct = (score / max_marks) * 100
                if pct <= 40: dist["0-40%"] += 1
                elif pct <= 60: dist["41-60%"] += 1
                elif pct <= 80: dist["61-80%"] += 1
                else: dist["81-100%"] += 1

            # Averages
            avg_total = total_sum / count
            avg_written = written_sum / count
            avg_mcq = mcq_sum / count
            
            # Normalize to percentages if needed, but absolute marks usually preferred alongside Total.
            # Let's return averages as absolute values, frontend can handle display.

            exam_analytics.append({
                "exam_id": eid,
                "exam_name": exam_meta.get('exam_name', 'Unknown'),
                "date": exam_meta.get('exam_date', ''),
                "total_marks": max_marks,
                "metrics": {
                    "avg_total": round(avg_total, 1),
                    "avg_written": round(avg_written, 1),
                    "avg_mcq": round(avg_mcq, 1),
                    "highest": highest,
                    "lowest": lowest,
                    "student_count": count
                },
                "distribution": [
                    {"name": "0-40%", "value": dist["0-40%"]},
                    {"name": "41-60%", "value": dist["41-60%"]},
                    {"name": "61-80%", "value": dist["61-80%"]},
                    {"name": "81-100%", "value": dist["81-100%"]}
                ]
            })

        # Sort by date
        exam_analytics.sort(key=lambda x: x['date'] if x['date'] else '')

        # 4. Fetch Attendance (Use the records fetched in step 2B)
        # attendance = supabase.table("attendance").select("date, status").eq("program_id", program_id).execute().data
        # We process 'attendance_records' which we already fetched.
        
        att_map = {}
        for a in attendance_records:
            d = a['date']
            if d not in att_map: att_map[d] = {'p': 0, 't': 0}
            att_map[d]['t'] += 1
            if a['status'] == 'Present': att_map[d]['p'] += 1
            
        att_graph_data = []
        for d in sorted(att_map.keys()):
            pct = (att_map[d]['p'] / att_map[d]['t']) * 100
            att_graph_data.append({"date": d, "percentage": round(pct, 1)})

        return {
            "exams": exam_analytics,
            "attendance_trend": att_graph_data
        }
