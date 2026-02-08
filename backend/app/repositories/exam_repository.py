from app.core.supabase import supabase
from app.schemas.exam import ExamCreate
from fastapi.encoders import jsonable_encoder

class ExamRepository:
    def __init__(self):
        self.table = "exam"

    def get_exams_by_program(self, program_id: int):
        # Fetch exams linked to this program via junction table
        # We query program_exam table and select the nested exam data
        response = supabase.table("program_exam")\
            .select("exam(*)")\
            .eq("program_id", program_id)\
            .execute()
        
        # Flatten structure: [ {exam: {...}}, ... ] -> [ {...}, ... ]
        exams = [item['exam'] for item in response.data if item.get('exam')]
        # Sort manually since we can't easily order by nested field in this query type easily without rpc
        exams.sort(key=lambda x: x['exam_date'] or '', reverse=True)
        return exams

    def get_all_exams(self):
        # Fetch all exams and their linked programs
        # program_exam(program(...))
        response = supabase.table(self.table)\
            .select("*, program_exam(program(program_id, program_name, batch(batch_name)))")\
            .order("exam_date", desc=True)\
            .execute()
        return response.data

    def get_exam_by_id(self, exam_id: int):
        response = supabase.table(self.table)\
            .select("*, program_exam(program(program_id, program_name))")\
            .eq("exam_id", exam_id)\
            .execute()
        return response.data[0] if response.data else None

    def create_exam(self, exam: ExamCreate):
        # 1. Prepare Exam Data (exclude program_ids)
        exam_data = jsonable_encoder(exam)
        program_ids = exam_data.pop('program_ids', [])
        
        # 2. Insert Exam
        response = supabase.table(self.table).insert(exam_data).execute()
        new_exam = response.data[0]
        new_exam_id = new_exam['exam_id']
        
        # 3. Insert Junction Rows (Program <-> Exam)
        if program_ids:
            junction_data = [{"exam_id": new_exam_id, "program_id": pid} for pid in program_ids]
            supabase.table("program_exam").insert(junction_data).execute()
            
        return new_exam

    def delete_exam(self, exam_id: int):
        supabase.table(self.table).delete().eq("exam_id", exam_id).execute()
        return True

    def update_exam(self, exam_id: int, exam: ExamCreate):
        # 1. Prepare Exam Data
        exam_data = jsonable_encoder(exam)
        new_program_ids = set(exam_data.pop('program_ids', []))

        # 2. Update Exam Details
        supabase.table(self.table).update(exam_data).eq("exam_id", exam_id).execute()

        # 3. Update Junction Rows (Program <-> Exam)
        # Fetch existing links
        current_links = supabase.table("program_exam").select("program_id").eq("exam_id", exam_id).execute().data
        current_program_ids = set([link['program_id'] for link in current_links])

        # Determine changes
        to_add = new_program_ids - current_program_ids
        to_remove = current_program_ids - new_program_ids

        # Execute updates
        if to_remove:
            # Clean up junction
            supabase.table("program_exam").delete().eq("exam_id", exam_id).in_("program_id", list(to_remove)).execute()
            
            # User requested to KEEP results even if program is removed.
            # No result cleanup here.
        
        if to_add:
            junction_data = [{"exam_id": exam_id, "program_id": pid} for pid in to_add]
            supabase.table("program_exam").insert(junction_data).execute()

        return self.get_exam_by_id(exam_id)
