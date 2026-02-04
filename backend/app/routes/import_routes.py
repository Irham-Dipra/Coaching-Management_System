from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse
from app.repositories.import_repository import ImportRepository

router = APIRouter()
repo = ImportRepository()

@router.get("/student-imports/template")
def get_template():
    # Returns an Excel file
    stream = repo.get_template()
    headers = {
        'Content-Disposition': 'attachment; filename="student_import_template.xlsx"'
    }
    return StreamingResponse(stream, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)

@router.post("/student-imports/data")
async def import_students(file: UploadFile = File(...)):
    return await repo.process_student_import(file)
