import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StudentRepository } from '../repositories/StudentRepository'; // For Summary
import { PaymentRepository } from '../repositories/PaymentRepository'; // For History
import { DollarSign, AlertCircle, FileText, CheckSquare, Calendar } from 'lucide-react';

interface StudentFinancialStatusProps {
    studentId: string;
}

const StudentFinancialStatus: React.FC<StudentFinancialStatusProps> = ({ studentId }) => {
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // 1. Fetch Financial Summary
    const { data: summary, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['financialSummary', studentId],
        queryFn: () => StudentRepository.getFinancialSummary(studentId),
        enabled: !!studentId
    });

    // 2. Fetch Payment History
    const { data: history, isLoading: isLoadingHistory } = useQuery({
        queryKey: ['studentPayments', studentId],
        queryFn: () => PaymentRepository.getStudentPayments(parseInt(studentId)),
        enabled: !!studentId
    });

    if (isLoadingSummary) return <div className="p-4 text-center text-gray-400">Loading financial status...</div>;
    if (!summary) return null;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign size={20} className="text-slate-400" />
                Financial Overview
            </h3>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Total Paid -> Opens History Modal */}
                <div
                    onClick={() => setShowHistory(true)}
                    className="bg-slate-800/50 backdrop-blur-md p-5 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-700/50 hover:border-blue-500/30 transition-all group"
                >
                    <div className="text-left">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider group-hover:text-blue-400 transition-colors">Total Paid</p>
                        <p className="text-2xl font-bold text-emerald-400 mt-1">৳{summary.total_paid?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                        <FileText size={24} />
                    </div>
                </div>

                {/* Total Outstanding -> Opens Breakdown Modal */}
                <div
                    onClick={() => setShowBreakdown(true)}
                    className="bg-slate-800/50 backdrop-blur-md p-5 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-700/50 hover:border-red-500/30 transition-all group"
                >
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider group-hover:text-red-400 transition-colors">Total Due</p>
                        <p className={`text-2xl font-bold mt-1 ${summary.total_due > 0 ? 'text-red-400' : 'text-slate-200'}`}>
                            ৳{summary.total_due?.toLocaleString()}
                        </p>
                    </div>
                    <div className={`p-3 rounded-full border group-hover:scale-110 transition-transform ${summary.total_due > 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                        <AlertCircle size={24} />
                    </div>
                </div>
            </div>

            {/* HISTORY MODAL (Replaces Accordion) */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 max-w-4xl w-full p-6 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                <FileText className="text-emerald-500" /> Payment History
                            </h2>
                            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                            {isLoadingHistory ? (
                                <div className="p-8 text-center text-slate-500 animate-pulse">Loading payment history...</div>
                            ) : history?.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl bg-slate-800/30">
                                    <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>No payments recorded yet.</p>
                                </div>
                            ) : (
                                <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-900/50 border-b border-slate-700 text-slate-400 uppercase text-xs sticky top-0 backdrop-blur-sm z-10">
                                            <tr>
                                                <th className="p-4 font-semibold">Date</th>
                                                <th className="p-4 font-semibold">Receipt #</th>
                                                <th className="p-4 font-semibold">Program</th>
                                                <th className="p-4 font-semibold">Months</th>
                                                <th className="p-4 text-right font-semibold">Amount</th>
                                                <th className="p-4 text-center font-semibold">Type</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50">
                                            {history?.map((p: any) => (
                                                <tr key={p.raw_group_id || p.sort_id} className="hover:bg-slate-700/50 transition-colors group">
                                                    <td className="p-4 text-slate-300 font-medium">{p.payment_date}</td>
                                                    <td className="p-4 font-mono text-xs text-slate-500 group-hover:text-blue-400 transition-colors">#{p.sort_id}</td>
                                                    <td className="p-4 font-medium text-slate-200">{p.program_name}</td>
                                                    <td className="p-4 text-slate-400 text-xs">{p.date_display || '-'}</td>
                                                    <td className="p-4 text-right font-bold text-emerald-400">৳{p.total_amount?.toLocaleString()}</td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold border ${p.type === 'Bulk' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600'
                                                            }`}>
                                                            {p.type}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end pt-4 border-t border-slate-800">
                            <button
                                onClick={() => setShowHistory(false)}
                                className="px-5 py-2.5 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 font-medium transition-colors border border-slate-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BREAKDOWN MODAL */}
            {showBreakdown && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 max-w-2xl w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                <AlertCircle className="text-red-500" /> Due Breakdown
                            </h2>
                            <button onClick={() => setShowBreakdown(false)} className="text-slate-400 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {summary.breakdown.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                                    <CheckSquare size={48} className="mb-4 text-emerald-500/50" />
                                    <p className="text-lg text-emerald-400 font-medium">All Dues Cleared!</p>
                                    <p className="text-sm">No outstanding balances found.</p>
                                </div>
                            ) : (
                                summary.breakdown.map((item: any, idx: number) => (
                                    <div key={idx} className="border border-slate-700 rounded-lg p-4 hover:border-red-500/30 transition-colors bg-slate-800/20">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-200 text-lg">{item.program_name}</h4>
                                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                    <Calendar size={12} /> Joined: {new Date(item.enrollment_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`block font-bold text-xl ${item.due_amount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {item.due_amount > 0 ? `Due: ৳${item.due_amount.toLocaleString()}` : 'Clear'}
                                                </span>
                                                <span className="text-xs text-slate-500 font-mono">Fee: ৳{item.monthly_fee}/mo</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-900/50 border border-slate-700/50 p-3 rounded-lg text-sm flex justify-between items-center mt-3">
                                            <span className="text-slate-400 font-medium">Paid Up To</span>
                                            <span className="font-bold text-blue-400">{item.paid_up_to || 'None'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 flex justify-end pt-4 border-t border-slate-800">
                            <button
                                onClick={() => setShowBreakdown(false)}
                                className="px-5 py-2.5 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 font-medium transition-colors border border-slate-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentFinancialStatus;
