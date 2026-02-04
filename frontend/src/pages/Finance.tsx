import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository'; // Keep for now if needed, but we rely on student enrollments
import { DollarSign, Search, Plus, FileText, Download, X, Calendar, User } from 'lucide-react';
import jsPDF from 'jspdf';

const Finance: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const queryClient = useQueryClient();

    // Fetch Recent Payments
    const { data: recentPayments } = useQuery({
        queryKey: ['payments', 'recent'],
        queryFn: PaymentRepository.getRecentPayments
    });

    // Fetch Global Stats
    const { data: stats } = useQuery({
        queryKey: ['finance', 'stats'],
        queryFn: PaymentRepository.getFinanceStats
    });

    // --- PDF SLIP GENERATOR ---
    const generateSlip = (payment: any) => {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [210, 99]
        });

        // Watermark / Header
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text("Coaching Centre Name", 10, 15);
        doc.setFontSize(10);
        doc.text("Address Line 1, City", 10, 20);

        doc.setFontSize(16);
        doc.text("MONEY RECEIPT", 160, 15, { align: 'right' });
        doc.setLineWidth(0.5);
        doc.line(10, 25, 200, 25);

        // Details
        doc.setFontSize(12);
        doc.text(`Receipt No: #${payment.payment_id}`, 10, 35);
        doc.text(`Date: ${payment.payment_date}`, 160, 35, { align: 'right' });

        doc.text(`Received with thanks from:`, 10, 45);
        doc.setFont('helvetica', 'bold');
        doc.text(`${payment.student_name} (Roll: ${payment.roll_no || '-'})`, 65, 45);

        doc.setFont('helvetica', 'normal');
        doc.text(`Program:`, 10, 52);
        doc.text(`${payment.program_name}`, 65, 52);

        // Payment Info
        if (payment.month && payment.year) {
            doc.text(`For: ${new Date(0, payment.month - 1).toLocaleString('default', { month: 'long' })} ${payment.year}`, 10, 59);
        }
        doc.text(`Method: ${payment.payment_method || 'Cash'}`, 160, 52, { align: 'right' });

        // Amount Box
        doc.rect(10, 65, 190, 20);
        doc.setFontSize(14);
        doc.text("Amount Paid:", 15, 78);
        doc.setFont('helvetica', 'bold');
        doc.text(`BDT ${payment.paid_amount}/-`, 50, 78);

        // Remarks
        if (payment.remarks) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.text(`Remarks: ${payment.remarks}`, 10, 92);
        }

        doc.save(`Receipt_${payment.payment_id}.pdf`);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="text-green-600" /> Finance & Accounts
            </h1>

            {/* STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Revenue (This Month)</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">৳{stats?.revenue_this_month?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Due (This Month)</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">৳{stats?.due_this_month?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Due (Arrears)</p>
                    <p className="text-3xl font-bold text-red-600 mt-2">৳{stats?.due_total?.toLocaleString() || 0}</p>
                </div>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">Recent Transactions</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 shadow-sm"
                >
                    <Plus size={18} /> Record New Payment
                </button>
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
                            <th className="p-4 text-center">Slip</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {recentPayments?.map((p: any) => {
                            const monthName = p.month ? new Date(0, p.month - 1).toLocaleString('default', { month: 'short' }) : '-';
                            return (
                                <tr key={p.payment_id} className="hover:bg-gray-50">
                                    <td className="p-4 font-mono text-gray-500">#{p.payment_id}</td>
                                    <td className="p-4 text-gray-700 text-sm">{p.payment_date}</td>
                                    <td className="p-4 font-medium text-gray-900">
                                        {p.student_name}
                                        <span className="block text-xs text-gray-400">Roll: {p.roll_no || '-'}</span>
                                        <span className="block text-xs text-blue-500">{p.program_name}</span>
                                    </td>
                                    <td className="p-4 text-gray-600 text-sm">{p.month ? `${monthName} ${p.year}` : '-'}</td>
                                    <td className="p-4 text-right font-bold text-green-600">৳{p.paid_amount}</td>
                                    <td className="p-4 text-gray-600 text-sm">
                                        <span className="px-2 py-1 bg-gray-100 rounded text-xs border">{p.payment_method || 'Cash'}</span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => generateSlip(p)}
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

    // Reset Fields logic
    const resetPaymentFields = () => {
        setMode('single');
        setSingleAmount('');
        setRemarks('');
        // Date defaults present
    };

    // Helper: Check if a month is fully paid
    const isMonthPaid = (m: number, y: number) => {
        if (!paymentStatus?.ledger) return false;
        const record = paymentStatus.ledger.find((l: any) => l.month === m && l.year === y);
        // We grey out if Paid. (Partial allows top-up? User prompt says "grey out months paid..."). 
        // Let's stick to: if 'Paid', blocked. If 'Partial', allowed (to complete it).
        // User prompt: "Any month that has a record... must be greyed out". 
        // This implies NO partial top-ups via this UI? Or maybe they mean "Fully Paid"?
        // Given constraint removal to allow partials, Greying out partials would break that.
        // I will grey out ONLY 'Paid' (Fully).
        return record?.status === 'Paid';
    };

    // Calculate Bulk Logic
    const getBulkStart = () => {
        if (!paymentStatus || !selectedProgram) return { month: new Date().getMonth() + 1, year: new Date().getFullYear() };

        let startM = new Date().getMonth() + 1;
        let startY = new Date().getFullYear();

        // New Logic: Find the FIRST "Unpaid" or "Partial" month in the ledger
        // effectively "Next Payble Month".
        // If ledger covers future, we just look for first gap.

        // Sort ledger by date just in case
        const sortedLedger = [...(paymentStatus.ledger || [])].sort((a, b) => (a.year - b.year) || (a.month - b.month));

        for (const l of sortedLedger) {
            if (l.status !== 'Paid') {
                startM = l.month;
                startY = l.year;
                break; // Found the hole
            }
            // If it is paid, we check next.
            // If we reach end of ledger and all are paid, we default to Next Month after Last Ledger Entry.
            if (l === sortedLedger[sortedLedger.length - 1]) {
                if (l.month === 12) { startM = 1; startY = l.year + 1; }
                else { startM = l.month + 1; startY = l.year; }
            }
        }

        return { month: startM, year: startY };
    };

    const bulkStart = getBulkStart();

    // Calculate Bulk Total & Validate
    const calculateBulkTotal = () => {
        if (!selectedProgram) return 0;

        let total = 0;
        let currM = bulkStart.month;
        let currY = bulkStart.year;
        const endTotal = bulkEndYear * 12 + bulkEndMonth;

        // Loop from Start to End
        while ((currY * 12 + currM) <= endTotal) {
            // Check if this specific month is already paid
            if (isMonthPaid(currM, currY)) {
                // If we encounter a paid month in the range, we should probably ALERT or invalidate?
                // For calculation, we might skip it or just count it (but then we double pay).
                // Better to simple count it for now, but UI should prevent this range.
                // However, user asked to "Gray out". In a range picker, you can't gray out middle items easily.
                // We'll just filter valid count.
            } else {
                total += (selectedProgram.fee || 0);
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
                payload.push({
                    student_id: selectedStudent.student_id, // Included for validation
                    program_id: selectedProgram.id,
                    enrollment_id: selectedProgram.enrollment_id,
                    paid_amount: selectedProgram.fee, // Full Fee for bulk
                    payment_date: date,
                    month: currM,
                    year: currY,
                    payment_method: paymentMethod,
                    remarks: `Bulk Payment (${currM}/${currY}) - ${remarks}`,
                });

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
                            <div className="bg-gray-100 p-3 rounded mb-4 flex justify-between text-sm">
                                <div>
                                    <span className="text-gray-500 block">Paid Until:</span>
                                    <span className="font-bold text-gray-800">{paymentStatus?.paid_up_to || 'Loading...'}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-gray-500 block">Current Dues:</span>
                                    <span className="font-bold text-red-600">৳{paymentStatus?.total_due || 0}</span>
                                </div>
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
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Month</label>
                                            <select
                                                className="w-full p-2 border rounded"
                                                value={singleMonth}
                                                onChange={e => setSingleMonth(Number(e.target.value))}
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                                    const isPaid = isMonthPaid(m, singleYear);
                                                    return (
                                                        <option key={m} value={m} disabled={isPaid} className={isPaid ? 'bg-gray-100 text-gray-400 italic' : ''}>
                                                            {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                                                            {isPaid ? ' (Paid)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Year</label>
                                            <input type="number" className="w-full p-2 border rounded" value={singleYear} onChange={e => setSingleYear(Number(e.target.value))} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Amount (৳)</label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full p-2 border rounded font-bold text-green-700"
                                            value={singleAmount}
                                            onChange={e => setSingleAmount(e.target.value)}
                                            placeholder={`Max: ${selectedProgram.fee}`}
                                        />
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
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                        <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'short' })}</option>
                                                    ))}
                                                </select>
                                                <input type="number" className="w-16 p-1 border rounded text-sm" value={bulkEndYear} onChange={e => setBulkEndYear(Number(e.target.value))} />
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
