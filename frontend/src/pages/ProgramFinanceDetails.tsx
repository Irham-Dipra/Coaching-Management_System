import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, Filter, CheckCircle, XCircle, AlertTriangle, DollarSign, Download, CheckSquare, Square, Edit, Trash2, Printer } from 'lucide-react';
import { ProgramRepository } from '../repositories/ProgramRepository';
import ReceiptTemplate from '../components/ReceiptTemplate';
import EditPaymentModal from '../components/EditPaymentModal';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { useReactToPrint } from 'react-to-print';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const ProgramFinanceDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const viewMode = searchParams.get('view') || 'due_monthly'; // 'revenue', 'due_monthly', 'due_overall'

    // Selection State
    const [selectedPayments, setSelectedPayments] = useState<Map<number, any>>(new Map());
    const [editPayment, setEditPayment] = useState<any>(null);
    const [singlePrintId, setSinglePrintId] = useState<number | null>(null);

    const batchPrintRef = React.useRef<HTMLDivElement>(null);
    const singlePrintRef = React.useRef<HTMLDivElement>(null);

    // Default to current month/year
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [filterStatus, setFilterStatus] = useState<string>('All'); // For Key Status Filtering

    const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: PaymentRepository.deletePayment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['program_finance'] });
            queryClient.invalidateQueries({ queryKey: ['finance'] });
            alert("Payment Deleted Successfully!");
        },
        onError: (err) => alert("Failed to delete: " + err)
    });

    // Print Hooks
    const handleBatchPrintTrigger = useReactToPrint({
        contentRef: batchPrintRef,
        documentTitle: 'Program_Receipts_Batch',
        pageStyle: `
            @page { size: A4; margin: 0; }
            @media print { 
                body { -webkit-print-color-adjust: exact; }
            }
        `
    });

    const handleSinglePrintTrigger = useReactToPrint({
        contentRef: singlePrintRef,
        documentTitle: 'Payment_Receipt',
        pageStyle: `
            @page { size: A4; margin: 0; }
            @media print { 
                body { -webkit-print-color-adjust: exact; }
            }
        `
    });

    const handleSinglePrint = (id: number) => {
        setSinglePrintId(id);
        setTimeout(() => handleSinglePrintTrigger(), 100);
    };

    // Selection Logic
    const toggleSelection = (payment: any) => {
        const pid = payment.payment_id;
        setSelectedPayments(prev => {
            const newMap = new Map(prev);
            if (newMap.has(pid)) newMap.delete(pid);
            else newMap.set(pid, payment);
            return newMap;
        });
    };

    const toggleAllVisible = () => {
        if (!fetchedData?.transactions) return;
        const allSelected = fetchedData.transactions.every((p: any) => selectedPayments.has(p.payment_id));
        setSelectedPayments(prev => {
            const newMap = new Map(prev);
            if (allSelected) {
                fetchedData.transactions.forEach((p: any) => newMap.delete(p.payment_id));
            } else {
                fetchedData.transactions.forEach((p: any) => newMap.set(p.payment_id, p));
            }
            return newMap;
        });
    };

    const clearSelection = () => setSelectedPayments(new Map());

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
        title = 'Total Dues (All Time)';
        subtitle = 'List of students with accumulated due fees.';
    } else {
        title = 'Monthly Payment Status';
        subtitle = `Status for ${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300 p-6">
            {/* HEADER */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-3 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-700"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        {viewMode === 'revenue' ? <DollarSign className="text-emerald-400" size={32} /> : <Users className="text-blue-500" size={32} />}
                        {program?.program_name || 'Program'} <span className="text-slate-500 text-2xl font-light">|</span> <span className="text-slate-200 font-medium">{title}</span>
                    </h1>
                    <p className="text-slate-400 mt-1">{subtitle}</p>
                </div>

                {/* ACTION BAR FOR REVENUE */}
                {viewMode === 'revenue' && selectedPayments.size > 0 && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right mr-4">
                        <button
                            onClick={clearSelection}
                            className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-700 transition-all border border-slate-700"
                        >
                            Clear ({selectedPayments.size})
                        </button>
                        <button
                            onClick={handleBatchPrintTrigger}
                            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all"
                        >
                            <Printer size={16} />
                            Print Selected
                        </button>
                    </div>
                )}

                {/* DATE CONTROLS (Hide for Overall Due?) */}
                {viewMode !== 'due_overall' && (() => {
                    const startDate = program?.start_date ? new Date(program.start_date) : null;
                    const endDate = program?.end_date ? new Date(program.end_date) : null;
                    const startYear = startDate ? startDate.getFullYear() : today.getFullYear();
                    const startMonth = startDate ? startDate.getMonth() + 1 : 1;
                    const endYear = endDate ? endDate.getFullYear() : startYear + 5;
                    const endMonth = endDate ? endDate.getMonth() + 1 : 12;

                    const yearOptions: number[] = [];
                    for (let y = startYear; y <= endYear; y++) yearOptions.push(y);

                    // Determine which months are valid for the selected year
                    const minMonth = year === startYear ? startMonth : 1;
                    const maxMonth = year === endYear && endDate ? endMonth : 12;

                    return (
                        <div className="flex gap-2 bg-slate-800/50 backdrop-blur-sm p-1.5 rounded-xl border border-slate-700/50">
                            <select
                                value={month}
                                onChange={(e) => setMonth(parseInt(e.target.value))}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                                {Array.from({ length: 12 }, (_, i) => {
                                    const m = i + 1;
                                    const disabled = m < minMonth || m > maxMonth;
                                    return (
                                        <option key={m} value={m} disabled={disabled} className="bg-slate-800">
                                            {new Date(0, i).toLocaleString('default', { month: 'short' })}
                                        </option>
                                    );
                                })}
                            </select>
                            <select
                                value={year}
                                onChange={(e) => {
                                    const newYear = parseInt(e.target.value);
                                    setYear(newYear);
                                    // Auto-clamp month if it becomes invalid for the new year
                                    const newMinMonth = newYear === startYear ? startMonth : 1;
                                    const newMaxMonth = newYear === endYear && endDate ? endMonth : 12;
                                    if (month < newMinMonth) setMonth(newMinMonth);
                                    if (month > newMaxMonth) setMonth(newMaxMonth);
                                }}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                                {yearOptions.map(y => (
                                    <option key={y} value={y} className="bg-slate-800">{y}</option>
                                ))}
                            </select>
                        </div>
                    );
                })()}
            </div>

            {/* STATS CARDS */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {viewMode === 'revenue' && (
                    <>
                        <div className="bg-slate-800/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 shadow-lg col-span-2 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <DollarSign size={80} />
                            </div>
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Revenue</p>
                            <p className="text-4xl font-black text-emerald-400">৳{stats.total.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 shadow-lg col-span-2 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Users size={80} />
                            </div>
                            <p className="text-xs text-blue-400 uppercase font-bold tracking-wider mb-1">Transactions</p>
                            <p className="text-4xl font-black text-blue-500">{stats.volume}</p>
                        </div>
                    </>
                )}
                {viewMode === 'due_overall' && (
                    <>
                        <div className="bg-slate-800/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 shadow-lg col-span-2">
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Arrears</p>
                            <p className="text-4xl font-black text-red-500">৳{stats.total_arrears.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 shadow-lg col-span-2">
                            <p className="text-xs text-blue-400 uppercase font-bold tracking-wider mb-1">Students with Dues</p>
                            <p className="text-4xl font-black text-blue-500">{stats.count}</p>
                        </div>
                    </>
                )}
                {(viewMode === 'due_monthly' || viewMode === 'due') && (
                    <>
                        <div className="bg-slate-800/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 shadow-lg">
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Students</p>
                            <p className="text-3xl font-bold text-white">{stats.total}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 shadow-lg">
                            <p className="text-xs text-emerald-400 uppercase font-bold tracking-wider mb-1">Collected</p>
                            <p className="text-3xl font-bold text-emerald-500">৳{stats.collected.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-700/50 shadow-lg">
                            <p className="text-xs text-red-400 uppercase font-bold tracking-wider mb-1">Due Amount</p>
                            <p className="text-3xl font-bold text-red-500">৳{stats.due.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-700/50 shadow-lg flex flex-col justify-center gap-1.5">
                            <div className="flex justify-between text-xs items-center">
                                <span className="text-emerald-400 font-bold uppercase tracking-wide">Paid</span>
                                <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">{stats.paid}</span>
                            </div>
                            <div className="flex justify-between text-xs items-center">
                                <span className="text-amber-400 font-bold uppercase tracking-wide">Partial</span>
                                <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">{stats.partial}</span>
                            </div>
                            <div className="flex justify-between text-xs items-center">
                                <span className="text-red-400 font-bold uppercase tracking-wide">Unpaid</span>
                                <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-mono">{stats.unpaid}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* TABLE */}
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                    <h3 className="font-bold text-slate-200">
                        {viewMode === 'revenue' ? 'Recent Transactions' : viewMode === 'due_overall' ? 'Dues List' : 'Student List'}
                    </h3>

                    {(viewMode === 'due_monthly' || viewMode === 'due') && (
                        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                            <Filter size={16} className="text-slate-400 ml-2" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="bg-transparent border-none text-sm text-white px-2 py-1 focus:ring-0 outline-none cursor-pointer"
                            >
                                <option value="All" className="bg-slate-800">All Status</option>
                                <option value="Paid" className="bg-slate-800 text-emerald-400">Paid</option>
                                <option value="Unpaid" className="bg-slate-800 text-red-400">Unpaid</option>
                                <option value="Partial" className="bg-slate-800 text-amber-400">Partial</option>
                            </select>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-500 animate-pulse">Loading data...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase font-semibold border-b border-slate-700/50">
                                <tr>
                                    {viewMode === 'revenue' ? (
                                        <>
                                            <th className="p-4 pl-6 w-10">
                                                <button onClick={toggleAllVisible} className="hover:text-white transition-colors">
                                                    {(fetchedData?.transactions?.length > 0 && fetchedData.transactions.every((p: any) => selectedPayments.has(p.payment_id)))
                                                        ? <CheckSquare size={18} className="text-blue-500" />
                                                        : <Square size={18} />
                                                    }
                                                </button>
                                            </th>
                                            <th className="p-4">Receipt #</th>
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Student</th>
                                            <th className="p-4">Period</th>
                                            <th className="p-4 text-right">Amount</th>
                                            <th className="p-4">Method</th>
                                            <th className="p-4 text-center pr-6">Action</th>
                                        </>
                                    ) : viewMode === 'due_overall' ? (
                                        <>
                                            <th className="p-4 pl-6">Student</th>
                                            <th className="p-4">Total Due</th>
                                            <th className="p-4 w-1/2">Details</th>
                                            <th className="p-4 text-center pr-6">Action</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-4 pl-6">Student</th>
                                            <th className="p-4 text-center">Status</th>
                                            <th className="p-4 text-right">Fee</th>
                                            <th className="p-4 text-right">Paid</th>
                                            <th className="p-4 text-right">Due</th>
                                            <th className="p-4 text-center pr-6">Action</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {/* REVENUE ROWS */}
                                {viewMode === 'revenue' && transactions.map((row: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-700/30 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <button onClick={() => toggleSelection(row)} className="hover:text-white transition-colors">
                                                {selectedPayments.has(row.payment_id)
                                                    ? <CheckSquare size={18} className="text-blue-500" />
                                                    : <Square size={18} className="text-slate-600" />
                                                }
                                            </button>
                                        </td>
                                        <td className="p-4 font-mono text-slate-500 group-hover:text-slate-300">#{row.payment_id}</td>
                                        <td className="p-4 text-slate-300 text-sm">{row.payment_date}</td>
                                        <td className="p-4">
                                            <div className="font-medium text-white">{row.student_name}</div>
                                            <div className="text-xs text-slate-500">ID: {row.student_code || row.student_id}</div>
                                        </td>
                                        <td className="p-4 text-slate-300 text-sm font-medium">
                                            <div className="flex items-center gap-2">
                                                {row.date_display}
                                                {row.type === 'Bulk' && (
                                                    <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded border border-purple-500/30 uppercase tracking-wide">
                                                        Bulk
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-bold text-emerald-400 font-mono">৳{(row.amount).toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-slate-700 rounded text-xs border border-slate-600 text-slate-300">{row.payment_method || 'Cash'}</span>
                                        </td>
                                        <td className="p-4 pr-6 text-center flex justify-center gap-2">
                                            {row.is_editable ? (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setEditPayment(row)}
                                                        className="text-slate-400 hover:text-blue-400 p-2 rounded-full hover:bg-slate-700/50 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm("Are you sure you want to delete this payment? This action cannot be undone.")) {
                                                                deleteMutation.mutate(row.payment_id);
                                                            }
                                                        }}
                                                        className="text-slate-400 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button className="text-slate-700 cursor-not-allowed p-2" disabled title="Not editable">
                                                    <Edit size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleSinglePrint(row.payment_id)}
                                                className="text-blue-400 hover:text-blue-300 p-2 rounded-full hover:bg-blue-500/10 transition-colors"
                                                title="Print Receipt"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* OVERALL DUE ROWS */}
                                {viewMode === 'due_overall' && overallStudents.map((s: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4 pl-6">
                                            <div className="font-medium text-white">{s.student_name}</div>
                                            <div className="text-xs text-slate-500">Roll: {s.roll_no || '-'}</div>
                                        </td>
                                        <td className="p-4 font-bold text-red-500 font-mono">
                                            ৳{s.total_due.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm text-slate-400">
                                            {s.status_detail}
                                        </td>
                                        <td className="p-4 pr-6 text-center">
                                            <button className="text-blue-400 hover:text-white hover:underline text-xs" onClick={() => navigate(`/students/${s.student_id}`)}>
                                                View Profile
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {/* MONTHLY DUE ROWS */}
                                {(viewMode === 'due_monthly' || viewMode === 'due') && filteredMonthlyStudents.map((s: any) => (
                                    <tr key={s.enrollment_id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4 pl-6">
                                            <div className="font-medium text-white">{s.name}</div>
                                            <div className="text-xs text-slate-500">Roll: {s.roll_no || '-'}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                s.status === 'Unpaid' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                }`}>
                                                {s.status === 'Paid' && <CheckCircle size={12} />}
                                                {s.status === 'Unpaid' && <XCircle size={12} />}
                                                {s.status === 'Partial' && <AlertTriangle size={12} />}
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono text-slate-400">৳{(s.monthly_fee || 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-emerald-400 font-medium">৳{(s.paid_amount || 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-red-400 font-bold">
                                            {s.due_amount > 0 ? `৳${s.due_amount.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-4 pr-6 text-center">
                                            <button className="text-blue-400 hover:text-white hover:underline text-xs transition-colors" onClick={() => navigate(`/students/${s.student_id}`)}>
                                                View Profile
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {((viewMode === 'revenue' && transactions.length === 0) ||
                                    (viewMode === 'due_overall' && overallStudents.length === 0) ||
                                    ((viewMode === 'due_monthly' || viewMode === 'due') && filteredMonthlyStudents.length === 0)) && (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-slate-500 italic">No records found.</td>
                                        </tr>
                                    )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {/* MODALS */}
            <EditPaymentModal isOpen={!!editPayment} onClose={() => setEditPayment(null)} payment={editPayment} />

            {/* Hidden Print Areas */}
            <div style={{ display: "none" }}>
                <div ref={batchPrintRef}>
                    <div className="bg-white text-black p-8 flex flex-col gap-0">
                        {Array.from(selectedPayments.values())
                            .sort((a: any, b: any) => b.payment_id - a.payment_id)
                            .map((p: any) => (
                                <div key={p.payment_id} className="break-inside-avoid">
                                    <ReceiptTemplate payment={{ ...p, paid_amount: p.amount }} />
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            <div style={{ display: "none" }}>
                <div ref={singlePrintRef}>
                    <div className="bg-white text-black p-8">
                        {singlePrintId && fetchedData?.transactions
                            ?.filter((p: any) => p.payment_id === singlePrintId)
                            .map((p: any) => (
                                <div key={p.payment_id}>
                                    <ReceiptTemplate payment={{ ...p, paid_amount: p.amount }} />
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgramFinanceDetails;
