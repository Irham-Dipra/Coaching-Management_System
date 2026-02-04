const API_BASE_URL = "http://127.0.0.1:8000";

export const PaymentRepository = {
    // Get recent payments (Ledger)
    async getRecentPayments() {
        const response = await fetch(`${API_BASE_URL}/payments/recent`);
        if (!response.ok) throw new Error("Failed to fetch payments");
        return await response.json();
    },

    // Record new payment
    async createPayment(payment: any) {
        // Fallback for single payment, wrapping it in bulk structure or keeping separate?
        // User backend now has 'create_bulk_payment'. 
        // Let's implement 'createBulkPayment' for the new logic, and maybe keep this for legacy if needed, 
        // or redirect. For now, we add the new ones.
        const response = await fetch(`${API_BASE_URL}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payment)
        });
        if (!response.ok) throw new Error("Failed to record payment");
        return await response.json();
    },

    // New: Bulk Payment (Atomic)
    async createBulkPayment(payments: any[]) {
        const response = await fetch(`${API_BASE_URL}/payments/bulk`, {
            method: "POST", // We need to ensure we have a route for this!
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payments)
        });
        if (!response.ok) throw new Error("Failed to record bulk payment");
        return await response.json();
    },

    // Update Payment
    async updatePayment(id: number, data: any) {
        const response = await fetch(`${API_BASE_URL}/payments/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to update payment");
        return await response.json();
    },

    // New: Get Payment Status (Ledger)
    async getPaymentStatus(enrollmentId: number) {
        const response = await fetch(`${API_BASE_URL}/enrollments/${enrollmentId}/payment-status`);
        if (!response.ok) throw new Error("Failed to fetch payment status");
        return await response.json();
    },

    // Get student history
    async getStudentPayments(studentId: number) {
        const response = await fetch(`${API_BASE_URL}/students/${studentId}/payments`);
        if (!response.ok) throw new Error("Failed to fetch student payments");
        return await response.json();
    },

    // Get Overall Stats
    async getFinanceStats() {
        const response = await fetch(`${API_BASE_URL}/finance/stats`);
        if (!response.ok) throw new Error("Failed to fetch finance stats");
        return await response.json();
    },

    // Get Program Breakdown
    async getProgramStats() {
        const response = await fetch(`${API_BASE_URL}/finance/programs`);
        if (!response.ok) throw new Error("Failed to fetch program stats");
        return await response.json();
    }
};
