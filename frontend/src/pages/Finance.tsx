import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { DollarSign, Search, Plus, FileText, Download, X, Calendar, User, ArrowUpDown, Edit, Filter, Users, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { generatePaymentSlip } from '../utils/pdfGenerator';

import BatchPaymentModal from '../components/BatchPaymentModal';

const Finance: React.FC = () => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [editPayment, setEditPayment] = useState<any>(null); // For edit modal
    const [sortDesc, setSortDesc] = useState(true); // Default Descending
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Auto-Action Logic
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        if (searchParams.get('action') === 'payment') {
            setIsModalOpen(true);
            setSearchParams(params => {
                params.delete('action');
                return params;
            });
        }
    }, [searchParams, setSearchParams]);

    // Fetch Recent Payments
    // We sort client-side for the 'Recent' list toggle
    const { data: rawPayments } = useQuery({
        queryKey: ['payments', 'recent'],
        queryFn: PaymentRepository.getRecentPayments
    });

    const recentPayments = React.useMemo(() => {
        if (!rawPayments) return [];
        return [...rawPayments].sort((a, b) => {
            return sortDesc ? (b.payment_id - a.payment_id) : (a.payment_id - b.payment_id);
        });
    }, [rawPayments, sortDesc]);

    // --- SEARCH & FILTER STATES ---
    const [searchTerm, setSearchTerm] = useState('');
    const [rollSearch, setRollSearch] = useState('');
    const [batchFilter, setBatchFilter] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [programFilter, setProgramFilter] = useState('');

    // Fetch Batches & Programs for Filters
    const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: ProgramRepository.getAllBatches });
    const { data: allPrograms } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms });

    // Fetch Global Stats
    const { data: stats } = useQuery({
        queryKey: ['finance', 'stats'],
        queryFn: PaymentRepository.getFinanceStats
    });

    // --- FILTER LOGIC ---
    const filteredPayments = React.useMemo(() => {
        return recentPayments.filter((p: any) => {
            const term = searchTerm.toLowerCase();
            const rollTerm = rollSearch.toLowerCase();

            // 1. Main Search: Name, Payment ID, or Student ID
            const matchesMain =
                (p.student_name || '').toLowerCase().includes(term) ||
                (p.sort_id || p.payment_id).toString().includes(term) ||
                (p.student_id || '').toString().includes(term);

            // 2. Roll Search
            const matchesRoll = rollTerm ? (p.roll_no || '').toString().toLowerCase().includes(rollTerm) : true;

            // 3. Filters
            const matchesClass = classFilter ? p.class?.toString() === classFilter : true;
            const matchesBatch = batchFilter ? p.batch_id?.toString() === batchFilter : true;
            const matchesProgram = programFilter ? p.program_id?.toString() === programFilter : true;

            return matchesMain && matchesRoll && matchesClass && matchesBatch && matchesProgram;
        });
    }, [recentPayments, searchTerm, rollSearch, batchFilter, classFilter, programFilter]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <DollarSign className="text-green-600" /> Finance & Accounts
                </h1>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsBatchModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 flex items-center gap-2 font-medium"
                    >
                        <Users size={18} /> Record Batch Payment
                    </button>
                    <button
                        onClick={() => { setEditPayment(null); setIsModalOpen(true); }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-green-700 flex items-center gap-2 font-medium"
                    >
                        <Plus size={18} /> Record Single Payment
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
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Revenue (This Month)</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-1 group-hover:text-green-600 transition-colors">
                                ৳{(stats?.revenue_this_month || 0).toLocaleString()}
                            </h3>
                        </div>
                        <div className="bg-green-100 p-3 rounded-xl">
                            <DollarSign className="text-green-600" size={24} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg w-fit">
                        <ArrowUpDown size={14} className="rotate-45" />
                        <span className="font-medium">+{(stats?.growth_percent || 0)}% vs last month</span>
                    </div>
                </div>

                {/* 2. DUE THIS MONTH */}
                <div
                    onClick={() => navigate('/admin/finance/breakdown/due_monthly')}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Due (This Month)</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-1 group-hover:text-amber-600 transition-colors">
                                ৳{(stats?.due_this_month || 0).toLocaleString()}
                            </h3>
                        </div>
                        <div className="bg-amber-100 p-3 rounded-xl">
                            <FileText className="text-amber-600" size={24} />
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                        Includes unpaid fees for current month only.
                    </div>
                </div>

                {/* 3. TOTAL ARREARS */}
                <div
                    onClick={() => navigate('/admin/finance/breakdown/due_overall')}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Arrears (Overall)</p>
                            <h3 className="text-3xl font-bold text-gray-900 mt-1 group-hover:text-red-600 transition-colors">
                                ৳{(stats?.total_due || 0).toLocaleString()}
                            </h3>
                        </div>
                        <div className="bg-red-100 p-3 rounded-xl">
                            <AlertCircle className="text-red-600" size={24} />
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                        Cumulative unpaid amount from all previous months.
                    </div>
                </div>
            </div>

            {/* HEADER ACTION ROW */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800">Recent Transactions</h2>
                    <button
                        onClick={() => setSortDesc(!sortDesc)}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                    >
                        <ArrowUpDown size={14} /> {sortDesc ? 'Newest First' : 'Oldest First'}
                    </button>
                    <span className="text-sm text-gray-400">({filteredPayments.length} found)</span>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 shadow-sm"
                >
                    <Plus size={18} /> Record New Payment
                </button>
            </div>

            {/* FILTERS BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 flex-wrap items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search Name, Receipt #, Student ID..."
                        className="pl-10 w-full rounded-lg border-gray-300 border p-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Roll No Search */}
                <div className="relative w-[120px]">
                    <input
                        type="text"
                        placeholder="Roll No..."
                        className="w-full rounded-lg border-gray-300 border p-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={rollSearch}
                        onChange={(e) => setRollSearch(e.target.value)}
                    />
                </div>

                {/* Filters */}
                <select className="rounded-lg border-gray-300 border p-2 text-gray-700 bg-white" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="">All Classes</option>
                    {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>Class {i + 1}</option>)}
                </select>

                <select className="rounded-lg border-gray-300 border p-2 text-gray-700 bg-white" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
                    <option value="">All Batches</option>
                    {batches?.map((b: any) => <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>)}
                </select>

                <select className="rounded-lg border-gray-300 border p-2 text-gray-700 bg-white" value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
                    <option value="">All Programs</option>
                    {allPrograms?.map((p: any) => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                </select>


            </div>

            {/* LEDGER TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b">
                        <tr>
                            <th className="p-4">Receipt #</th>
                            <th className="p-4">Date</th>
                            <th className="p-4">Student</th>
                            <th className="p-4">Month/Year</th>
                            <th className="p-4 text-right">Amount</th>
                            <th className="p-4">Method</th>
                            <th className="p-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredPayments?.map((p: any) => {
                            // Backend now returns 'date_display' and 'type' and 'total_amount'
                            // p.sort_id is the ID to key by
                            return (
                                <tr key={p.sort_id || p.payment_id} className="hover:bg-gray-50">
                                    <td className="p-4 font-mono text-gray-500">#{p.sort_id}</td>
                                    <td className="p-4 text-gray-700 text-sm">{p.payment_date}</td>
                                    <td className="p-4 font-medium text-gray-900">
                                        {p.student_name}
                                        {/* <span className="block text-xs text-gray-400">Roll: {p.roll_no || '-'}</span> */}
                                        <span className="block text-xs text-blue-500">{p.program_name}</span>
                                    </td>
                                    <td className="p-4 text-gray-800 text-sm font-medium">
                                        {p.date_display}
                                        {p.type === 'Bulk' && (
                                            <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded border border-purple-200">
                                                Bulk
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right font-bold text-green-600">৳{p.total_amount || p.paid_amount}</td>
                                    <td className="p-4 text-gray-600 text-sm">
                                        <span className="px-2 py-1 bg-gray-100 rounded text-xs border">{p.payment_method || 'Cash'}</span>
                                    </td>
                                    <td className="p-4 text-center flex justify-center gap-2">
                                        {p.is_editable ? (
                                            <button
                                                onClick={() => setEditPayment(p)} // We need to handle Edit for Group vs Single? Backend update_payment is for single ID.
                                                // Wait, Phase 18 Step 3 allows editing "Entire Group".
                                                // My 'editPayment' takes a 'payment' object.
                                                // If I pass the group object, the modal needs to handle it.
                                                // For now, let's allow editing the MAIN ID (sort_id) or disable if bulk?
                                                // User said: "If Bulk, admin can edit the entire group (or any record)".
                                                // To keep it simple: We treat it as one unit. The Modal should technically loop updates?
                                                // LIMITATION: 'update_payment' is single ID capable.
                                                // For Bulk rows, p.payment_ids is a list.
                                                // Let's Disable Edit for Bulk for a moment OR allow editing just the Amount (Total)?
                                                // "Admin can edit the entire group".
                                                // Let's pass the whole object to EditPaymentModal and upgrade the Modal later.
                                                // For now, let's just pass 'p'. 
                                                className="text-gray-500 hover:text-blue-600 p-2 rounded-full hover:bg-gray-100"
                                                title="Edit"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        ) : (
                                            <button
                                                className="text-gray-300 cursor-not-allowed p-2 rounded-full"
                                                title="Only the most recent transaction can be edited"
                                                disabled
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => generatePaymentSlip(p)}
                                            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                            title="Download Receipt"
                                        >
                                            <Download size={18} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {recentPayments?.length === 0 && (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-400">No payments recorded yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <AddPaymentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
            <EditPaymentModal isOpen={!!editPayment} onClose={() => setEditPayment(null)} payment={editPayment} />

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h3 className="font-bold text-lg mb-4">Edit Payment #{payment.payment_id}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                            Amount (Max: {maxCap !== Infinity ? maxCap : '...'})
                        </label>
                        <input
                            type="number"
                            required
                            className="w-full p-2 border rounded font-bold text-green-700"
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
                        {isBulk && <p className="text-xs text-orange-500 mt-1">Bulk payment amounts cannot be edited directly.</p>}
                        {maxCap !== Infinity && (
                            <p className="text-xs text-gray-400 mt-1">
                                Fee: {payment?.paid_amount + (maxCap - payment?.paid_amount)} | Cap reflects adjusted fee limit.
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Method</label>
                        <select className="w-full p-2 border rounded" value={method} onChange={e => setMethod(e.target.value)}>
                            <option>Cash</option>
                            <option>Bank Transfer</option>
                            <option>bKash</option>
                            <option>Nagad</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Remarks</label>
                        <textarea className="w-full p-2 border rounded" value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Changes</button>
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['payment_status'] });
            onClose();
            alert("Payment Recorded!");
            resetPaymentFields();
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Record New Payment</h3>
                    <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* STEP 1: STUDENT & PROGRAM */}
                    {!selectedStudent ? (
                        <div className="space-y-4">
                            {/* Search UI (Simplified for brevity, similar to before) */}
                            {/* Filters */}
                            <div className="flex gap-2 mb-2">
                                <select className="p-2 border rounded-lg text-sm bg-gray-50 flex-1" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                                    <option value="">All Classes</option>
                                    {[...Array(12)].map((_, i) => <option key={i} value={i + 1}>Class {i + 1}</option>)}
                                </select>
                                <select className="p-2 border rounded-lg text-sm bg-gray-50 flex-1" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
                                    <option value="">All Batches</option>
                                    {batches?.map((b: any) => <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>)}
                                </select>
                                <select className="p-2 border rounded-lg text-sm bg-gray-50 flex-1" value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
                                    <option value="">All Programs</option>
                                    {allPrograms?.map((p: any) => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                                </select>
                            </div>

                            {/* Search UI */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search Name or ID..."
                                        className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="relative w-1/3">
                                    <input
                                        type="text"
                                        placeholder="Roll No..."
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={rollSearch}
                                        onChange={e => setRollSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            {(searchQuery.length > 0 || rollSearch.length > 0) && (
                                <ul className="border rounded-lg max-h-60 overflow-y-auto divide-y">
                                    {searchResults
                                        ?.filter((s: any) => {
                                            const term = searchQuery.toLowerCase();
                                            const rollTerm = rollSearch.toLowerCase();

                                            const matchesName = s.name.toLowerCase().includes(term) || s.student_id.toString().includes(term);
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
                                            <li key={s.student_id} onClick={() => { setSelectedStudent(s); setSearchQuery(''); setRollSearch(''); }} className="p-3 hover:bg-blue-50 cursor-pointer">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-bold text-gray-800">{s.name}</div>
                                                        <div className="text-xs text-gray-500">ID: {s.student_id}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        {s.enrollment?.map((e: any, idx: number) => (
                                                            <div key={idx} className="text-xs text-gray-600 bg-gray-100 px-1 rounded mb-1 inline-block ml-1">
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
                            <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center">
                                <div className="font-bold text-blue-900">{selectedStudent.name} (ID: {selectedStudent.student_id})</div>
                                <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs text-red-600 underline">Change</button>
                            </div>

                            {/* Program Select */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Program</label>
                                <select
                                    required
                                    className="w-full p-2 border rounded-lg"
                                    value={selectedProgramId}
                                    onChange={e => setSelectedProgramId(e.target.value)}
                                >
                                    <option value="">-- Choose --</option>
                                    {enrolledPrograms.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} (৳{p.fee})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: DYNAMIC TABS (Only if Program Selected) */}
                    {selectedProgram && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            {/* Status Banner */}
                            <div className="bg-gray-100 p-3 rounded mb-4 text-sm">
                                <div className="flex justify-between mb-2">
                                    <div>
                                        <span className="text-gray-500 block">Paid Fully Until:</span>
                                        <span className="font-bold text-green-700">{paymentStatus?.paid_up_to || 'None'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-gray-500 block">Total Arrears:</span>
                                        <span className="font-bold text-red-600">৳{paymentStatus?.total_due || 0}</span>
                                    </div>
                                </div>

                                {paymentStatus?.enrollment_date && (
                                    <div className="text-xs text-gray-500 border-t border-gray-200 pt-2 mb-2">
                                        Joined: {new Date(paymentStatus.enrollment_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>
                                )}

                                {paymentStatus?.fum && paymentStatus.fum.status === 'Partial' && (
                                    <div className="bg-yellow-100 text-yellow-800 p-2 rounded text-xs border border-yellow-200">
                                        <strong>⚠️ Partial Payment Detected:</strong> {new Date(0, paymentStatus.fum.month - 1).toLocaleString('default', { month: 'long' })} {paymentStatus.fum.year} is partially paid.
                                        You must clear the remaining ৳{paymentStatus.fum.due} before proceeding.
                                    </div>
                                )}
                            </div>

                            {/* Mode Tabs */}
                            <div className="flex border-b mb-4">
                                <button
                                    type="button"
                                    onClick={() => setMode('single')}
                                    className={`flex-1 py-2 text-sm font-bold ${mode === 'single' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                                >
                                    Single Month
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('bulk')}
                                    className={`flex-1 py-2 text-sm font-bold ${mode === 'bulk' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                                >
                                    Bulk / Advance
                                </button>
                            </div>

                            {/* SINGLE MODE */}
                            {mode === 'single' && (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                        <label className="block text-xs font-bold text-blue-800 mb-1 uppercase tracking-wide">Paying For (Locked)</label>
                                        <div className="text-lg font-bold text-blue-900">
                                            {new Date(0, singleMonth - 1).toLocaleString('default', { month: 'long' })} {singleYear}
                                        </div>
                                        <div className="text-xs text-blue-600 mt-1">
                                            Strict Sequencing Active: You must clear the earliest unpaid month first.
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">
                                            Amount (৳) - Max: {paymentStatus?.fum?.due}
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full p-2 border rounded font-bold text-green-700 text-lg"
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
                                        <p className="text-xs text-gray-400 mt-1">
                                            Enter amount to pay. Cannot exceed remaining due for this month.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* BULK MODE */}
                            {mode === 'bulk' && (
                                <div className="space-y-4 bg-blue-50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center text-sm">
                                        <div>
                                            <span className="block text-gray-500">Start Month:</span>
                                            <span className="font-bold">{new Date(0, bulkStart.month - 1).toLocaleString('default', { month: 'long' })} {bulkStart.year}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-gray-500">End Month:</span>
                                            <div className="flex gap-1">
                                                <select
                                                    className="p-1 border rounded text-sm"
                                                    value={bulkEndMonth}
                                                    onChange={e => setBulkEndMonth(Number(e.target.value))}
                                                >
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                                        const isDisabled = (bulkEndYear < bulkStart.year) || (bulkEndYear === bulkStart.year && m < bulkStart.month);
                                                        return (
                                                            <option key={m} value={m} disabled={isDisabled} className={isDisabled ? "text-gray-300" : ""}>
                                                                {new Date(0, m - 1).toLocaleString('default', { month: 'short' })}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <input
                                                    type="number"
                                                    className="w-16 p-1 border rounded text-sm"
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
                                    <div className="pt-2 border-t border-blue-100 flex justify-between items-center">
                                        <span className="font-bold text-blue-900">Total Payable:</span>
                                        <span className="text-xl font-bold text-blue-700">৳{calculateBulkTotal()}</span>
                                    </div>
                                    <p className="text-xs text-blue-600 italic">* Bulk payments must be paid in full.</p>
                                </div>
                            )}

                            {/* COMMON FIELDS */}
                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                                    <input type="date" required className="w-full p-2 border rounded" value={date} onChange={e => setDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Method</label>
                                    <select className="w-full p-2 border rounded" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                        <option>Cash</option>
                                        <option>Bank Transfer</option>
                                        <option>bKash</option>
                                        <option>Nagad</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Remarks</label>
                                <textarea className="w-full p-2 border rounded" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)}></textarea>
                            </div>
                        </div>
                    )}

                    {/* FOOTER */}
                    <div className="pt-4 border-t flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                        <button
                            type="submit"
                            disabled={mutation.isPending || !selectedStudent || !selectedProgram || (mode === 'bulk' && !isBulkRangeValid())}
                            className={`px-6 py-2 bg-green-600 text-white rounded font-bold shadow hover:bg-green-700 ${mutation.isPending || (mode === 'bulk' && !isBulkRangeValid()) ? 'opacity-50' : ''}`}
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
