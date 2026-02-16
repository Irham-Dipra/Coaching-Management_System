import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { DollarSign, Search, Plus, FileText, Download, X, ArrowUpDown, Edit, Users, AlertCircle, Trash2, Printer, CheckSquare, Square } from 'lucide-react';
import { generatePaymentSlip } from '../utils/pdfGenerator';
import ReceiptTemplate from '../components/ReceiptTemplate';
import { useReactToPrint } from 'react-to-print';

import BatchPaymentModal from '../components/BatchPaymentModal';

const Finance: React.FC = () => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [editPayment, setEditPayment] = useState<any>(null); // For edit modal
    const [sortDesc, setSortDesc] = useState(true); // Default Descending
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Auto-Action Logic (Restored)
    useEffect(() => {
        if (searchParams.get('action') === 'payment') {
            setIsModalOpen(true);
            setSearchParams(params => {
                params.delete('action');
                return params;
            });
        }
    }, [searchParams, setSearchParams]);

    // --- PAGINATION STATE ---
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50); // Fixed for now

    // --- SEARCH & FILTER STATES ---
    const [searchTerm, setSearchTerm] = useState('');
    const [rollSearch, setRollSearch] = useState('');
    const [batchFilter, setBatchFilter] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [programFilter, setProgramFilter] = useState('');

    // Date Filters
    const [dateMode, setDateMode] = useState<'all' | 'custom'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Reset Page on Filter Change
    useEffect(() => {
        setPage(1);
    }, [searchTerm, rollSearch, batchFilter, classFilter, programFilter, startDate, endDate]);


    // Fetch Recent Payments (Paginated)
    const { data: paymentsData, isLoading: isPaymentsLoading } = useQuery({
        queryKey: ['payments', page, searchTerm, rollSearch, classFilter, batchFilter, programFilter, startDate, endDate], // Added dates to key
        queryFn: () => PaymentRepository.getRecentPayments(page, pageSize, searchTerm, {
            roll_no: rollSearch,
            program_id: programFilter,
            class: classFilter,
            batch_id: batchFilter,
            start_date: startDate, // Pass to repo
            end_date: endDate
        }),
        placeholderData: (previousData: any) => previousData
    });

    const recentPayments = paymentsData?.data || [];
    const totalCount = paymentsData?.total_count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Fetch Batches & Programs for Filters
    const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: ProgramRepository.getAllBatches });
    const { data: allPrograms } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms });

    // Fetch Global Stats
    const { data: stats } = useQuery({
        queryKey: ['finance', 'stats'],
        queryFn: PaymentRepository.getFinanceStats
    });

    const deleteMutation = useMutation({
        mutationFn: PaymentRepository.deletePayment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['finance'] });
            alert("Payment Deleted Successfully!");
        },
        onError: (err) => alert("Failed to delete: " + err)
    });

    // --- FILTER LOGIC (Client-side for unsupported backend filters IF needed) ---
    // Since backend doesn't support class/batch yet, we might display mismatching data or filter locally?
    // Filtering local page reduces page size. 
    // Ideally backend should handle all. 
    // For now, I'll bypass client filters for simplicity as per instructions to "Remove client side slicing".
    // I will assume backend search is primary.
    const filteredPayments = recentPayments;

    // --- BATCH PRINT LOGIC ---
    // Persist full payment objects for printing even if off-screen
    const [selectedPayments, setSelectedPayments] = useState<Map<number, any>>(new Map());
    const [singlePrintId, setSinglePrintId] = useState<number | null>(null);
    const batchPrintRef = React.useRef<HTMLDivElement>(null);
    const singlePrintRef = React.useRef<HTMLDivElement>(null);

    // Batch Print Hook
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

    // Single Print Hook
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
        // Timeout to allow render
        setTimeout(() => handleSinglePrintTrigger(), 100);
    };

    const toggleSelection = (payment: any) => {
        const id = payment.sort_id || payment.payment_id;
        setSelectedPayments(prev => {
            const newMap = new Map(prev);
            if (newMap.has(id)) {
                newMap.delete(id);
            } else {
                newMap.set(id, payment);
            }
            return newMap;
        });
    };

    const toggleAllOnPage = () => {
        // Toggle only visible items
        if (!filteredPayments) return;

        const visibleItems = filteredPayments;
        const allVisibleSelected = visibleItems.every((p: any) => selectedPayments.has(p.sort_id || p.payment_id));

        setSelectedPayments(prev => {
            const newMap = new Map(prev);
            if (allVisibleSelected) {
                // Deselect only visible
                visibleItems.forEach((p: any) => newMap.delete(p.sort_id || p.payment_id));
            } else {
                // Select all visible
                visibleItems.forEach((p: any) => newMap.set(p.sort_id || p.payment_id, p));
            }
            return newMap;
        });
    };

    const clearSelection = () => {
        setSelectedPayments(new Map());
    };

    // Warn if using unsupported filters?
    // Or just let them be ignored server-side.


    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-3">
                    <DollarSign className="text-emerald-400" /> Finance & Accounts
                </h1>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsBatchModalOpen(true)}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:scale-105 transition-all flex items-center gap-2 font-bold"
                    >
                        <Users size={18} /> Record Batch Payment
                    </button>
                    <button
                        onClick={() => { setEditPayment(null); setIsModalOpen(true); }}
                        className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 hover:scale-105 transition-all flex items-center gap-2 font-bold"
                    >
                        <Plus size={18} /> Record New Payment
                    </button>
                </div>
            </div>

            {/* ... stats ... */}

            {/* Modals */}
            {isBatchModalOpen && (
                <BatchPaymentModal
                    isOpen={isBatchModalOpen}
                    onClose={() => setIsBatchModalOpen(false)}
                />
            )}

            {/* ... rest of the component ... */}


            {/* STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. REVENUE CARD */}
                <div
                    onClick={() => navigate('/admin/finance/breakdown/revenue')}
                    className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 cursor-pointer hover:shadow-emerald-900/20 hover:border-emerald-500/30 transition-all group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Revenue (This Month)</p>
                            <h3 className="text-4xl font-black text-white mt-1 group-hover:text-emerald-300 transition-colors">
                                ৳{(stats?.revenue_this_month || 0).toLocaleString()}
                            </h3>
                        </div>
                        <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-lg shadow-emerald-900/20">
                            <DollarSign size={28} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg w-fit border border-emerald-500/20">
                        <ArrowUpDown size={14} className="rotate-45" />
                        <span className="font-bold">+{(stats?.growth_percent || 0)}% vs last month</span>
                    </div>
                </div>

                {/* 2. DUE THIS MONTH */}
                <div
                    onClick={() => navigate('/admin/finance/breakdown/due_monthly')}
                    className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 cursor-pointer hover:shadow-amber-900/20 hover:border-amber-500/30 transition-all group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Due (This Month)</p>
                            <h3 className="text-4xl font-black text-white mt-1 group-hover:text-amber-300 transition-colors">
                                ৳{(stats?.due_this_month || 0).toLocaleString()}
                            </h3>
                        </div>
                        <div className="bg-amber-500/20 p-3 rounded-xl text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-lg shadow-amber-900/20">
                            <FileText size={28} />
                        </div>
                    </div>
                    <div className="text-xs text-slate-400 mt-2 font-medium">
                        Includes unpaid fees for current month only.
                    </div>
                </div>

                {/* 3. TOTAL ARREARS */}
                <div
                    onClick={() => navigate('/admin/finance/breakdown/due_overall')}
                    className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 cursor-pointer hover:shadow-red-900/20 hover:border-red-500/30 transition-all group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Total Dues (Overall)</p>
                            <h3 className="text-4xl font-black text-white mt-1 group-hover:text-red-300 transition-colors">
                                ৳{(stats?.total_due || 0).toLocaleString()}
                            </h3>
                        </div>
                        <div className="bg-red-500/20 p-3 rounded-xl text-red-400 group-hover:bg-red-500 group-hover:text-white transition-all shadow-lg shadow-red-900/20">
                            <AlertCircle size={28} />
                        </div>
                    </div>
                    <div className="text-xs text-slate-400 mt-2 font-medium">
                        Cumulative unpaid amount from all previous months.
                    </div>
                </div>
            </div>

            {/* HEADER ACTION ROW */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-white">All Transactions</h2>

                    {/* Print Selected Button */}
                    {selectedPayments.size > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearSelection}
                                className="px-3 py-1 bg-slate-700 text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-600 transition-all"
                            >
                                Clear ({selectedPayments.size})
                            </button>
                            <button
                                onClick={handleBatchPrintTrigger}
                                className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all animate-in fade-in zoom-in"
                            >
                                <Printer size={16} />
                                Print Selected
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => setSortDesc(!sortDesc)}
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                    >
                        <ArrowUpDown size={14} /> {sortDesc ? 'Newest First' : 'Oldest First'}
                    </button>
                    <span className="text-sm text-slate-500">
                        Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount}
                    </span>

                    {/* Date Filter (Moved from Filter Bar) */}
                    <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700 ml-4 animate-in fade-in slide-in-from-top-2">
                        <select
                            className="bg-transparent text-slate-300 outline-none text-sm font-medium pl-1"
                            value={dateMode}
                            onChange={(e) => {
                                setDateMode(e.target.value as 'all' | 'custom');
                                if (e.target.value === 'all') {
                                    setStartDate('');
                                    setEndDate('');
                                } else {
                                    // Default to Today
                                    const today = new Date().toISOString().split('T')[0];
                                    setStartDate(today);
                                    setEndDate(today);
                                }
                            }}
                        >
                            <option value="all" className="bg-slate-900">All Time</option>
                            <option value="custom" className="bg-slate-900">Custom Date</option>
                        </select>

                        {dateMode === 'custom' && (
                            <div className="flex items-center gap-1 px-1">
                                <input
                                    type="date"
                                    className="bg-slate-900 text-white text-xs p-1 rounded border border-slate-600 outline-none focus:border-blue-500 w-[110px]"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                <span className="text-slate-500">-</span>
                                <input
                                    type="date"
                                    className="bg-slate-900 text-white text-xs p-1 rounded border border-slate-600 outline-none focus:border-blue-500 w-[110px]"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-50 hover:bg-slate-700 transition-colors text-sm font-medium"
                    >
                        Previous
                    </button>
                    <span className="text-slate-400 text-sm font-medium">Page {page} of {totalPages || 1}</span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * pageSize >= totalCount}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-50 hover:bg-slate-700 transition-colors text-sm font-medium"
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* FILTERS BAR */}
            <div className="bg-slate-800/50 backdrop-blur-md p-4 rounded-xl shadow-lg border border-slate-700/50 flex flex-col md:flex-row gap-4 flex-wrap items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search Name, Receipt #, Student ID..."
                        className="pl-10 w-full rounded-lg border-slate-600 border p-2.5 bg-slate-900/50 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Roll No Search */}
                <div className="relative w-[120px]">
                    <input
                        type="text"
                        placeholder="Roll No..."
                        className="w-full rounded-lg border-slate-600 border p-2.5 bg-slate-900/50 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-500"
                        value={rollSearch}
                        onChange={(e) => setRollSearch(e.target.value)}
                    />
                </div>

                {/* Filters */}
                <select className="rounded-lg border-slate-600 border p-2.5 text-slate-300 bg-slate-900/50 focus:ring-2 focus:ring-blue-500 outline-none" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="" className="bg-slate-800">All Classes</option>
                    {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1} className="bg-slate-800">Class {i + 1}</option>)}
                </select>

                <select className="rounded-lg border-slate-600 border p-2.5 text-slate-300 bg-slate-900/50 focus:ring-2 focus:ring-blue-500 outline-none" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
                    <option value="" className="bg-slate-800">All Batches</option>
                    {batches?.map((b: any) => <option key={b.batch_id} value={b.batch_id} className="bg-slate-800">{b.batch_name}</option>)}
                </select>

                <select className="rounded-lg border-slate-600 border p-2.5 text-slate-300 bg-slate-900/50 focus:ring-2 focus:ring-blue-500 outline-none" value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
                    <option value="" className="bg-slate-800">All Programs</option>
                    {allPrograms?.map((p: any) => <option key={p.program_id} value={p.program_id} className="bg-slate-800">{p.program_name}</option>)}
                </select>
            </div>

            {/* LEDGER TABLE */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-xl border border-slate-700/50 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-bold border-b border-slate-700">
                        <tr>
                            <th className="p-5 w-10">
                                <button onClick={toggleAllOnPage} className="hover:text-white transition-colors">
                                    {(filteredPayments?.length > 0 && filteredPayments.every((p: any) => selectedPayments.has(p.sort_id || p.payment_id)))
                                        ? <CheckSquare size={18} className="text-blue-500" />
                                        : <Square size={18} />
                                    }
                                </button>
                            </th>
                            <th className="p-5">Receipt #</th>
                            <th className="p-5">Date</th>
                            <th className="p-5">Student</th>
                            <th className="p-5">Month/Year</th>
                            <th className="p-5 text-right">Amount</th>
                            <th className="p-5">Method</th>
                            <th className="p-5 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y divide-slate-700/50 ${isPaymentsLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isPaymentsLoading && (
                            <tr><td colSpan={7} className="p-10 text-center text-blue-400 animate-pulse">Loading transactions...</td></tr>
                        )}
                        {!isPaymentsLoading && filteredPayments?.map((p: any) => {
                            const isSelected = selectedPayments.has(p.sort_id || p.payment_id);
                            return (
                                <tr key={p.sort_id || p.payment_id} className={`hover:bg-slate-700/30 transition-colors group ${isSelected ? 'bg-blue-900/10' : ''}`}>
                                    <td className="p-5">
                                        <button onClick={() => toggleSelection(p)} className="hover:text-white transition-colors">
                                            {isSelected
                                                ? <CheckSquare size={18} className="text-blue-500" />
                                                : <Square size={18} className="text-slate-600" />
                                            }
                                        </button>
                                    </td>
                                    <td className="p-5 font-mono text-slate-500 group-hover:text-slate-300 transition-colors">#{p.sort_id}</td>
                                    <td className="p-5 text-slate-300 text-sm">{p.payment_date}</td>
                                    <td className="p-5">
                                        <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">{p.student_name}</div>
                                        <div className="text-xs text-blue-400 mt-0.5">{p.program_name}</div>
                                    </td>
                                    <td className="p-5 text-slate-300 text-sm font-medium">
                                        {p.date_display}
                                        {p.type === 'Bulk' && (
                                            <span className="ml-2 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded border border-purple-500/30">
                                                Bulk
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-5 text-right font-bold text-emerald-400 text-lg">৳{p.amount || p.paid_amount}</td>
                                    <td className="p-5 text-slate-400 text-sm">
                                        <span className="px-2 py-1 bg-slate-700/50 rounded text-xs border border-slate-600">{p.payment_method || 'Cash'}</span>
                                    </td>
                                    <td className="p-5 text-center flex justify-center gap-2">
                                        {/* Actions... */}
                                        {p.is_editable ? (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setEditPayment(p)}
                                                    className="text-slate-400 hover:text-blue-400 p-2 rounded-full hover:bg-slate-700/50 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm("Are you sure you want to delete this payment? This action cannot be undone.")) {
                                                            deleteMutation.mutate(p.sort_id || p.payment_id);
                                                        }
                                                    }}
                                                    className="text-slate-400 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                className="text-slate-700 cursor-not-allowed p-2 rounded-full"
                                                title="Only the most recent transaction can be edited/deleted"
                                                disabled
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleSinglePrint(p.sort_id || p.payment_id)}
                                            className="text-blue-400 hover:text-blue-300 p-2 rounded-full hover:bg-blue-500/10 transition-colors"
                                            title="Print Receipt"
                                        >
                                            <Download size={18} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {recentPayments?.length === 0 && (
                            <tr><td colSpan={7} className="p-16 text-center text-slate-500 italic">No payments recorded yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <AddPaymentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
            <EditPaymentModal isOpen={!!editPayment} onClose={() => setEditPayment(null)} payment={editPayment} />

            {/* HIDDEN PRINT CONTAINERS */}
            {/* 1. Batch Print Container */}
            <div style={{ display: "none" }}>
                <div ref={batchPrintRef}>
                    <div className="bg-white text-black p-8 flex flex-col gap-0">
                        {Array.from(selectedPayments.values())
                            .sort((a: any, b: any) => (b.sort_id || b.payment_id) - (a.sort_id || a.payment_id))
                            .map((p: any) => (
                                <div key={p.sort_id || p.payment_id} className="break-inside-avoid">
                                    <ReceiptTemplate payment={{
                                        ...p,
                                        paid_amount: p.amount || p.paid_amount
                                    }} />
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {/* 2. Single Print Container */}
            <div style={{ display: "none" }}>
                <div ref={singlePrintRef}>
                    <div className="bg-white text-black p-8">
                        {singlePrintId && filteredPayments
                            ?.filter((p: any) => (p.sort_id || p.payment_id) === singlePrintId)
                            .map((p: any) => (
                                <div key={p.sort_id || p.payment_id}>
                                    <ReceiptTemplate payment={{
                                        ...p,
                                        paid_amount: p.amount || p.paid_amount
                                    }} />
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

        </div>
    );
};

// --- EDIT PAYMENT MODAL ---
const EditPaymentModal: React.FC<{ isOpen: boolean; onClose: () => void; payment: any }> = ({ isOpen, onClose, payment }) => {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (payment) {
            // Support new backend format: total_amount vs paid_amount
            const amt = payment.total_amount || payment.paid_amount;
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
            // Find ledger entry for this payment's month
            const entry = status.ledger.find((l: any) => l.month === payment.month && l.year === payment.year);
            if (entry) {
                // The ledger "paid" includes THIS payment because it fetches from DB.
                // We want to know what OTHERS paid.
                // Sum of Others = entry.paid - payment.paid_amount (Old Value)
                // Cap = Fee - Sum of Others
                //     = Fee - (entry.paid - payment.paid_amount)
                //     = (Fee - entry.paid) + payment.paid_amount
                //     = entry.due + payment.paid_amount (roughly, if due is accurate)

                // Let's use the Fee - Others logic strictly.
                const paidByOthers = entry.paid - payment.paid_amount;
                const remainingCap = entry.fee - paidByOthers;

                setMaxCap(remainingCap);
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
            queryClient.invalidateQueries({ queryKey: ['finance'] });
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
                                    alert(`Cannot exceed ${maxCap}`);
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

// --- MODAL COMPONENT ---
const AddPaymentModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    // Search State
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [rollSearch, setRollSearch] = useState(''); // New separate search
    // Filters
    const [batchFilter, setBatchFilter] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [programFilter, setProgramFilter] = useState('');

    const [selectedStudent, setSelectedStudent] = useState<any>(null);

    // Form State
    const [selectedProgramId, setSelectedProgramId] = useState<string>('');
    const [remarks, setRemarks] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('Cash');

    // Payment Mode State
    const [mode, setMode] = useState<'single' | 'bulk'>('single');

    // Single Mode State
    const [singleMonth, setSingleMonth] = useState(new Date().getMonth() + 1);
    const [singleYear, setSingleYear] = useState(new Date().getFullYear());
    const [singleAmount, setSingleAmount] = useState('');

    // Bulk Mode State
    const [bulkEndMonth, setBulkEndMonth] = useState(new Date().getMonth() + 1);
    const [bulkEndYear, setBulkEndYear] = useState(new Date().getFullYear());

    const queryClient = useQueryClient();

    // 1. Search Students
    const { data: searchResults } = useQuery({
        queryKey: ['students', 'search'], // Removed query from key to just cache all
        queryFn: () => StudentRepository.getAllStudents(),
        // Always enabled effectively, or just enabled when modal is open? 
        // Better: enabled: true (React Query will cache it)
    });

    // 1b. Fetch Filter Data
    const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: ProgramRepository.getAllBatches });
    const { data: allPrograms } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms });

    // 2. Fetch Student Details
    const { data: fullStudentDetails } = useQuery({
        queryKey: ['student', selectedStudent?.student_id],
        queryFn: () => StudentRepository.getStudentById(selectedStudent?.student_id),
        enabled: !!selectedStudent
    });

    // 3. Get Enrollment & Fee Info
    const enrolledPrograms = fullStudentDetails?.enrollment?.map((e: any) => ({
        id: e.program.program_id,
        enrollment_id: e.enrollment_id, // Critical for backend
        name: e.program.program_name,
        fee: e.program.monthly_fee,
        enrollment_date: e.enrollment_date
    })) || [];

    const selectedProgram = enrolledPrograms.find((p: any) => p.id === Number(selectedProgramId));

    // 4. Fetch Payment Status (Ledger) for Selected Program
    const { data: paymentStatus } = useQuery({
        queryKey: ['payment_status', selectedProgram?.enrollment_id],
        queryFn: () => PaymentRepository.getPaymentStatus(selectedProgram.enrollment_id),
        enabled: !!selectedProgram
    });

    // Reset Form when Student Changes
    useEffect(() => {
        setSelectedProgramId('');
        resetPaymentFields();
    }, [selectedStudent]);

    // Auto-Set Fields based on FUM
    useEffect(() => {
        if (paymentStatus?.fum) {
            setSingleMonth(paymentStatus.fum.month);
            setSingleYear(paymentStatus.fum.year);
            // Auto-fill amount but allow decrease (up to capped amount)
            // Actually, for strictness, maybe auto-fill with exact due? Yes.
            setSingleAmount(paymentStatus.fum.due.toString());
        } else {
            resetPaymentFields();
        }
    }, [paymentStatus]); // Runs when payment status loads

    // Reset Fields logic
    const resetPaymentFields = () => {
        setMode('single');
        setSingleAmount('');
        setRemarks('');
    };

    const isMonthPaid = (m: number, y: number) => {
        if (!paymentStatus?.ledger) return false;
        const record = paymentStatus.ledger.find((l: any) => l.month === m && l.year === y);
        return record?.status === 'Paid';
    };

    // Calculate Bulk Logic
    // Calculate Bulk Logic
    const getBulkStart = () => {
        if (!paymentStatus || !selectedProgram) return { month: new Date().getMonth() + 1, year: new Date().getFullYear() };

        // FUM is the Single Source of Truth for Start Date
        if (paymentStatus.fum) {
            return { month: paymentStatus.fum.month, year: paymentStatus.fum.year };
        }

        // Fallback (Should rarely reach here if FUM logic covers "Next Month")
        return { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    };

    const bulkStart = getBulkStart();

    // Calculate Bulk Total & Validate
    // Calculate Bulk Total & Validate
    const calculateBulkTotal = () => {
        if (!selectedProgram) return 0;

        let total = 0;
        let currM = bulkStart.month;
        let currY = bulkStart.year;
        const endTotal = bulkEndYear * 12 + bulkEndMonth;

        // Loop from Start to End
        while ((currY * 12 + currM) <= endTotal) {
            // Logic:
            // 1. If this is the FUM (Start Month), we pay 'Due' amount (which accounts for partials).
            // 2. If this is a future month, we pay full 'Fee'.
            // 3. We do check 'isMonthPaid' just in case user selects a range that overlaps paid future?
            //    But with strict FUM start, overlaps should only happen if FUM is partial (handled) or user extends WAY future.

            if (currM === paymentStatus?.fum?.month && currY === paymentStatus?.fum?.year) {
                total += (paymentStatus.fum.due || 0);
            } else {
                // Future months are full fee
                if (!isMonthPaid(currM, currY)) {
                    total += (selectedProgram.fee || 0);
                }
            }

            if (currM === 12) { currM = 1; currY++; } else { currM++; }
        }
        return total;
    };

    // Check if Bulk Selection is Valid (No overlaps)
    const isBulkRangeValid = () => {
        let currM = bulkStart.month;
        let currY = bulkStart.year;
        const endTotal = bulkEndYear * 12 + bulkEndMonth;

        while ((currY * 12 + currM) <= endTotal) {
            if (isMonthPaid(currM, currY)) return false;
            if (currM === 12) { currM = 1; currY++; } else { currM++; }
        }
        return true;
    };

    // Prepare Payload
    const mutation = useMutation({
        mutationFn: (data: any) => mode === 'single'
            ? PaymentRepository.createPayment(data) // Legacy/Single wrapper
            : PaymentRepository.createBulkPayment(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['payment_status'] });
            if (data && (data.success !== undefined || data.failed !== undefined)) {
                // Handle Bulk Response (Auto-detect based on shape)
                const successCount = data.success || 0;
                const failureCount = data.failed ? data.failed.length : 0;

                if (failureCount > 0) {
                    const failMsg = data.failed.map((f: any) => `• ${f.student_name}: ${f.reason}`).join('\n');
                    alert(`⚠️ Payment Recorded with Issues:\n\n✅ ${successCount} payments successful.\n❌ ${failureCount} payments failed due to prior dues:\n\n${failMsg}\n\nPlease clear previous dues for these students first.`);

                    if (successCount > 0) {
                        // Partial Success: Close and Reset
                        onClose();
                        resetPaymentFields();
                    } else {
                        // All Failed: Keep modal open, Don't reset fields
                        // This allows user to see what they tried or change selection without re-entering everything.
                    }
                } else {
                    alert(`✅ Successfully recorded ${successCount} payments!`);
                    onClose();
                    resetPaymentFields();
                }
            } else {
                // Single Payment or Legacy
                alert("Payment Recorded!");
                onClose();
                resetPaymentFields();
            }
        },
        onError: (err) => alert("Error: " + err)
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProgram) return;

        if (mode === 'single') {
            mutation.mutate({
                student_id: selectedStudent.student_id,
                program_id: selectedProgram.id,
                enrollment_id: selectedProgram.enrollment_id, // Send explicit ID
                paid_amount: parseFloat(singleAmount),
                payment_date: date,
                month: singleMonth,
                year: singleYear,
                payment_method: paymentMethod,
                remarks: remarks
            });
        } else {
            // Generate List for Bulk
            const payload = [];
            let currM = bulkStart.month;
            let currY = bulkStart.year;
            // Target
            const endTotal = bulkEndYear * 12 + bulkEndMonth;

            while ((currY * 12 + currM) <= endTotal) {
                // Determine Amount: FUM Due vs Full Fee
                let amount = selectedProgram.fee;
                let isFum = (currM === paymentStatus?.fum?.month && currY === paymentStatus?.fum?.year);

                if (isFum) {
                    amount = paymentStatus.fum.due;
                }

                // Skip if fully paid (unless it's FUM Partial, which we just handled)
                // Note: FUM will show as Partial or Unpaid, so we won't skip it blindly.
                // Strictly speaking, we shouldn't target already Paid months.
                const alreadyPaid = isMonthPaid(currM, currY);
                if (alreadyPaid && !isFum) { // FUM might be partial, so 'isMonthPaid' returns false (it checks status==Paid)
                    // Skip paid months
                } else {
                    payload.push({
                        student_id: selectedStudent.student_id,
                        program_id: selectedProgram.id,
                        enrollment_id: selectedProgram.enrollment_id,
                        paid_amount: amount,
                        payment_date: date,
                        month: currM,
                        year: currY,
                        payment_method: paymentMethod,
                        remarks: `Bulk Payment (${currM}/${currY}) - ${remarks}`,
                    });
                }

                // Increment
                if (currM === 12) { currM = 1; currY++; } else { currM++; }
            }
            mutation.mutate(payload);
        }
    };



    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                    <h3 className="font-bold text-xl text-white">Record New Payment</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-white transition-colors" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* STEP 1: STUDENT & PROGRAM */}
                    {!selectedStudent ? (
                        <div className="space-y-4">
                            {/* Filters */}
                            <div className="flex gap-2 mb-2">
                                <select className="p-2.5 border border-slate-600 rounded-xl text-sm bg-slate-900 text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none flex-1" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                                    <option value="" className="bg-slate-800">All Classes</option>
                                    {[...Array(12)].map((_, i) => <option key={i} value={i + 1} className="bg-slate-800">Class {i + 1}</option>)}
                                </select>
                                <select className="p-2.5 border border-slate-600 rounded-xl text-sm bg-slate-900 text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none flex-1" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
                                    <option value="" className="bg-slate-800">All Batches</option>
                                    {batches?.map((b: any) => <option key={b.batch_id} value={b.batch_id} className="bg-slate-800">{b.batch_name}</option>)}
                                </select>
                                <select className="p-2.5 border border-slate-600 rounded-xl text-sm bg-slate-900 text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none flex-1" value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
                                    <option value="" className="bg-slate-800">All Programs</option>
                                    {allPrograms?.map((p: any) => <option key={p.program_id} value={p.program_id} className="bg-slate-800">{p.program_name}</option>)}
                                </select>
                            </div>

                            {/* Search UI */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search Name or ID..."
                                        className="w-full pl-10 p-3 border border-slate-600 rounded-xl bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-600"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="relative w-1/3">
                                    <input
                                        type="text"
                                        placeholder="Roll No..."
                                        className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-600"
                                        value={rollSearch}
                                        onChange={e => setRollSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            {(searchQuery.length > 0 || rollSearch.length > 0) && (
                                <ul className="border border-slate-700 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-700 bg-slate-800">
                                    {searchResults
                                        ?.filter((s: any) => {
                                            const term = searchQuery.toLowerCase();
                                            const rollTerm = rollSearch.toLowerCase();

                                            const matchesName = s.name.toLowerCase().includes(term) || s.student_id.toString().includes(term) || (s.student_code || '').toString().includes(term);
                                            // Roll Matches (Logic from StudentList)
                                            let matchesRoll = true;
                                            if (rollTerm) {
                                                if (programFilter) {
                                                    const enrollment = s.enrollment?.find((e: any) => e.program_id.toString() === programFilter);
                                                    matchesRoll = enrollment?.roll_no?.toString().toLowerCase().includes(rollTerm) || false;
                                                } else {
                                                    matchesRoll = s.enrollment?.some((e: any) => e.roll_no && e.roll_no.toString().toLowerCase().includes(rollTerm)) || false;
                                                }
                                            }

                                            const matchesBatch = batchFilter ? s.batch_id?.toString() === batchFilter : true;
                                            const matchesClass = classFilter ? s.class?.toString() === classFilter : true;
                                            const matchesProgram = programFilter ? s.enrollment?.some((e: any) => e.program_id.toString() === programFilter) : true;

                                            return matchesName && matchesRoll && matchesBatch && matchesClass && matchesProgram;
                                        })
                                        .map((s: any) => (
                                            <li key={s.student_id} onClick={() => { setSelectedStudent(s); setSearchQuery(''); setRollSearch(''); }} className="p-3 hover:bg-slate-700 cursor-pointer transition-colors">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-bold text-white">{s.name}</div>
                                                        <div className="text-xs text-slate-400">ID: {s.student_code || s.student_id}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        {s.enrollment?.map((e: any, idx: number) => (
                                                            <div key={idx} className="text-xs text-slate-300 bg-slate-700/50 px-1.5 py-0.5 rounded mb-1 inline-block ml-1 border border-slate-600">
                                                                <span className="font-bold">{e.roll_no || '?'}</span> - {e.program?.program_name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex justify-between items-center">
                                <div className="font-bold text-blue-300 text-lg">{selectedStudent.name} <span className="text-sm text-blue-400/70 ml-2">(ID: {selectedStudent.student_code || selectedStudent.student_id})</span></div>
                                <button type="button" onClick={() => setSelectedStudent(null)} className="text-sm text-red-400 hover:text-red-300 underline font-medium">Change</button>
                            </div>

                            {/* Program Select */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Select Program</label>
                                <select
                                    required
                                    className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedProgramId}
                                    onChange={e => setSelectedProgramId(e.target.value)}
                                >
                                    <option value="" className="bg-slate-800">-- Choose --</option>
                                    {enrolledPrograms.map((p: any) => (
                                        <option key={p.id} value={p.id} className="bg-slate-800">{p.name} (৳{p.fee})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: DYNAMIC TABS (Only if Program Selected) */}
                    {selectedProgram && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            {/* Status Banner */}
                            <div className="bg-slate-700/30 p-4 rounded-xl mb-6 border border-slate-600/50 text-sm">
                                <div className="flex justify-between mb-2">
                                    <div>
                                        <span className="text-slate-400 block mb-0.5">Paid Fully Until</span>
                                        <span className="font-bold text-emerald-400 text-lg">{paymentStatus?.paid_up_to || 'None'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-400 block mb-0.5">Total Dues</span>
                                        <span className="font-bold text-red-500 text-lg">৳{paymentStatus?.total_due || 0}</span>
                                    </div>
                                </div>

                                {paymentStatus?.enrollment_date && (
                                    <div className="text-xs text-slate-500 border-t border-slate-600/50 pt-2 mb-2">
                                        Joined: {new Date(paymentStatus.enrollment_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>
                                )}

                                {paymentStatus?.fum && paymentStatus.fum.status === 'Partial' && (
                                    <div className="bg-amber-500/10 text-amber-400 p-3 rounded-lg text-xs border border-amber-500/20 mt-2">
                                        <strong>⚠️ Partial Payment:</strong> {new Date(0, paymentStatus.fum.month - 1).toLocaleString('default', { month: 'long' })} {paymentStatus.fum.year} is partially paid.
                                        Clear remaining ৳{paymentStatus.fum.due} first.
                                    </div>
                                )}
                            </div>

                            {/* Mode Tabs */}
                            <div className="flex border-b border-slate-700 mb-6">
                                <button
                                    type="button"
                                    onClick={() => setMode('single')}
                                    className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${mode === 'single' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                                >
                                    Single Month
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('bulk')}
                                    className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${mode === 'bulk' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                                >
                                    Bulk / Advance
                                </button>
                            </div>

                            {/* SINGLE MODE */}
                            {mode === 'single' && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                                        <label className="block text-xs font-bold text-blue-400 mb-1 uppercase tracking-wide">Paying For (Locked)</label>
                                        <div className="text-2xl font-bold text-white">
                                            {new Date(0, singleMonth - 1).toLocaleString('default', { month: 'long' })} {singleYear}
                                        </div>
                                        <div className="text-xs text-blue-300/70 mt-1">
                                            Strict Sequencing Active: You must clear the earliest unpaid month first.
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1">
                                            Amount (৳) - Max: {paymentStatus?.fum?.due}
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900 text-emerald-400 font-bold text-lg focus:ring-2 focus:ring-emerald-500 outline-none placeholder-slate-600"
                                            value={singleAmount}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value);
                                                const max = paymentStatus?.fum?.due || 0;
                                                if (val > max) {
                                                    alert(`Cannot pay more than remaining due of ৳${max}`);
                                                    setSingleAmount(max.toString());
                                                } else {
                                                    setSingleAmount(e.target.value);
                                                }
                                            }}
                                            placeholder={`Due: ${paymentStatus?.fum?.due}`}
                                            max={paymentStatus?.fum?.due}
                                            onWheel={(e) => (e.target as HTMLElement).blur()}
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Enter amount to pay. Cannot exceed remaining due for this month.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* BULK MODE */}
                            {mode === 'bulk' && (
                                <div className="space-y-4 bg-blue-500/5 p-5 rounded-xl border border-blue-500/10 animate-in fade-in">
                                    <div className="flex justify-between items-center text-sm">
                                        <div>
                                            <span className="block text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Start Month</span>
                                            <span className="font-bold text-white text-lg">{new Date(0, bulkStart.month - 1).toLocaleString('default', { month: 'long' })} {bulkStart.year}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">End Month</span>
                                            <div className="flex gap-2">
                                                <select
                                                    className="p-2 border border-slate-600 rounded-lg bg-slate-900 text-white text-sm outline-none focus:border-blue-500"
                                                    value={bulkEndMonth}
                                                    onChange={e => setBulkEndMonth(Number(e.target.value))}
                                                >
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                                        const isDisabled = (bulkEndYear < bulkStart.year) || (bulkEndYear === bulkStart.year && m < bulkStart.month);
                                                        return (
                                                            <option key={m} value={m} disabled={isDisabled} className={isDisabled ? "text-slate-600 bg-slate-800" : "bg-slate-800"}>
                                                                {new Date(0, m - 1).toLocaleString('default', { month: 'short' })}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <input
                                                    type="number"
                                                    className="w-20 p-2 border border-slate-600 rounded-lg bg-slate-900 text-white text-sm outline-none focus:border-blue-500"
                                                    value={bulkEndYear}
                                                    min={bulkStart.year}
                                                    onChange={e => {
                                                        const val = Number(e.target.value);
                                                        if (val < bulkStart.year) return; // Prevent going back
                                                        setBulkEndYear(val);
                                                    }}
                                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-blue-500/20 flex justify-between items-center">
                                        <span className="font-bold text-blue-300">Total Payable</span>
                                        <span className="text-2xl font-black text-blue-400">৳{calculateBulkTotal()}</span>
                                    </div>
                                    <p className="text-xs text-blue-400/60 italic">* Bulk payments must be paid in full.</p>
                                </div>
                            )}

                            {/* COMMON FIELDS */}
                            <div className="mt-6 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Date</label>
                                    <input type="date" required className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900 text-white outline-none focus:ring-2 focus:ring-blue-500" value={date} onChange={e => setDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Method</label>
                                    <select className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900 text-white outline-none focus:ring-2 focus:ring-blue-500" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                        <option className="bg-slate-800">Cash</option>
                                        <option className="bg-slate-800">Bank Transfer</option>
                                        <option className="bg-slate-800">bKash</option>
                                        <option className="bg-slate-800">Nagad</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className="block text-xs font-bold text-slate-400 mb-1">Remarks</label>
                                <textarea className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900 text-white outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)}></textarea>
                            </div>
                        </div>
                    )}

                    {/* FOOTER */}
                    <div className="pt-6 border-t border-slate-700 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-300 hover:bg-slate-700 rounded-xl font-medium transition-colors">Cancel</button>
                        <button
                            type="submit"
                            disabled={mutation.isPending || !selectedStudent || !selectedProgram || (mode === 'bulk' && !isBulkRangeValid())}
                            className={`px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 hover:scale-105 transition-all ${mutation.isPending || (mode === 'bulk' && !isBulkRangeValid()) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {mutation.isPending ? 'Processing...' : `Pay ${mode === 'bulk' ? '৳' + calculateBulkTotal() : ''}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Finance;
