import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, DollarSign, AlertCircle, Download } from 'lucide-react';
import { generatePaymentSlip } from '../utils/pdfGenerator';

const FinanceBreakdown: React.FC = () => {
    const { type } = useParams<{ type: string }>(); // 'revenue' or 'due'
    const navigate = useNavigate();

    const isRevenue = type === 'revenue';
    const title = isRevenue ? 'Revenue Breakdown (This Month)' : 'Due Payments Breakdown';
    const endpoint = isRevenue ? 'revenue-breakdown' : 'due-breakdown';

    // We can use the Repository directly if we exposed these methods, 
    // or fetch directly if the Repo doesn't have them typed out yet.
    // Based on previous checks, PaymentRepository has getRevenueBreakdown/getDueBreakdownList?
    // Let's check PaymentRepository.ts or just use fetch for now to match the modal logic, 
    // BUT better to use the Repo if possible.
    // The Modal used: fetch(`${API_BASE_URL}${endpoint}`)
    // Let's try to use the Repo if we can find it, otherwise fetch.
    // For safety/speed, I'll stick to the Modal's fetch logic but wrapped in useQuery properly.

    // Actually, I should use the repository if possible. 
    // I recall checking payment_repository.py (backend), not the frontend TS repo.
    // Let's assume standard fetch for now to match the modal exactly.

    const API_BASE_URL = "http://localhost:8000";

    const { data, isLoading, error } = useQuery({
        queryKey: ['finance_breakdown', type],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/finance/${endpoint}`);
            if (!res.ok) throw new Error("Failed to load data");
            return res.json();
        },
        enabled: !!type
    });

    if (!type || (type !== 'revenue' && type !== 'due')) {
        return <div className="p-8 text-center text-red-500">Invalid Breakdown Type</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* HEADER */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/admin/finance')}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        {isRevenue ? <DollarSign className="text-green-600" /> : <AlertCircle className="text-red-600" />}
                        {title}
                    </h1>
                    {isRevenue && data && (
                        <p className="text-sm text-gray-500">Showing data for {data.month}</p>
                    )}
                    {!isRevenue && (
                        <p className="text-sm text-gray-500">List of active students with outstanding balances.</p>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-20 text-gray-500">Loading details...</div>
            ) : error ? (
                <div className="text-center py-20 text-red-500">Error loading data.</div>
            ) : (
                <>
                    {/* 1. PROGRAM SUMMARY CARDS */}
                    <div>
                        <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Program Summary</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data?.program_summary?.map((prog: any, idx: number) => (
                                <Link
                                    to={`/admin/finance/program/${prog.program_id}?view=${isRevenue ? 'revenue' : 'due'}`}
                                    key={idx}
                                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                                >
                                    <span className="font-medium text-gray-700 truncate pr-2 group-hover:text-blue-600" title={prog.name}>
                                        {prog.name}
                                    </span>
                                    <span className={`font-bold font-mono ${isRevenue ? 'text-green-600' : 'text-red-500'}`}>
                                        ৳{prog.amount.toLocaleString()}
                                    </span>
                                </Link>
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
                                {isRevenue ? 'Transaction History' : 'Student Due List'}
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                    <tr>
                                        {isRevenue ? (
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
                                    {(isRevenue ? data.transactions : data.students)?.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                            {isRevenue ? (
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
                                    {(isRevenue ? data.transactions : data.students)?.length === 0 && (
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
                </>
            )}
        </div>
    );
};

export default FinanceBreakdown;
