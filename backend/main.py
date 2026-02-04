# ==========================================
# The Entry Point (The "Reception Desk")
# ==========================================
# This file is where the application starts. 
# When you run the server, it looks for 'app' inside this file.

from fastapi import FastAPI
from app.routes.student_routes import router as student_router

# 1. Initialize the Application
#    This creates the main object that will receive ALL web requests.
app = FastAPI()

# ==========================================
# 4. CORS Details (Security Gate)
# ==========================================
# Browsers block requests between different ports (5173 vs 8000) by default.
# We need to explicitly allow our Frontend URL.
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    # Allow the React App running on this Port:
    allow_origins=["http://localhost:5173", "http://localhost:5174"], 
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods (GET, POST, etc.)
    allow_headers=["*"], # Allow all headers
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
from app.routes import student_routes, program_routes, exam_routes, attendance_routes, payment_routes, schedule_routes

app.include_router(student_routes.router, tags=["Students"])
app.include_router(program_routes.router, tags=["Programs"])
app.include_router(exam_routes.router, tags=["Exams"])
app.include_router(attendance_routes.router, tags=["Attendance"])
app.include_router(payment_routes.router, tags=["Payments"])
app.include_router(schedule_routes.router, tags=["Scheduling"])