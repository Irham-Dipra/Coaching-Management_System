import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, DollarSign, AlertCircle, Download, SquareCheck, Square, Edit, Trash2, Printer } from 'lucide-react';
import ReceiptTemplate from '../components/ReceiptTemplate';
import EditPaymentModal from '../components/EditPaymentModal';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { useReactToPrint } from 'react-to-print';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const FinanceBreakdown: React.FC = () => {
    const { type } = useParams<{ type: string }>(); // 'revenue', 'due_monthly', 'due_overall'
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Selection State (Persistent Map <id, payment>)
    const [selectedPayments, setSelectedPayments] = React.useState<Map<number, any>>(new Map());
    const [editPayment, setEditPayment] = React.useState<any>(null);
    const [singlePrintId, setSinglePrintId] = React.useState<number | null>(null);

    const batchPrintRef = React.useRef<HTMLDivElement>(null);
    const singlePrintRef = React.useRef<HTMLDivElement>(null);

    // Date State (Default to current or 2026 start)
    const [month, setMonth] = React.useState(new Date().getMonth() + 1);
    const [year, setYear] = React.useState(() => {
        const y = new Date().getFullYear();
        return y < 2026 ? 2026 : y;
    });

    const isRevenue = type === 'revenue';
    const isDueMonthly = type === 'due_monthly';
    const isDueOverall = type === 'due_overall';

    // Determine Titles and Endpoints
    let title = '';
    let endpoint = '';

    if (isRevenue) {
        title = 'Revenue Breakdown';
        endpoint = 'revenue-breakdown';
    } else if (isDueMonthly) {
        title = 'Due Payments';
        endpoint = 'due-breakdown/monthly';
    } else if (isDueOverall) {
        title = 'Total Dues (Overall)';
        endpoint = 'due-breakdown';
    }

    const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

    const { data, isLoading, error } = useQuery({
        queryKey: ['finance_breakdown', type, month, year],
        queryFn: async () => {
            let url = `${API_BASE_URL}/finance/${endpoint}`;
            if (isRevenue || isDueMonthly) {
                url += `?month=${month}&year=${year}`;
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to load data");
            return res.json();
        },
        enabled: !!type && (isRevenue || isDueMonthly || isDueOverall)
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: PaymentRepository.deletePayment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['finance_breakdown'] });
            queryClient.invalidateQueries({ queryKey: ['finance'] });
            alert("Payment Deleted Successfully!");
        },
        onError: (err) => alert("Failed to delete: " + err)
    });

    // Print Hooks
    const handleBatchPrintTrigger = useReactToPrint({
        contentRef: batchPrintRef,
        documentTitle: 'Payment_Receipts_Batch',
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
        const id = payment.payment_id;
        setSelectedPayments(prev => {
            const newMap = new Map(prev);
            if (newMap.has(id)) newMap.delete(id);
            else newMap.set(id, payment);
            return newMap;
        });
    };

    const toggleAllVisible = () => {
        if (!data?.transactions) return;
        const allSelected = data.transactions.every((p: any) => selectedPayments.has(p.payment_id));
        setSelectedPayments(prev => {
            const newMap = new Map(prev);
            if (allSelected) {
                data.transactions.forEach((p: any) => newMap.delete(p.payment_id));
            } else {
                data.transactions.forEach((p: any) => newMap.set(p.payment_id, p));
            }
            return newMap;
        });
    };

    const clearSelection = () => setSelectedPayments(new Map());

    if (!type || (!isRevenue && !isDueMonthly && !isDueOverall)) {
        return <div className="min-h-screen pt-20 text-center text-red-400 bg-slate-950">Invalid Breakdown Type</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300 p-6">
            {/* HEADER */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/finance')}
                    className="p-3 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-700"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        {isRevenue ? <DollarSign className="text-emerald-400" size={32} /> : <AlertCircle className="text-red-500" size={32} />}
                        {/* Date Filters: Show for Revenue & Due Monthly */}
                        {(isRevenue || isDueMonthly) && (
                            <div className="flex items-center gap-2 mt-1">
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(Number(e.target.value))}
                                    className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'short' })}</option>
                                    ))}
                                </select>
                                <select
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {[2026, 2027, 2028, 2029, 2030].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {title}
                    </h1>
                    {isRevenue && data && (
                        <p className="text-slate-400 mt-1">Showing data for <span className="text-white font-medium">{data.month}</span></p>
                    )}
                    {!isRevenue && (
                        <p className="text-slate-400 mt-1">
                            {isDueMonthly
                                ? "List of students with unpaid fees for the current month."
                                : "List of students with total accumulated dues."}
                        </p>
                    )}
                </div>

                {/* ACTION BAR (Visible when selection exists) */}
                {isRevenue && selectedPayments.size > 0 && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right">
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
            </div>

            {isLoading ? (
                <div className="text-center py-20 text-slate-500 animate-pulse">Loading finance details...</div>
            ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-center py-10 rounded-xl text-red-400">
                    <AlertCircle className="inline-block mb-2" size={32} />
                    <p>Error loading data. Please try again.</p>
                </div>
            ) : (
                <>
                    {/* 1. PROGRAM SUMMARY CARDS */}
                    <div>
                        <h4 className="font-bold text-slate-400 mb-4 text-xs uppercase tracking-wider">Program Summary</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data?.program_summary?.map((prog: any, idx: number) => (
                                <Link
                                    to={`/admin/finance/program/${prog.program_id}?view=${type}`}
                                    key={idx}
                                    className="bg-slate-800/50 backdrop-blur-sm p-5 rounded-xl border border-slate-700/50 hover:bg-slate-800 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer group flex justify-between items-center"
                                >
                                    <span className="font-medium text-slate-300 truncate pr-4 group-hover:text-blue-400 transition-colors" title={prog.name}>
                                        {prog.name}
                                    </span>
                                    <span className={`font-bold font-mono text-lg ${isRevenue ? 'text-emerald-400' : 'text-red-400'}`}>
                                        ৳{prog.amount.toLocaleString()}
                                    </span>
                                </Link>
                            ))}
                            {(!data?.program_summary || data.program_summary.length === 0) && (
                                <div className="col-span-full text-center text-slate-500 py-8 italic bg-slate-800/30 rounded-xl border border-slate-700/30">No program data available.</div>
                            )}
                        </div>
                    </div>

                    {/* 2. DETAILED TABLE */}
                    <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                            <h4 className="font-bold text-slate-200">
                                {isRevenue ? 'Transaction History' : 'Student Due List'}
                            </h4>
                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                                {(isRevenue ? data.transactions : data.students)?.length || 0} Records
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase font-semibold tracking-wider">
                                    <tr>
                                        {isRevenue ? (
                                            <>
                                                <th className="p-4 pl-6 w-10">
                                                    <button onClick={toggleAllVisible} className="hover:text-white transition-colors">
                                                        {(data?.transactions?.length > 0 && data.transactions.every((p: any) => selectedPayments.has(p.payment_id)))
                                                            ? <SquareCheck size={18} className="text-blue-500" />
                                                            : <Square size={18} />
                                                        }
                                                    </button>
                                                </th>
                                                <th className="p-4">Receipt #</th>
                                                <th className="p-4">Date</th>
                                                <th className="p-4">Student</th>
                                                <th className="p-4">Month/Year</th>
                                                <th className="p-4 text-right">Amount</th>
                                                <th className="p-4">Method</th>
                                                <th className="p-4 text-center pr-6">Actions</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="p-4 pl-6">Student</th>
                                                <th className="p-4">Program</th>
                                                <th className="p-4 text-right">Amount</th>
                                                <th className="p-4 w-1/3">Status Detail</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {(isRevenue ? data.transactions : data.students)?.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-700/30 transition-colors group">
                                            {isRevenue ? (
                                                <>
                                                    <td className="p-4 pl-6">
                                                        <button onClick={() => toggleSelection(row)} className="hover:text-white transition-colors">
                                                            {selectedPayments.has(row.payment_id)
                                                                ? <SquareCheck size={18} className="text-blue-500" />
                                                                : <Square size={18} className="text-slate-600" />
                                                            }
                                                        </button>
                                                    </td>
                                                    <td className="p-4 font-mono text-slate-500 group-hover:text-slate-300">#{row.payment_id}</td>
                                                    <td className="p-4 text-slate-300 text-sm">{row.payment_date}</td>
                                                    <td className="p-4">
                                                        <div className="font-medium text-white">{row.student_name}</div>
                                                        <span className="text-xs text-blue-400 block mt-0.5">{row.program_name}</span>
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
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-4 pl-6 font-medium text-white">{row.student_name}</td>
                                                    <td className="p-4 text-slate-400 text-sm">{row.program_name}</td>
                                                    <td className="p-4 text-right font-mono font-bold text-red-400">
                                                        ৳{(row.total_due).toLocaleString()}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-wrap gap-2">
                                                            {row.status_detail.split(', ').map((part: string, idx: number) => (
                                                                <span key={idx} className={`inline-block px-2 py-0.5 rounded text-xs border ${part.includes('Full')
                                                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                                    }`}>
                                                                    {part}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    {(isRevenue ? data.transactions : data.students)?.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-slate-500 italic">
                                                No records found for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

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
                        {singlePrintId && data?.transactions
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

export default FinanceBreakdown;
