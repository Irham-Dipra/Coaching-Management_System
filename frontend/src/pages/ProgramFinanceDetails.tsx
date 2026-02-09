import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, Filter, CheckCircle, XCircle, AlertTriangle, DollarSign, Download } from 'lucide-react';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { generatePaymentSlip } from '../utils/pdfGenerator';

const ProgramFinanceDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const viewMode = searchParams.get('view') || 'due_monthly'; // 'revenue', 'due_monthly', 'due_overall'

    // Default to current month/year
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [filterStatus, setFilterStatus] = useState<string>('All'); // For Key Status Filtering

    const API_BASE_URL = "http://localhost:8000";

    // 1. Fetch Program Info
    const { data: program } = useQuery({
        queryKey: ['program', id],
        queryFn: () => ProgramRepository.getProgramById(id!),
        enabled: !!id
    });

    // 2. Fetch Data based on View Mode
    const { data: fetchedData, isLoading } = useQuery({
        queryKey: ['program_finance', id, month, year, viewMode],
        queryFn: async () => {
            if (viewMode === 'revenue') {
                // Fetch Revenue Transactions for this Program
                const res = await fetch(`${API_BASE_URL}/finance/revenue-breakdown?month=${month}&year=${year}&program_id=${id}`);
                if (!res.ok) throw new Error("Failed to load revenue data");
                return res.json();
            } else if (viewMode === 'due_overall') {
                // Fetch Overall Due Breakdown
                const res = await fetch(`${API_BASE_URL}/finance/due-breakdown?program_id=${id}`);
                if (!res.ok) throw new Error("Failed to load overall due data");
                return res.json();
            } else {
                // Default: due_monthly (Student Due Status for specific month)
                // Maps to existing behavior
                const res = await fetch(`${API_BASE_URL}/programs/${id}/payment-status?month=${month}&year=${year}`);
                if (!res.ok) throw new Error("Failed to load monthly due data");
                return res.json();
            }
        },
        enabled: !!id
    });

    // Flatten Logic
    const transactions = viewMode === 'revenue' ? (fetchedData?.transactions || []) : [];
    const monthlyStudents = (viewMode === 'due_monthly' || viewMode === 'due') ? (fetchedData || []) : [];
    // For Overall, fetchedData is { students: [...] }
    const overallStudents = viewMode === 'due_overall' ? (fetchedData?.students || []) : [];

    // Filter Logic for Monthly View
    const filteredMonthlyStudents = React.useMemo(() => {
        if (viewMode !== 'due_monthly' && viewMode !== 'due') return [];
        if (!monthlyStudents) return [];
        if (filterStatus === 'All') return monthlyStudents;
        return monthlyStudents.filter((s: any) => s.status === filterStatus);
    }, [monthlyStudents, filterStatus, viewMode]);

    // Stats Computation
    const stats = React.useMemo(() => {
        if (viewMode === 'revenue') {
            if (!transactions) return { total: 0, volume: 0 };
            return transactions.reduce((acc: any, curr: any) => {
                acc.total += (curr.amount || 0);
                acc.volume++;
                return acc;
            }, { total: 0, volume: 0 });
        } else if (viewMode === 'due_overall') {
            if (!overallStudents) return { total_arrears: 0, count: 0 };
            return overallStudents.reduce((acc: any, curr: any) => {
                acc.total_arrears += (curr.total_due || 0);
                acc.count++;
                return acc;
            }, { total_arrears: 0, count: 0 });
        } else {
            // Monthly Due Stats
            if (!monthlyStudents) return { total: 0, paid: 0, unpaid: 0, partial: 0, collected: 0, due: 0 };
            return monthlyStudents.reduce((acc: any, curr: any) => {
                acc.total++;
                if (curr.status === 'Paid') acc.paid++;
                else if (curr.status === 'Unpaid') acc.unpaid++;
                else acc.partial++;

                acc.collected += (curr.paid_amount || 0);
                acc.due += (curr.due_amount || 0);
                return acc;
            }, { total: 0, paid: 0, unpaid: 0, partial: 0, collected: 0, due: 0 });
        }
    }, [monthlyStudents, transactions, overallStudents, viewMode]);

    // Title & Context
    let title = '';
    let subtitle = '';

    if (viewMode === 'revenue') {
        title = 'Revenue History';
        subtitle = `Transactions for ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`;
    } else if (viewMode === 'due_overall') {
        title = 'Total Arrears (All Time)';
        subtitle = 'List of students with accumulated due fees.';
    } else {
        title = 'Monthly Payment Status';
        subtitle = `Status for ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* HEADER */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        {viewMode === 'revenue' ? <DollarSign className="text-green-600" /> : <Users className="text-blue-600" />}
                        {program?.program_name || 'Program'} - {title}
                    </h1>
                    <p className="text-sm text-gray-500">{subtitle}</p>
                </div>

                {/* DATE CONTROLS (Hide for Overall Due?) */}
                {viewMode !== 'due_overall' && (
                    <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="border-none bg-gray-50 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="border-none bg-gray-50 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={2024}>2024</option>
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                        </select>
                    </div>
                )}
            </div>

            {/* STATS CARDS */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {viewMode === 'revenue' && (
                    <>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm col-span-2">
                            <p className="text-xs text-gray-500 uppercase font-bold">Total Revenue</p>
                            <p className="text-3xl font-bold text-green-600">৳{stats.total.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm col-span-2">
                            <p className="text-xs text-blue-500 uppercase font-bold">Transactions</p>
                            <p className="text-3xl font-bold text-blue-600">{stats.volume}</p>
                        </div>
                    </>
                )}
                {viewMode === 'due_overall' && (
                    <>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm col-span-2">
                            <p className="text-xs text-gray-500 uppercase font-bold">Total Arrears</p>
                            <p className="text-3xl font-bold text-red-600">৳{stats.total_arrears.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm col-span-2">
                            <p className="text-xs text-blue-500 uppercase font-bold">Students with Dues</p>
                            <p className="text-3xl font-bold text-blue-600">{stats.count}</p>
                        </div>
                    </>
                )}
                {(viewMode === 'due_monthly' || viewMode === 'due') && (
                    <>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500 uppercase font-bold">Total Students</p>
                            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <p className="text-xs text-green-600 uppercase font-bold">Collected</p>
                            <p className="text-2xl font-bold text-green-700">৳{stats.collected.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <p className="text-xs text-red-500 uppercase font-bold">Due Amount</p>
                            <p className="text-2xl font-bold text-red-600">৳{stats.due.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center gap-1">
                            <div className="flex justify-between text-xs"><span className="text-green-600 font-bold">Paid: {stats.paid}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-amber-600 font-bold">Partial: {stats.partial}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-red-600 font-bold">Unpaid: {stats.unpaid}</span></div>
                        </div>
                    </>
                )}
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-700">
                        {viewMode === 'revenue' ? 'Recent Transactions' : viewMode === 'due_overall' ? 'Arrears List' : 'Student List'}
                    </h3>

                    {(viewMode === 'due_monthly' || viewMode === 'due') && (
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-gray-400" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="bg-white border text-sm rounded-lg px-2 py-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="All">All Status</option>
                                <option value="Paid">Paid</option>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Partial">Partial</option>
                            </select>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-gray-500">Loading data...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b">
                                <tr>
                                    {viewMode === 'revenue' ? (
                                        <>
                                            <th className="p-4">Receipt #</th>
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Student</th>
                                            <th className="p-4">Period</th>
                                            <th className="p-4 text-right">Amount</th>
                                            <th className="p-4">Method</th>
                                            <th className="p-4 text-center">Action</th>
                                        </>
                                    ) : viewMode === 'due_overall' ? (
                                        <>
                                            <th className="p-4">Student</th>
                                            <th className="p-4">Total Due</th>
                                            <th className="p-4 w-1/2">Details</th>
                                            <th className="p-4 text-center">Action</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-4">Student</th>
                                            <th className="p-4 text-center">Status</th>
                                            <th className="p-4 text-right">Fee</th>
                                            <th className="p-4 text-right">Paid</th>
                                            <th className="p-4 text-right">Due</th>
                                            <th className="p-4 text-center">Action</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {/* REVENUE ROWS */}
                                {viewMode === 'revenue' && transactions.map((row: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-4 font-mono text-gray-500">#{row.payment_id}</td>
                                        <td className="p-4 text-gray-700 text-sm">{row.payment_date}</td>
                                        <td className="p-4 font-medium text-gray-900">
                                            {row.student_name}
                                            <div className="text-xs text-gray-400">ID: {row.student_id}</div>
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
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => generatePaymentSlip(row)}
                                                className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                                title="Download Receipt"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* OVERALL DUE ROWS */}
                                {viewMode === 'due_overall' && overallStudents.map((s: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900">{s.student_name}</div>
                                            <div className="text-xs text-gray-500">Roll: {s.roll_no || '-'}</div>
                                        </td>
                                        <td className="p-4 font-bold text-red-600">
                                            ৳{s.total_due.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {s.status_detail}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button className="text-blue-600 hover:underline text-xs" onClick={() => navigate(`/students/${s.student_id}`)}>
                                                View Profile
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* MONTHLY DUE ROWS */}
                                {(viewMode === 'due_monthly' || viewMode === 'due') && filteredMonthlyStudents.map((s: any) => (
                                    <tr key={s.enrollment_id} className="hover:bg-gray-50">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900">{s.name}</div>
                                            <div className="text-xs text-gray-500">Roll: {s.roll_no || '-'}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-200' :
                                                    s.status === 'Unpaid' ? 'bg-red-100 text-red-800 border-red-200' :
                                                        'bg-amber-100 text-amber-800 border-amber-200'
                                                }`}>
                                                {s.status === 'Paid' && <CheckCircle size={12} />}
                                                {s.status === 'Unpaid' && <XCircle size={12} />}
                                                {s.status === 'Partial' && <AlertTriangle size={12} />}
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono text-gray-600">৳{(s.monthly_fee || 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-green-600 font-medium">৳{(s.paid_amount || 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-red-600 font-bold">
                                            {s.due_amount > 0 ? `৳${s.due_amount.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button className="text-blue-600 hover:underline text-xs" onClick={() => navigate(`/students/${s.student_id}`)}>
                                                View Profile
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {((viewMode === 'revenue' && transactions.length === 0) ||
                                    (viewMode === 'due_overall' && overallStudents.length === 0) ||
                                    ((viewMode === 'due_monthly' || viewMode === 'due') && filteredMonthlyStudents.length === 0)) && (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-gray-400 italic">No records found.</td>
                                        </tr>
                                    )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgramFinanceDetails;
