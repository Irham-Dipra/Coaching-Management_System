import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentRepository } from '../repositories/StudentRepository';
import { X, DollarSign, Calendar } from 'lucide-react';

interface AdjustFeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    enrollment: any; // The enrollment object
    studentId: string;
}

const AdjustFeeModal: React.FC<AdjustFeeModalProps> = ({ isOpen, onClose, enrollment, studentId }) => {
    const defaultFee = enrollment?.program?.monthly_fee || 0;
    const currentAgreedFee = enrollment?.current_agreed_fee || defaultFee;

    const [newFee, setNewFee] = useState<string>(currentAgreedFee.toString());
    const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (data: { new_fee: number; effective_date: string }) =>
            StudentRepository.updateAgreedFee(enrollment.enrollment_id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enrollments', studentId] });
            queryClient.invalidateQueries({ queryKey: ['student-financial-summary', studentId] });
            queryClient.invalidateQueries({ queryKey: ['student', studentId] });
            onClose();
            alert("Fee adjusted successfully. The new fee will apply from the selected date.");
        },
        onError: (err: any) => {
            alert(err.message || "Failed to adjust fee.");
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const feeNum = parseFloat(newFee);
        if (isNaN(feeNum) || feeNum < 0) {
            alert("Please enter a valid amount.");
            return;
        }

        mutation.mutate({
            new_fee: feeNum,
            effective_date: effectiveDate
        });
    };

    if (!isOpen || !enrollment) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex justify-center items-center p-4 min-h-screen overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl animate-fade-in relative z-[80] my-8">
                <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <DollarSign className="text-blue-400" /> Adjust Agreed Fee
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700/50 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm">
                        <p className="font-bold text-blue-300">{enrollment.program?.program_name}</p>
                        <div className="mt-2 flex justify-between text-slate-300">
                            <span>Default Program Fee:</span>
                            <span className="font-mono">৳{defaultFee}</span>
                        </div>
                        <div className="flex justify-between text-slate-300 mt-1">
                            <span>Current Agreed Fee:</span>
                            <span className="font-mono font-bold text-white">৳{currentAgreedFee}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                            New Fee Amount (৳)
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3 text-slate-500" size={18} />
                            <input
                                type="number"
                                required
                                min="0"
                                step="any"
                                value={newFee}
                                onChange={e => setNewFee(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
                                placeholder={`e.g. ${defaultFee}`}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                            This amount will be used for all future monthly due calculations instead of the default program fee.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                            Effective Date
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 text-slate-500" size={18} />
                            <input
                                type="date"
                                required
                                min={enrollment?.enrollment_date}
                                value={effectiveDate}
                                onChange={e => setEffectiveDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                            This registers a changelog entry natively linking this fee to this specific date. Overpayment won't happen moving forward.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-slate-700/50 flex gap-3 justify-end mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl font-medium transition-colors border border-transparent hover:border-slate-600"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {mutation.isPending ? 'Saving...' : 'Save Fee Adjustment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdjustFeeModal;
