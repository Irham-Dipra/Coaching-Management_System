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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-700">

                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-red-900/20 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                            <AlertTriangle size={24} />
                            Withdrawal: {enrollment.program?.program_name}
                        </h2>
                        <p className="text-red-300/80 text-sm mt-1">
                            Review outstanding dues below. Uncollected dues will be waived (lost).
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {isLoading ? (
                        <div className="text-center py-8 text-slate-500">Loading financial status...</div>
                    ) : (
                        <div className="space-y-6">

                            {/* Summary Box */}
                            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex justify-between items-center shadow-inner">
                                <div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Outstanding</p>
                                    <p className="text-2xl font-bold text-slate-200 mt-1">
                                        ৳ {totalDue.toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Collecting Now</p>
                                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                                        + ৳ {totalCollecting.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Ledger Table */}
                            {pendingMonths.length > 0 ? (
                                <div className="overflow-hidden rounded-lg border border-slate-700">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="bg-slate-800/50 text-slate-400 uppercase text-xs border-b border-slate-700">
                                                <th className="p-3 font-bold">Month</th>
                                                <th className="p-3 font-bold text-right">Paid So Far</th>
                                                <th className="p-3 font-bold text-red-400 text-right">Remaining Due</th>
                                                <th className="p-3 font-bold w-56">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {pendingMonths.map((m: any, idx: number) => {
                                                const monthKey = `${m.year}-${m.month}`;
                                                return (
                                                    <tr key={idx} className={`${isWaived[monthKey] ? "bg-slate-900 opacity-50" : "bg-slate-900/20"} hover:bg-slate-800/30 transition-colors`}>
                                                        <td className="p-3 font-medium text-slate-300">
                                                            {getMonthName(m.month, m.year)}
                                                        </td>
                                                        <td className="p-3 text-right text-emerald-400 font-medium">
                                                            {m.paid > 0 ? `৳ ${m.paid}` : '-'}
                                                        </td>
                                                        <td className="p-3 text-right font-bold text-red-400 text-base">
                                                            ৳ {m.due}
                                                        </td>
                                                        <td className="p-3 space-y-2">
                                                            {/* Payment Input */}
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-500">৳</span>
                                                                <input
                                                                    type="number"
                                                                    className="w-full border border-slate-600 bg-slate-800 text-white rounded px-2 py-1 text-right focus:ring-2 focus:ring-blue-500/50 outline-none disabled:bg-slate-900 disabled:text-slate-600"
                                                                    placeholder="0"
                                                                    max={m.due}
                                                                    value={paymentsToCollect[monthKey] || ''}
                                                                    onChange={(e) => handlePaymentChange(monthKey, e.target.value, m.due)}
                                                                    disabled={isWaived[monthKey]}
                                                                />
                                                            </div>
                                                            {/* Waive Checkbox */}
                                                            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none hover:text-slate-300">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!isWaived[monthKey]}
                                                                    onChange={() => toggleWaive(monthKey)}
                                                                    className="rounded text-red-500 focus:ring-red-500 bg-slate-800 border-slate-600"
                                                                />
                                                                Waive (Forgive)
                                                            </label>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-emerald-400 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                    <CheckCircle className="mx-auto mb-2" size={32} />
                                    <p className="font-bold text-lg">No outstanding dues!</p>
                                    <p className="text-sm opacity-80">You can safely withdraw this student.</p>
                                </div>
                            )}

                            <div className="bg-amber-500/10 p-4 rounded-lg border border-amber-500/20 text-sm text-amber-200/80 flex items-start gap-3">
                                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
                                <p>
                                    <strong className="text-amber-400">Warning:</strong> Confirming this will remove the enrollment from active lists.
                                    Any remaining dues shown above that are not collected now will be permanently waived/lost.
                                </p>
                            </div>

                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 font-medium hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 shadow-lg shadow-red-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isSubmitting ? 'Processing...' : 'Confirm Withdrawal'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WithdrawalModal;
