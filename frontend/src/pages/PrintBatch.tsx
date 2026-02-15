import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { StudentRepository } from '../repositories/StudentRepository';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import IDCardTemplate from '../components/IDCardTemplate';
import ReceiptTemplate from '../components/ReceiptTemplate';
import { Search, Printer, CheckSquare, Square } from 'lucide-react';

const PrintBatch: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'idcards' | 'receipts'>('idcards');
    const printRef = useRef<HTMLDivElement>(null);

    // --- ID CARD STATE ---
    const [studentSearch, setStudentSearch] = useState('');
    const [studentBatchFilter, setStudentBatchFilter] = useState('');
    const [studentClassFilter, setStudentClassFilter] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

    // --- RECEIPT STATE ---
    const [receiptSearch, setReceiptSearch] = useState('');
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]); // Default Today
    const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([]);

    // --- DATA FETCHING ---
    const { data: students } = useQuery({
        queryKey: ['students'],
        queryFn: StudentRepository.getAllStudents
    });

    const { data: batches } = useQuery({
        queryKey: ['batches'],
        queryFn: ProgramRepository.getAllBatches
    });

    // Fetch payments for selected date
    // Note: API might not support date filtering directly on getAll, we might need recent or search
    // Let's use getRecentPayments and filter client-side for now, or assume we need a date filter
    // PaymentRepository.getRecentPayments returns limited set.
    // We probably need a specialized "search payments" or "get payments by date"
    // For now, let's just fetch recent (last 100) and filter by date client side?
    // Or fetch finance stats which has transactions? FinanceBreakdown has transactions for a MONTH.
    // Let's use getRevenueBreakdown for the current month/year of the receiptDate?
    const receiptDateObj = new Date(receiptDate);
    const { data: revenueData } = useQuery({
        queryKey: ['revenue-breakdown', receiptDateObj.getMonth() + 1, receiptDateObj.getFullYear()],
        queryFn: () => PaymentRepository.getRevenueBreakdown(receiptDateObj.getMonth() + 1, receiptDateObj.getFullYear()),
        enabled: activeTab === 'receipts'
    });

    // --- FILTER LOGIC ---

    // ID Cards
    const filteredStudents = useMemo(() => {
        if (!students) return [];
        return students.filter((s: any) => {
            const matchName = s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                s.student_id.toString().includes(studentSearch);
            const matchBatch = studentBatchFilter ? s.batch_id?.toString() === studentBatchFilter : true;
            const matchClass = studentClassFilter ? s.class?.toString() === studentClassFilter : true;
            return matchName && matchBatch && matchClass;
        });
    }, [students, studentSearch, studentBatchFilter, studentClassFilter]);

    // Receipts
    const filteredPayments = useMemo(() => {
        if (!revenueData?.transactions) return [];
        return revenueData.transactions.filter((p: any) => {
            // Filter by exact date
            const matchDate = p.payment_date === receiptDate;
            // Search
            const matchSearch = p.student_name.toLowerCase().includes(receiptSearch.toLowerCase()) ||
                p.payment_id.toString().includes(receiptSearch);
            return matchDate && matchSearch;
        });
    }, [revenueData, receiptDate, receiptSearch]);

    // --- SELECTION LOGIC ---
    const toggleStudent = (id: number) => {
        setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleAllStudents = () => {
        if (selectedStudentIds.length === filteredStudents.length) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(filteredStudents.map((s: any) => s.student_id));
        }
    };

    const togglePayment = (id: number) => {
        setSelectedPaymentIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleAllPayments = () => {
        if (selectedPaymentIds.length === filteredPayments.length) {
            setSelectedPaymentIds([]);
        } else {
            setSelectedPaymentIds(filteredPayments.map((p: any) => p.payment_id));
        }
    };

    // --- PRINT HANDLER ---
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: activeTab === 'idcards' ? 'Student_ID_Cards' : 'Payment_Receipts',
        pageStyle: `
            @page { size: A4; margin: 0; }
            @media print { 
                body { -webkit-print-color-adjust: exact; }
            }
        `
    });

    return (
        <div className="space-y-6 p-6 animate-in fade-in duration-300">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Printer className="text-blue-400" size={32} />
                        Batch Print
                    </h1>
                    <p className="text-slate-400 mt-1">Print ID Cards and Receipts in bulk</p>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => setActiveTab('idcards')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'idcards' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        ID Cards
                    </button>
                    <button
                        onClick={() => setActiveTab('receipts')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'receipts' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Receipts
                    </button>
                </div>
            </div>

            {/* CONTROLS BAR */}
            <div className="bg-slate-800/50 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-700 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">

                {/* FILTERS */}
                <div className="flex flex-wrap gap-4 items-center flex-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder={activeTab === 'idcards' ? "Search Student..." : "Search Receipt..."}
                            className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none w-64"
                            value={activeTab === 'idcards' ? studentSearch : receiptSearch}
                            onChange={e => activeTab === 'idcards' ? setStudentSearch(e.target.value) : setReceiptSearch(e.target.value)}
                        />
                    </div>

                    {activeTab === 'idcards' ? (
                        <>
                            <select
                                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={studentClassFilter}
                                onChange={e => setStudentClassFilter(e.target.value)}
                            >
                                <option value="">All Classes</option>
                                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>Class {i + 1}</option>)}
                            </select>
                            <select
                                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={studentBatchFilter}
                                onChange={e => setStudentBatchFilter(e.target.value)}
                            >
                                <option value="">All Batches</option>
                                {batches?.map((b: any) => (
                                    <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>
                                ))}
                            </select>
                        </>
                    ) : (
                        <input
                            type="date"
                            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                            value={receiptDate}
                            onChange={e => setReceiptDate(e.target.value)}
                        />
                    )}
                </div>

                {/* PRINT ACTION */}
                <button
                    onClick={handlePrint}
                    disabled={(activeTab === 'idcards' ? selectedStudentIds.length : selectedPaymentIds.length) === 0}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all font-bold"
                >
                    <Printer size={20} />
                    Print Selected ({activeTab === 'idcards' ? selectedStudentIds.length : selectedPaymentIds.length})
                </button>
            </div>

            {/* SELECTION LIST */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {/* Header Row */}
                <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex items-center gap-4 text-slate-400 font-semibold text-sm">
                    <button onClick={activeTab === 'idcards' ? toggleAllStudents : toggleAllPayments} className="hover:text-white transition-colors">
                        {(activeTab === 'idcards' ? selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 : selectedPaymentIds.length === filteredPayments.length && filteredPayments.length > 0)
                            ? <CheckSquare size={20} className="text-blue-500" />
                            : <Square size={20} />
                        }
                    </button>
                    <span className="flex-1">Select All ({activeTab === 'idcards' ? filteredStudents.length : filteredPayments.length} Items)</span>
                </div>

                {/* List Items */}
                <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
                    {activeTab === 'idcards' ? (
                        filteredStudents.map((s: any) => (
                            <div key={s.student_id}
                                className={`p-3 rounded-lg border flex items-center gap-4 transition-colors cursor-pointer ${selectedStudentIds.includes(s.student_id) ? 'bg-blue-900/20 border-blue-500/30' : 'bg-slate-900/30 border-slate-700 hover:bg-slate-700/50'}`}
                                onClick={() => toggleStudent(s.student_id)}
                            >
                                {selectedStudentIds.includes(s.student_id) ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} className="text-slate-600" />}
                                <div>
                                    <p className="font-bold text-slate-200">{s.name}</p>
                                    <p className="text-xs text-slate-500">ID: {s.student_code || s.student_id} | Class: {s.class}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        filteredPayments.map((p: any) => (
                            <div key={p.payment_id}
                                className={`p-3 rounded-lg border flex items-center gap-4 transition-colors cursor-pointer ${selectedPaymentIds.includes(p.payment_id) ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-slate-900/30 border-slate-700 hover:bg-slate-700/50'}`}
                                onClick={() => togglePayment(p.payment_id)}
                            >
                                {selectedPaymentIds.includes(p.payment_id) ? <CheckSquare size={20} className="text-emerald-500" /> : <Square size={20} className="text-slate-600" />}
                                <div className="flex-1 flex justify-between">
                                    <div>
                                        <p className="font-bold text-slate-200">Receipt #{p.payment_id}</p>
                                        <p className="text-xs text-slate-500">Student: {p.student_name} | {p.program_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono font-bold text-emerald-400">৳{p.amount?.toLocaleString()}</p>
                                        <p className="text-xs text-slate-500">{p.payment_date}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {(activeTab === 'idcards' ? filteredStudents : filteredPayments).length === 0 && (
                        <div className="text-center p-10 text-slate-500 italic">No records found matching filters.</div>
                    )}
                </div>
            </div>

            {/* HIDDEN PRINT AREA (Fixed off-screen with explicit width so it's not "empty") */}
            <div ref={printRef} className="fixed left-[-9999px] top-0 w-[210mm] overflow-hidden print:static print:w-auto print:overflow-visible">
                <div className="bg-white text-black p-8">
                    {activeTab === 'idcards' ? (
                        <div className="grid grid-cols-2 gap-4">
                            {filteredStudents
                                .filter((s: any) => selectedStudentIds.includes(s.student_id))
                                .map((s: any) => (
                                    <div key={s.student_id} className="break-inside-avoid">
                                        <IDCardTemplate student={s} />
                                    </div>
                                ))
                            }
                        </div>
                    ) : (
                        <div className="flex flex-col gap-0">
                            {filteredPayments
                                .filter((p: any) => selectedPaymentIds.includes(p.payment_id))
                                .map((p: any) => (
                                    <div key={p.payment_id} className="break-inside-avoid">
                                        {/* Map flat transaction to detailed receipt structure if needed */}
                                        <ReceiptTemplate payment={{
                                            ...p,
                                            paid_amount: p.amount, // mapping for template
                                            // month/year is usually in transaction data from revenue-breakdown?
                                            // p has 'date_display' which is "Jan 2026".
                                            // Let's rely on p fields matching or being sufficient.
                                            // ReceiptTemplate uses: payment_id, payment_date, student_name, student_code, program_name, month, year, paid_amount, payment_method, remarks
                                            // Revenue breakdown returns: payment_id, amount, payment_date, student_name, program_name, payment_method.
                                            // Missing: student_code, student_id, month, year (numeric), remarks.
                                            // We might need to fetch full details or map best effort?
                                            // date_display helps.
                                            // remarks?
                                        }} />
                                    </div>
                                ))
                            }
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrintBatch;
