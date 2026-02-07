import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

interface WithdrawalModalProps {
    isOpen: boolean;
    onClose: () => void;
    enrollment: any;
    studentId: string;
    onSuccess: () => void;
}

const WithdrawalModal: React.FC<WithdrawalModalProps> = ({ isOpen, onClose, enrollment, studentId, onSuccess }) => {
    const queryClient = useQueryClient();
    const [paymentsToCollect, setPaymentsToCollect] = useState<Record<string, number>>({});
    const [isWaived, setIsWaived] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Fetch Ledger (Due Status)
    const { data: paymentStatus, isLoading } = useQuery({
        queryKey: ['payment-status', enrollment?.enrollment_id],
        queryFn: () => PaymentRepository.getPaymentStatus(enrollment.enrollment_id),
        enabled: !!enrollment && isOpen
    });

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPaymentsToCollect({});
            setIsWaived({});
            setIsSubmitting(false);
        }
    }, [isOpen, enrollment]);

    if (!isOpen || !enrollment) return null;

    // Filter only months with dues AND are not in the future (Past/Present only)
    const pendingMonths = paymentStatus?.ledger?.filter((m: any) => m.status !== 'Paid' && !m.is_future) || [];
    const totalDue = pendingMonths.reduce((sum: number, m: any) => sum + (m.due || 0), 0);
    const totalCollecting = Object.values(paymentsToCollect).reduce((sum, val) => sum + (val || 0), 0);

    // Helper for Month Name
    const getMonthName = (m: number, y: number) => {
        const date = new Date(y, m - 1);
        return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const handlePaymentChange = (monthKey: string, value: string, maxDue: number) => {
        const amount = parseFloat(value);
        if (isNaN(amount) || amount < 0) {
            const newPayments = { ...paymentsToCollect };
            delete newPayments[monthKey];
            setPaymentsToCollect(newPayments);
            return;
        }
        // Cap at Max Due
        const finalAmount = Math.min(amount, maxDue);
        setPaymentsToCollect(prev => ({ ...prev, [monthKey]: finalAmount }));

        // If paying, uncheck waive
        if (finalAmount > 0) {
            setIsWaived(prev => ({ ...prev, [monthKey]: false }));
        }
    };

    const toggleWaive = (monthKey: string) => {
        setIsWaived(prev => {
            const newState = !prev[monthKey];
            // If waiving, remove payment
            if (newState) {
                setPaymentsToCollect(curr => {
                    const copy = { ...curr };
                    delete copy[monthKey];
                    return copy;
                });
            }
            return { ...prev, [monthKey]: newState };
        });
    };

    const handleConfirm = async () => {
        if (!confirm("Are you sure you want to withdraw this student? This action cannot be undone efficiently.")) return;

        setIsSubmitting(true);
        try {
            // A. Process Payments 
            // Only create records for collected amounts. Waived amounts are ignored (lost).
            const paymentPromises = Object.entries(paymentsToCollect).map(([key, amount]) => {
                if (amount <= 0) return null;
                // Find data by key (YYYY-M)
                const monthData = pendingMonths.find((m: any) => `${m.year}-${m.month}` === key);
                if (!monthData) return null;

                const paymentPayload = {
                    student_id: parseInt(studentId),
                    program_id: enrollment.program_id, // REQUIRED by Backend Schema
                    // enrollment_id: enrollment.enrollment_id, // Schema ignores this, backend looks it up via student+program
                    paid_amount: amount, // Schema expects 'paid_amount', not 'amount'
                    payment_date: new Date().toISOString().split('T')[0],
                    payment_method: "Cash", // Required by Schema
                    remarks: `Withdrawal settlement for ${getMonthName(monthData.month, monthData.year)}`,
                    month: monthData.month,
                    year: monthData.year
                };
                return PaymentRepository.createPayment(paymentPayload);
            }).filter(Boolean);

            if (paymentPromises.length > 0) {
                await Promise.all(paymentPromises);
            }

            // B. Delete Enrollment (Soft Delete via Backend if payments exist)
            await StudentRepository.deleteEnrollment(enrollment.enrollment_id);

            // C. Success
            queryClient.invalidateQueries({ queryKey: ['enrollments', studentId] });
            queryClient.invalidateQueries({ queryKey: ['payment-status'] });
            queryClient.invalidateQueries({ queryKey: ['student-financial-summary', studentId] }); // Refresh profile summary
            onSuccess();
            onClose();

        } catch (error: any) {
            alert(`Error processing withdrawal: ${error.message}`);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-red-50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
                            <AlertTriangle size={24} />
                            Withdrawal: {enrollment.program?.program_name}
                        </h2>
                        <p className="text-red-600 text-sm mt-1">
                            Review outstanding dues below. Uncollected dues will be waived (lost).
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-red-800">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="text-center py-8">Loading financial status...</div>
                    ) : (
                        <div className="space-y-6">

                            {/* Summary Box */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex justify-between items-center">
                                <div>
                                    <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Total Outstanding</p>
                                    <p className="text-2xl font-bold text-gray-800">
                                        ৳ {totalDue.toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Collecting Now</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        + ৳ {totalCollecting.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Ledger Table */}
                            {pendingMonths.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-left border-b">
                                            <th className="p-3 font-semibold text-gray-600">Month</th>
                                            <th className="p-3 font-semibold text-gray-600 text-right">Paid So Far</th>
                                            <th className="p-3 font-bold text-red-600 text-right">Remaining Due</th>
                                            <th className="p-3 font-semibold text-gray-600 w-56">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {pendingMonths.map((m: any, idx: number) => {
                                            const monthKey = `${m.year}-${m.month}`;
                                            return (
                                                <tr key={idx} className={isWaived[monthKey] ? "bg-gray-50 opacity-60" : ""}>
                                                    <td className="p-3 font-medium text-gray-800">
                                                        {getMonthName(m.month, m.year)}
                                                    </td>
                                                    <td className="p-3 text-right text-green-600 font-medium">
                                                        {m.paid > 0 ? `৳ ${m.paid}` : '-'}
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-red-600 text-base">
                                                        ৳ {m.due}
                                                    </td>
                                                    <td className="p-3 space-y-2">
                                                        {/* Payment Input */}
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-gray-400">৳</span>
                                                            <input
                                                                type="number"
                                                                className="w-full border rounded px-2 py-1 text-right focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                                                                placeholder="0"
                                                                max={m.due}
                                                                value={paymentsToCollect[monthKey] || ''}
                                                                onChange={(e) => handlePaymentChange(monthKey, e.target.value, m.due)}
                                                                disabled={isWaived[monthKey]}
                                                            />
                                                        </div>
                                                        {/* Waive Checkbox */}
                                                        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!isWaived[monthKey]}
                                                                onChange={() => toggleWaive(monthKey)}
                                                                className="rounded text-red-500 focus:ring-red-500"
                                                            />
                                                            Waive
                                                        </label>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8 text-green-600 bg-green-50 rounded-lg border border-green-100">
                                    <CheckCircle className="mx-auto mb-2" />
                                    <p className="font-bold">No outstanding dues!</p>
                                    <p className="text-sm">You can safely withdraw this student.</p>
                                </div>
                            )}

                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800 flex items-start gap-3">
                                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                <p>
                                    <strong>Warning:</strong> Confirming this will remove the enrollment from active lists.
                                    Any remaining dues shown above that are not collected now will be permanently waived/lost.
                                </p>
                            </div>

                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3 transition-opacity">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Processing...' : 'Confirm Withdrawal'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WithdrawalModal;
