import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, AlertCircle, DollarSign, Download, Edit } from 'lucide-react';
import { generatePaymentSlip } from '../utils/pdfGenerator';

interface FinanceBreakdownModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'revenue' | 'due' | null;
    onEdit: (payment: any) => void;
}

const API_BASE_URL = "http://127.0.0.1:8000";

const FinanceBreakdownModal: React.FC<FinanceBreakdownModalProps> = ({ isOpen, onClose, type, onEdit }) => {
    if (!isOpen || !type) return null;

    const endpoint = type === 'revenue' ? '/finance/revenue-breakdown' : '/finance/due-breakdown';
    const title = type === 'revenue' ? 'Revenue Breakdown (This Month)' : 'Due Payments Breakdown';

    const { data, isLoading, error } = useQuery({
        queryKey: ['finance_breakdown', type],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}${endpoint}`);
            if (!res.ok) throw new Error("Failed to load data");
            return res.json();
        },
        enabled: isOpen
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                {/* HEADER */}
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                            {type === 'revenue' ? <DollarSign className="text-green-600" /> : <AlertCircle className="text-red-600" />}
                            {title}
                        </h3>
                        {type === 'revenue' && data && (
                            <p className="text-sm text-gray-500 mt-1">Showing data for {data.month}</p>
                        )}
                        {type === 'due' && (
                            <p className="text-sm text-gray-500 mt-1">List of all active students with outstanding balances.</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full text-gray-500">Loading details...</div>
                    ) : error ? (
                        <div className="text-center text-red-500 py-10">Error loading data. Please try again.</div>
                    ) : (
                        <div className="space-y-8">

                            {/* 1. PROGRAM SUMMARY CARDS */}
                            <div>
                                <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Program Summary</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {data?.program_summary?.map((prog: any, idx: number) => (
                                        <div key={idx} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex justify-between items-center">
                                            <span className="font-medium text-gray-700 truncate pr-2" title={prog.name}>{prog.name}</span>
                                            <span className={`font-bold font-mono ${type === 'revenue' ? 'text-green-600' : 'text-red-500'}`}>
                                                ৳{prog.amount.toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                    {(!data?.program_summary || data.program_summary.length === 0) && (
                                        <div className="col-span-full text-center text-gray-400 py-4 italic">No data available.</div>
                                    )}
                                </div>
                            </div>

                            {/* 2. DETAILED TABLE */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-white">
                                    <h4 className="font-bold text-gray-800">
                                        {type === 'revenue' ? 'Transaction History' : 'Student Due List'}
                                    </h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                            <tr>
                                                {type === 'revenue' ? (
                                                    <>
                                                        <th className="p-4">Receipt #</th>
                                                        <th className="p-4">Date</th>
                                                        <th className="p-4">Student</th>
                                                        <th className="p-4">Month/Year</th>
                                                        <th className="p-4 text-right">Amount</th>
                                                        <th className="p-4">Method</th>
                                                        <th className="p-4 text-center">Actions</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="p-4">Student</th>
                                                        <th className="p-4">Program</th>
                                                        <th className="p-4 text-right">Amount</th>
                                                        <th className="p-4 w-1/3">Status Detail</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {(type === 'revenue' ? data.transactions : data.students)?.map((row: any, i: number) => (
                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                    {type === 'revenue' ? (
                                                        <>
                                                            <td className="p-4 font-mono text-gray-500">#{row.payment_id}</td>
                                                            <td className="p-4 text-gray-700 text-sm">{row.payment_date}</td>
                                                            <td className="p-4 font-medium text-gray-900">
                                                                {row.student_name}
                                                                <span className="block text-xs text-blue-500">{row.program_name}</span>
                                                            </td>
                                                            <td className="p-4 text-gray-800 text-sm font-medium">
                                                                {row.date_display}
                                                                {row.type === 'Bulk' && (
                                                                    <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded border border-purple-200">
                                                                        Bulk
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-right font-bold text-green-600">৳{(row.amount).toLocaleString()}</td>
                                                            <td className="p-4 text-gray-600 text-sm">
                                                                <span className="px-2 py-1 bg-gray-100 rounded text-xs border">{row.payment_method || 'Cash'}</span>
                                                            </td>
                                                            <td className="p-4 text-center flex justify-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        onEdit(row);
                                                                        // Optional: onClose(); // Keep open? Standard is close on Edit? 
                                                                        // User might want to browse. Let's keep open?
                                                                        // No, Edit Modal is modal-over-modal. It supports it (z-50).
                                                                    }}
                                                                    disabled={!row.is_editable}
                                                                    className={`p-2 rounded-full transition-colors ${row.is_editable ? 'text-gray-500 hover:text-blue-600 hover:bg-gray-100' : 'text-gray-200 cursor-not-allowed'}`}
                                                                    title={row.is_editable ? "Edit" : "Only the most recent transaction can be edited"}
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => generatePaymentSlip(row)}
                                                                    className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                                                    title="Download Receipt"
                                                                >
                                                                    <Download size={18} />
                                                                </button>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="p-4 font-medium text-gray-900">{row.student_name}</td>
                                                            <td className="p-4 text-gray-600 text-sm">{row.program_name}</td>
                                                            <td className="p-4 text-right font-mono font-bold text-red-500">
                                                                ৳{(row.total_due).toLocaleString()}
                                                            </td>
                                                            <td className="p-4 text-gray-700 text-sm font-medium">
                                                                {row.status_detail.split(', ').map((part: string, idx: number) => (
                                                                    <span key={idx} className={`inline-block mr-2 mb-1 px-2 py-0.5 rounded text-xs border ${part.includes('Full')
                                                                        ? 'bg-red-50 text-red-700 border-red-100'
                                                                        : 'bg-amber-50 text-amber-700 border-amber-100'
                                                                        }`}>
                                                                        {part}
                                                                    </span>
                                                                ))}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                            {(type === 'revenue' ? data.transactions : data.students)?.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="p-8 text-center text-gray-400">
                                                        No records found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FinanceBreakdownModal;
