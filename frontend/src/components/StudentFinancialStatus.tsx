import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StudentRepository } from '../repositories/StudentRepository'; // For Summary
import { PaymentRepository } from '../repositories/PaymentRepository'; // For History
import { DollarSign, AlertCircle, FileText, ChevronDown, ChevronUp, Clock, Calendar } from 'lucide-react';

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
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <DollarSign size={20} className="text-gray-500" />
                Financial Overview
            </h3>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Total Paid */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Paid</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">৳{summary.total_paid?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-full text-green-600">
                        <FileText size={24} />
                    </div>
                </div>

                {/* Total Outstanding */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Outstanding Balance</p>
                        <p className={`text-2xl font-bold mt-1 ${summary.total_due > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                            ৳{summary.total_due?.toLocaleString()}
                        </p>
                    </div>
                    <div className={`p-3 rounded-full ${summary.total_due > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                        <AlertCircle size={24} />
                    </div>
                </div>
            </div>

            {/* ACTION ROW */}
            <div className="flex gap-4">
                <button
                    onClick={() => setShowBreakdown(true)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                    View Detailed Breakdown
                </button>
            </div>

            {/* PAYMENT HISTORY TOGGLE */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                    <span className="font-semibold text-gray-700">Payment History</span>
                    {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {showHistory && (
                    <div className="p-0">
                        {isLoadingHistory ? (
                            <div className="p-4 text-center text-gray-400">Loading history...</div>
                        ) : history?.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No payments recorded yet.</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-xs">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Receipt #</th>
                                        <th className="p-3">Program</th>
                                        <th className="p-3">Months</th>
                                        <th className="p-3 text-right">Amount</th>
                                        <th className="p-3 text-center">Type</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {history?.map((p: any) => (
                                        <tr key={p.raw_group_id || p.sort_id} className="hover:bg-gray-50">
                                            <td className="p-3 text-gray-600">{p.payment_date}</td>
                                            <td className="p-3 font-mono text-xs text-gray-400">#{p.sort_id}</td>
                                            <td className="p-3 font-medium text-gray-800">{p.program_name}</td>
                                            <td className="p-3 text-gray-600">{p.date_display || '-'}</td>
                                            <td className="p-3 text-right font-bold text-gray-700">৳{p.total_amount?.toLocaleString()}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${p.type === 'Bulk' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-gray-100 text-gray-600 border-gray-200'
                                                    }`}>
                                                    {p.type}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* BREAKDOWN MODAL */}
            {showBreakdown && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <FileText className="text-blue-600" /> Due Breakdown
                            </h2>
                            <button onClick={() => setShowBreakdown(false)} className="text-gray-400 hover:text-gray-600">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            {summary.breakdown.map((item: any, idx: number) => (
                                <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-blue-200 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{item.program_name}</h4>
                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                <Calendar size={12} /> Joined: {new Date(item.enrollment_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`block font-bold ${item.due_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {item.due_amount > 0 ? `Due: ৳${item.due_amount}` : 'Clear'}
                                            </span>
                                            <span className="text-xs text-gray-400">Fee: ৳{item.monthly_fee}/mo</span>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded text-sm flex justify-between items-center">
                                        <span className="text-gray-600">Paid Up To:</span>
                                        <span className="font-medium text-gray-900">{item.paid_up_to || 'None'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setShowBreakdown(false)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
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
