const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const ProgramRepository = {
    // ==========================
    // BATCHES
    // ==========================
    async getAllBatches() {
        const response = await fetch(`${API_BASE_URL}/batches`);
        if (!response.ok) throw new Error("Failed to fetch batches");
        return await response.json();
    },

    async createBatch(batchData: { batch_name: string }) {
        const response = await fetch(`${API_BASE_URL}/batches`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batchData),
        });
        if (!response.ok) throw new Error("Failed to create batch");
        return await response.json();
    },

    async getBatchById(id: string) {
        const response = await fetch(`${API_BASE_URL}/batches/${id}`);
        if (!response.ok) throw new Error("Failed to fetch batch details");
        return await response.json();
    },

    async updateBatch(id: string, batchData: any) {
        const response = await fetch(`${API_BASE_URL}/batches/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batchData),
        });
        if (!response.ok) throw new Error("Failed to update batch");
        return await response.json();
    },

    // ==========================
    // PROGRAMS
    // ==========================
    async getAllPrograms() {
        const response = await fetch(`${API_BASE_URL}/programs`);
        if (!response.ok) throw new Error("Failed to fetch programs");
        return await response.json();
    },

    async getProgramById(id: string) {
        const response = await fetch(`${API_BASE_URL}/programs/${id}`);
        if (!response.ok) throw new Error("Failed to fetch program details");
        return await response.json();
    },

    async createProgram(programData: any) {
        const response = await fetch(`${API_BASE_URL}/programs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(programData),
        });
        if (!response.ok) throw new Error("Failed to create program");
        return await response.json();
    },

    async updateProgram(id: string, programData: any) {
        const response = await fetch(`${API_BASE_URL}/programs/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(programData),
        });
        if (!response.ok) throw new Error("Failed to update program");
        return await response.json();
    },

    async deleteProgram(id: string) {
        const response = await fetch(`${API_BASE_URL}/programs/${id}`, {
            method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete program");
        return await response.json();
    },

    async getProgramAnalytics(id: string) {
        const response = await fetch(`${API_BASE_URL}/programs/${id}/analytics`);
        if (!response.ok) throw new Error("Failed to fetch analytics");
        return await response.json();
    },

    async getBatchAnalytics(id: string) {
        const response = await fetch(`${API_BASE_URL}/batches/${id}/analytics`);
        if (!response.ok) throw new Error("Failed to fetch batch analytics");
        return await response.json();
    }
};
