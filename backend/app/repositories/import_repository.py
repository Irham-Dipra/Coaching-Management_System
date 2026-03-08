import pandas as pd
from fastapi import UploadFile, HTTPException
from io import BytesIO
from app.core.supabase import supabase
from app.core.students_cache import invalidate_students_cache

class ImportRepository:
    def __init__(self):
        self.student_table = "student"

    def get_template(self):
        # Create a DataFrame with expected columns
        columns = [
            "name", 
            "fathers_name", 
            "class", 
            "school", 
            "contact"
        ]
        df = pd.DataFrame(columns=columns)
        
        # Save to bytes
        output = BytesIO()
        # Use openpyxl engine explicitly
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Students')
        
        output.seek(0)
        return output

    async def process_student_import(self, file: UploadFile, batch_id: int = None):
        try:
            # Read the file
            contents = await file.read()
            df = pd.read_excel(BytesIO(contents))
            
            # Simple validation: Check required columns
            required_cols = ["name", "class"]
            missing = [col for col in required_cols if col not in df.columns]
            if missing:
                raise HTTPException(400, f"Missing required columns: {missing}")

            # Prepare data for insertion
            # Replace NaN with None (Python null) so Supabase accepts it as NULL
            df = df.where(pd.notnull(df), None)
            
            students_to_insert = []
            for _, row in df.iterrows():
                student = {
                    "name": row.get("name"),
                    "fathers_name": row.get("fathers_name"),
                    "class": row.get("class"),
                    "school": row.get("school"),
                    "contact": str(row.get("contact")) if row.get("contact") else None,
                    "batch_id": batch_id  # Assign to batch if provided
                }
                students_to_insert.append(student)

            # Bulk Insert
            if students_to_insert:
                response = supabase.table(self.student_table).insert(students_to_insert).execute()
                # New students must appear in the paginated list immediately
                invalidate_students_cache()
                return {"message": "Success", "count": len(response.data)}
                return {"message": "No data found in file", "count": 0}

        except Exception as e:
            print(f"Import Error: {e}")
            raise HTTPException(400, f"Failed to process file: {str(e)}")
