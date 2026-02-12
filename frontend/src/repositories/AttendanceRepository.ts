const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const AttendanceRepository = {
    // Get daily attendance sheet (Students + Status)
    async getDailyAttendance(programId: string, date: string) {
        const response = await fetch(`${API_BASE_URL}/programs/${programId}/attendance?date=${date}`);
        if (!response.ok) throw new Error("Failed to fetch attendance");
        return await response.json();
    },

    // Submit bulk attendance
    async submitAttendance(programId: number, date: string, records: any[]) {
        const response = await fetch(`${API_BASE_URL}/attendance/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                program_id: programId,
                date: date,
                records: records
            })
        });
        if (!response.ok) throw new Error("Failed to submit attendance");
        return await response.json();
    }
};
