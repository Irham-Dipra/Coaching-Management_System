import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PaymentRepository } from '../repositories/PaymentRepository';

interface EditPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    payment: any;
}

const EditPaymentModal: React.FC<EditPaymentModalProps> = ({ isOpen, onClose, payment }) => {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (payment) {
            // Support new backend format: total_amount vs paid_amount
            const amt = payment.amount || payment.total_amount || payment.paid_amount || 0;
            setAmount(amt.toString());
            setMethod(payment.payment_method || 'Cash');
            setRemarks(payment.remarks || '');
        }
    }, [payment]);

    // Check if Bulk
    const isBulk = payment?.type === 'Bulk';

    // Fetch Payment Status to determine Cap
    const { data: status } = useQuery({
        queryKey: ['payment_status', payment?.enrollment_id], // Use enrollment_id from payment
        queryFn: () => payment ? PaymentRepository.getPaymentStatus(payment.enrollment_id) : null,
        enabled: !!payment?.enrollment_id
    });

    const [maxCap, setMaxCap] = useState<number>(Infinity);

    useEffect(() => {
        if (payment && status && status.ledger) {
            // Determine Year/Month from payment
            let pMonth = payment.month;
            let pYear = payment.year;

            // Fallback for new structure if top-level month/year missing
            if (!pMonth && payment.sub_payments && payment.sub_payments.length > 0) {
                pMonth = payment.sub_payments[0].month;
                pYear = payment.sub_payments[0].year;
            }

            // Find ledger entry for this payment's month
            const entry = status.ledger.find((l: any) => l.month === pMonth && l.year === pYear);
            if (entry) {
                // Cap = Amount Already Paid by THIS transaction + Remaining Due
                // entry.due is (Fee - TotalPaid).
                // Max we can set this transaction to is (CurrentValue + Due).
                // Example: Fee 5000, Paid 3000 (this), Due 2000. Max = 3000+2000 = 5000.

                // Be careful: payment.amount is the currently saved amount. 
                // We typically receive it in 'payment' prop.
                const currentSavedAmount = payment.amount || payment.total_amount || payment.paid_amount || 0;

                const allowed = currentSavedAmount + entry.due;
                setMaxCap(allowed);
            }
        }
    }, [payment, status]);

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            // Use sort_id if grouped, else payment_id
            const pid = payment.sort_id || payment.payment_id;
            return PaymentRepository.updatePayment(pid, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats-quick'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats-dues'] });
            queryClient.invalidateQueries({ queryKey: ['program_finance'] });
            queryClient.invalidateQueries({ queryKey: ['finance_breakdown'] });
            queryClient.invalidateQueries({ queryKey: ['payment_status'] });
            onClose();
            alert("Payment Updated!");
        },
        onError: (err) => alert("Failed to update: " + err)
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(amount);
        if (val > maxCap) {
            alert(`Amount exceeds the maximum allowed (${maxCap}) for this month.`);
            return;
        }

        mutation.mutate({
            paid_amount: val,
            payment_method: method,
            remarks: remarks
        });
    };

    if (!isOpen || !payment) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                <h3 className="font-bold text-xl text-white mb-4">Edit Payment #{payment.payment_id}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-emerald-400 mb-1">
                            Amount (Max: {maxCap !== Infinity ? maxCap : '...'})
                        </label>
                        <input
                            type="number"
                            required
                            className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900 text-emerald-400 font-bold text-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={amount}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={e => {
                                const val = parseFloat(e.target.value);
                                if (val > maxCap) {
                                    alert(`Value must not exceed ৳${maxCap !== Infinity ? maxCap : '...'}`);
                                    setAmount(maxCap.toString());
                                } else {
                                    setAmount(e.target.value);
                                }
                            }}
                            max={maxCap}
                            disabled={isBulk} // Disable amount edit for bulk
                            title={isBulk ? "Cannot edit amount for bulk payments directly. Delete and re-enter if needed." : ""}
                        />
                        {isBulk && <p className="text-xs text-amber-500 mt-1">Bulk payment amounts cannot be edited directly.</p>}
                        {maxCap !== Infinity && (
                            <p className="text-xs text-slate-500 mt-1">
                                Fee: {payment?.paid_amount + (maxCap - payment?.paid_amount)} | Cap reflects adjusted fee limit.
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Method</label>
                        <select className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={method} onChange={e => setMethod(e.target.value)}>
                            <option>Cash</option>
                            <option>Bank Transfer</option>
                            <option>bKash</option>
                            <option>Nagad</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Remarks</label>
                        <textarea className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-300 hover:bg-slate-700 rounded-xl font-medium transition-colors">Cancel</button>
                        <button type="submit" disabled={mutation.isPending} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-500 hover:scale-105 transition-all">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditPaymentModal;
