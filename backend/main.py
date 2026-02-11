# ==========================================
# The Entry Point (The "Reception Desk")
# ==========================================

import os
from fastapi import FastAPI
from app.routes.student_routes import router as student_router

app = FastAPI()

# ==========================================
# CORS Configuration
# ==========================================
from fastapi.middleware.cors import CORSMiddleware

# Read allowed origins from environment variable, fallback to localhost for dev
origins_str = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174")
allowed_origins = [origin.strip() for origin in origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Base Endpoint (Health Check)
#    This is a simple sanity check. If you go to http://localhost:8000/,
#    and see this message, you know the server is alive.
@app.get("/")
def read_root():
    return {"status": "Backend is running!"}

# 3. Register the Routers (Departments)
#    We built the 'student_router' in another file. 
#    Now we plug it into the main app.
#    It's like adding a "Student Department" sign to the building directory.
from app.routes import student_routes, program_routes, exam_routes, attendance_routes, payment_routes, schedule_routes, import_routes

app.include_router(student_routes.router, tags=["Students"])
app.include_router(program_routes.router, tags=["Programs"])
app.include_router(exam_routes.router, tags=["Exams"])
app.include_router(attendance_routes.router, tags=["Attendance"])
app.include_router(payment_routes.router, tags=["Payments"])
app.include_router(schedule_routes.router, tags=["Scheduling"])
app.include_router(import_routes.router, tags=["Bulk Operations"])