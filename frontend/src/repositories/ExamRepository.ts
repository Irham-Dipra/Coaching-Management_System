const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const ExamRepository = {
    // 0. Get All Exams (Global)
    async getAllExams() {
        const response = await fetch(`${API_BASE_URL}/exams`);
        if (!response.ok) throw new Error("Failed to fetch all exams");
        return await response.json();
    },

    // 1. Get Exams for a Program
    async getExamsByProgram(programId: string) {
        const response = await fetch(`${API_BASE_URL}/programs/${programId}/exams`);
        if (!response.ok) throw new Error("Failed to fetch exams");
        return await response.json();
    },

    // 2. Get Single Exam Details
    async getExamById(examId: string) {
        const response = await fetch(`${API_BASE_URL}/exams/${examId}`);
        if (!response.ok) throw new Error("Failed to fetch exam details");
        return await response.json();
    },

    // 3. Create Exam
    async createExam(examData: any) {
        const response = await fetch(`${API_BASE_URL}/exams`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(examData),
        });
        if (!response.ok) throw new Error("Failed to create exam");
        return await response.json();
    },

    // 3b. Update Exam
    async updateExam(examId: string, examData: any) {
        const response = await fetch(`${API_BASE_URL}/exams/${examId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(examData),
        });
        if (!response.ok) throw new Error("Failed to update exam");
        return await response.json();
    },

    // 3c. Delete Exam
    async deleteExam(examId: string) {
        const response = await fetch(`${API_BASE_URL}/exams/${examId}`, {
            method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete exam");
        return await response.json();
    },

    // 4. Get Analytics
    async getAnalytics(examId: string) {
        const response = await fetch(`${API_BASE_URL}/exams/${examId}/analytics`);
        if (!response.ok) throw new Error("Failed to fetch analytics");
        return await response.json();
    },

    // 5. Get Merit List (Results)
    async getMeritList(examId: string) {
        const response = await fetch(`${API_BASE_URL}/exams/${examId}/results`);
        if (!response.ok) throw new Error("Failed to fetch merit list");
        return await response.json();
    },

    // 5b. Get All Candidates (For Manual Entry)
    async getCandidates(examId: string) {
        const response = await fetch(`${API_BASE_URL}/exams/${examId}/candidates`);
        if (!response.ok) throw new Error("Failed to fetch candidates");
        return await response.json();
    },

    // 6. Submit Bulk Results
    async submitBulkResults(data: { exam_id: number, results: any[] }) {
        const response = await fetch(`${API_BASE_URL}/results/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to submit results");
        return await response.json();
    }
};
