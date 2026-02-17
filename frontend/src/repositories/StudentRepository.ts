// This file is a "Repository". It's a design pattern.
// Instead of writing database code inside every button or page (which gets messy),
// we put all the "Student" related database commands here.

// ==========================================
// THE SWITCH: From Supabase Direct -> FastAPI
// ==========================================
// We are no longer using 'supabase' here. 
// We are using standard web 'fetch' to talk to our Python Backend.

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const StudentRepository = {

  // 1. Get All Students
  // 1. Get All Students (Legacy / Dropdowns)
  async getAllStudents() {
    // Call the Python API: GET /students/all (Non-paginated)
    const response = await fetch(`${API_BASE_URL}/students/all`);

    // Check if the server said "OK"
    if (!response.ok) {
      throw new Error("Failed to fetch students from Backend");
    }

    // Return the JSON data (List of students)
    return await response.json();
  },

  // 1.5 Get Students Paginated (For List View)
  async getStudentsPaginated(page: number, pageSize: number, search: string, rollSearch: string, filters: any) {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString()
    });
    if (search) params.append("search", search);
    if (rollSearch) params.append("roll_search", rollSearch);
    if (filters.class) params.append("class_filter", filters.class);
    if (filters.batch_id) params.append("batch_filter", filters.batch_id);
    if (filters.program_id) params.append("program_filter", filters.program_id);

    const response = await fetch(`${API_BASE_URL}/students?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch students");
    return await response.json();
  },

  // 2. Add Student
  async addStudent(studentData: any) {
    // Call the Python API: POST /students
    const response = await fetch(`${API_BASE_URL}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(studentData),
    });

    if (!response.ok) {
      throw new Error("Failed to add student via Backend");
    }

    return await response.json();
  },

  // 3. Get Single Student
  async getStudentById(id: string) {
    const response = await fetch(`${API_BASE_URL}/students/${id}`);
    if (!response.ok) throw new Error("Failed to fetch student details");
    return await response.json();
  },

  // 4. Update Student
  async updateStudent(id: string, updates: any) {
    const response = await fetch(`${API_BASE_URL}/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update student");
    return await response.json();
  },

  // 5. Get Enrollments
  async getEnrollments(studentId: string) {
    const response = await fetch(`${API_BASE_URL}/students/${studentId}/enrollments`);
    if (!response.ok) throw new Error("Failed to fetch enrollments");
    return await response.json();
  },

  // 6. Enroll Student
  async enrollStudent(data: { student_id: number, program_id: number }) {
    const response = await fetch(`${API_BASE_URL}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      // Try to parse error message
      const err = await response.json().catch(() => ({ detail: "Failed to enroll" }));
      throw new Error(err.detail || "Failed to enroll student");
    }
    return await response.json();
  },

  // 7. Delete Enrollment
  async deleteEnrollment(enrollmentId: number) {
    const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete enrollment");
    return await response.json();
  },

  // 8. Download Import Template
  async downloadTemplate() {
    const response = await fetch(`${API_BASE_URL}/student-imports/template`);
    if (!response.ok) throw new Error("Failed to download template");

    // Trigger download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "student_import_template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // 9. Import Students
  async importStudents(file: File, batchId?: number | string) {
    const formData = new FormData();
    formData.append('file', file);
    if (batchId) {
      formData.append('batch_id', String(batchId));
    }

    const response = await fetch(`${API_BASE_URL}/student-imports/data`, {
      method: 'POST',
      body: formData, // Auto-sets Content-Type to multipart
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Import failed");
    }
    return await response.json();
  },

  // 10. Register Student with Enrollment (Atomic)
  async registerStudentWithEnrollment(data: { student: any, program_ids: number[] }) {
    const response = await fetch(`${API_BASE_URL}/students/register-with-enrollment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to register student" }));
      throw new Error(err.detail || "Failed to register student");
    }
    return await response.json();
  },

  // 11. Get Financial Summary
  async getFinancialSummary(studentId: string) {
    const response = await fetch(`${API_BASE_URL}/students/${studentId}/financial-summary`);
    if (!response.ok) throw new Error("Failed to fetch financial summary");
    return await response.json();
  },

  // 12. Get Student Analytics
  async getStudentAnalytics(studentId: string) {
    const response = await fetch(`${API_BASE_URL}/students/${studentId}/analytics`);
    if (!response.ok) throw new Error("Failed to fetch student analytics");
    return await response.json();
  },

  // 13. Delete Student (Soft Delete)
  async deleteStudent(studentId: number) {
    const response = await fetch(`${API_BASE_URL}/students/${studentId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete student");
    return await response.json();
  }
}