import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { X, Check, DollarSign, Users, AlertCircle, Search } from 'lucide-react';

interface BatchPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProgramId?: string; // Optional pre-select
    allowedProgramIds?: number[]; // Optional: Restrict to specific programs
}

const BatchPaymentModal: React.FC<BatchPaymentModalProps> = ({ isOpen, onClose, initialProgramId, allowedProgramIds }) => {
    const queryClient = useQueryClient();

    // States
    const [selectedProgramId, setSelectedProgramId] = useState<string>(initialProgramId || '');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    const [selectedFullIds, setSelectedFullIds] = useState<number[]>([]);
    const [selectedPartialIds, setSelectedPartialIds] = useState<number[]>([]);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // New: Clear All Modes
    const [isFullClearAll, setIsFullClearAll] = useState(false);
    const [isPartialClearAll, setIsPartialClearAll] = useState(false);

    // Custom amounts for ANY student (Full or Partial list)
    const [customAmounts, setCustomAmounts] = useState<{ [key: number]: number }>({});

    // Fetch Programs
    const { data: allPrograms } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms
    });

    // Filter Programs if allowedProgramIds is provided
    const programs = useMemo(() => {
        if (!allPrograms) return [];
        // If allowedProgramIds is provided (even if empty), STRICTLY filter by it.
        if (allowedProgramIds) {
            return allPrograms.filter((p: any) => allowedProgramIds.includes(p.program_id));
        }
        return allPrograms;
    }, [allPrograms, allowedProgramIds]);

    // Auto-Set Date Logic
    useEffect(() => {
        if (selectedProgramId && programs) {
            const prog = programs.find((p: any) => p.program_id.toString() === selectedProgramId);
            if (prog?.start_date) {
                const startDate = new Date(prog.start_date);
                const startY = startDate.getFullYear();
                const startM = startDate.getMonth() + 1;

                // If current selection is invalid, reset to start date (or current if valid)
                // Logic: If (year < startY) OR (year == startY && month < startM) -> Reset
                if (year < startY || (year === startY && month < startM)) {
                    setYear(startY);
                    setMonth(startM);
                }
            }
        }
    }, [selectedProgramId, programs, year, month]);

    // Fetch Status
    const { data: statusData, isLoading } = useQuery({
        queryKey: ['batch-status', selectedProgramId, month, year],
        queryFn: () => PaymentRepository.getProgramPaymentStatus(Number(selectedProgramId), month, year),
        enabled: !!selectedProgramId
    });

    // Segregate Data
    const { fullDueList, partialDueList } = useMemo(() => {
        if (!statusData) return { fullDueList: [], partialDueList: [] };

        const full = statusData.filter((s: any) => s.status === 'Unpaid');
        const partial = statusData.filter((s: any) => s.status === 'Partial');

        return { fullDueList: full, partialDueList: partial };
    }, [statusData]);

    // Filtered lists based on searchQuery
    const filteredFullDueList = useMemo(() => {
        if (!searchQuery.trim()) return fullDueList;
        const q = searchQuery.toLowerCase();
        return fullDueList.filter((s: any) =>
            s.name?.toLowerCase().includes(q) ||
            String(s.student_id).includes(q) ||
            String(s.student_code || '').toLowerCase().includes(q)
        );
    }, [fullDueList, searchQuery]);

    const filteredPartialDueList = useMemo(() => {
        if (!searchQuery.trim()) return partialDueList;
        const q = searchQuery.toLowerCase();
        return partialDueList.filter((s: any) =>
            s.name?.toLowerCase().includes(q) ||
            String(s.student_id).includes(q) ||
            String(s.student_code || '').toLowerCase().includes(q)
        );
    }, [partialDueList, searchQuery]);

    // Reset Clear All modes if list chances
    useEffect(() => {
        setIsFullClearAll(false);
        setIsPartialClearAll(false);
        setSelectedFullIds([]);
        setSelectedPartialIds([]);
        setCustomAmounts({});
    }, [statusData]);

    // Clear All Logic Effects
    useEffect(() => {
        if (isFullClearAll) {
            setSelectedFullIds(fullDueList.map((s: any) => s.student_id));
            // Reset custom amounts for these students to ensure Full Due is used
            setCustomAmounts(prev => {
                const next = { ...prev };
                fullDueList.forEach((s: any) => delete next[s.student_id]);
                return next;
            });
        } else {
            // If unchecking clear all, maybe clear selection to allow manual?
            // User said: "if not checked, I need to select the students individually"
            setSelectedFullIds([]);
        }
    }, [isFullClearAll, fullDueList]);

    useEffect(() => {
        if (isPartialClearAll) {
            setSelectedPartialIds(partialDueList.map((s: any) => s.student_id));
            setCustomAmounts(prev => {
                const next = { ...prev };
                partialDueList.forEach((s: any) => delete next[s.student_id]);
                return next;
            });
        } else {
            setSelectedPartialIds([]);
        }
    }, [isPartialClearAll, partialDueList]);

    // Mutation
    const bulkPaymentMutation = useMutation({
        mutationFn: (payments: any[]) => PaymentRepository.createBulkPayment(payments),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats-quick'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats-dues'] });

            // Check response structure
            if (data && (data.success !== undefined || data.failed !== undefined)) {
                const successCount = data.success || 0;
                const failureCount = data.failed ? data.failed.length : 0;

                if (failureCount > 0) {
                    const failMsg = data.failed.map((f: any) => `• ${f.student_name}: ${f.reason}`).join('\n');
                    alert(`⚠️ Batch Payment Completed with Issues:\n\n✅ ${successCount} payments successful.\n❌ ${failureCount} payments failed due to prior dues:\n\n${failMsg}`);

                    if (successCount > 0) {
                        // Partial Success:
                        // Maybe we should remove the successful ones from selection?
                        // For now, let's just close if user is done, BUT keeping it open is safer for review.
                        // Actually, if we close, user loses the context of who failed (unless they memorized the alert).
                        // Let's keep it open but maybe uncheck successful ones?
                        // Unchecking successful ones requires mapping student IDs.
                        if (data.successful_student_ids) {
                            setSelectedFullIds(prev => prev.filter(id => !data.successful_student_ids.includes(id)));
                            setSelectedPartialIds(prev => prev.filter(id => !data.successful_student_ids.includes(id)));
                        }
                    }
                    // Don't close modal so user can see what remains.
                } else {
                    alert(`✅ Successfully processed ${successCount} payments!`);
                    onClose();
                    // Reset selection
                    setSelectedFullIds([]);
                    setSelectedPartialIds([]);
                    setIsFullClearAll(false);
                    setIsPartialClearAll(false);
                    setCustomAmounts({});
                }
            } else {
                // Fallback for unexpected response
                alert(`Successfully processed payments!`);
                onClose();
                setSelectedFullIds([]);
                setSelectedPartialIds([]);
                setCustomAmounts({});
            }
        },
        onError: (err: any) => alert("Batch Payment Failed: " + err.message)
    });

    // Handlers
    const toggleFullClearAll = () => {
        setIsFullClearAll(prev => !prev);
    };

    const toggleFullId = (id: number) => {
        if (isFullClearAll) return; // Locked in Clear All Mode
        if (selectedFullIds.includes(id)) {
            setSelectedFullIds(prev => prev.filter(i => i !== id));
        } else {
            setSelectedFullIds(prev => [...prev, id]);
        }
    };

    const togglePartialClearAll = () => {
        setIsPartialClearAll(prev => !prev);
    };

    const togglePartialId = (id: number) => {
        if (isPartialClearAll) return;
        if (selectedPartialIds.includes(id)) {
            setSelectedPartialIds(prev => prev.filter(i => i !== id));
        } else {
            setSelectedPartialIds(prev => [...prev, id]);
        }
    };

    const handleAmountChange = (id: number, val: string) => {
        setCustomAmounts(prev => ({
            ...prev,
            [id]: Number(val)
        }));
    };

    const handleProcessBatch = () => {
        if (selectedFullIds.length === 0 && selectedPartialIds.length === 0) {
            alert("Please select at least one student.");
            return;
        }

        const payments = [];
        const today = new Date().toISOString().split('T')[0];

        // Helper to create payment object
        const createPay = (student: any, listType: string) => {
            // If Clear All mode is active for this list, STRICTLY use full due.
            // Else use custom amount if exists, else full due.
            const isClearMode = listType === 'Full' ? isFullClearAll : isPartialClearAll;

            let amount = student.due_amount;
            if (!isClearMode) {
                const custom = customAmounts[student.student_id];
                if (custom !== undefined && custom > 0) {
                    amount = custom;
                }
            }

            return {
                enrollment_id: student.enrollment_id,
                student_id: student.student_id,
                program_id: Number(selectedProgramId),
                paid_amount: amount,
                payment_date: today,
                month,
                year,
                payment_method: 'Cash',
                remarks: `Batch Payment - ${listType} ${isClearMode ? '(Clear All)' : '(Custom)'}`
            };
        };

        // 1. Process Full Dues
        for (const id of selectedFullIds) {
            const student = fullDueList.find((s: any) => s.student_id === id);
            if (student) {
                payments.push(createPay(student, 'Full'));
            }
        }

        // 2. Process Partial Dues
        for (const id of selectedPartialIds) {
            const student = partialDueList.find((s: any) => s.student_id === id);
            if (student) {
                payments.push(createPay(student, 'Partial'));
            }
        }

        if (confirm(`Are you sure you want to record ${payments.length} payments?`)) {
            bulkPaymentMutation.mutate(payments);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 lg:pl-64 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-700">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="text-blue-400" /> Record Batch Payment
                        </h2>
                        <p className="text-sm text-slate-400">Settle multiple dues at once</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {(() => {
                    const selectedProgram = programs?.find((p: any) => p.program_id.toString() === selectedProgramId);
                    let startYear = 2024; // Default fallback
                    let startMonth = 1;

                    if (selectedProgram?.start_date) {
                        const d = new Date(selectedProgram.start_date);
                        startYear = d.getFullYear();
                        startMonth = d.getMonth() + 1;
                    }

                    return (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-700 bg-slate-800/20">
                            {/* Program Select */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Target Program</label>
                                <select
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedProgramId}
                                    onChange={(e) => {
                                        setSelectedProgramId(e.target.value);
                                        // Reset date optional? Or let user fix it.
                                    }}
                                    disabled={!!initialProgramId}
                                >
                                    <option value="">Select Program...</option>
                                    {programs?.map((p: any) => (
                                        <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
                                    ))}
                                </select>
                                {selectedProgram?.start_date && (
                                    <p className="text-xs text-slate-400 mt-1">
                                        Starts: {new Date(selectedProgram.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                    </p>
                                )}
                            </div>

                            {/* Date Selects */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Month</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={month}
                                        onChange={(e) => setMonth(Number(e.target.value))}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                            const isDisabled = (year < startYear) || (year === startYear && m < startMonth);
                                            return (
                                                <option key={m} value={m} disabled={isDisabled} className={isDisabled ? "text-slate-600" : ""}>
                                                    {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Year</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                    >
                                        {/* Allow from start year to current + 1 */}
                                        {Array.from({ length: 5 }, (_, i) => startYear + i).map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col bg-slate-900">
                    {/* Search Bar */}
                    {selectedProgramId && !isLoading && (
                        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/30">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search by name or student code..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        {!selectedProgramId ? (
                            <div className="flex-1 flex items-center justify-center text-slate-500 italic p-10">
                                Please select a program to view dues.
                            </div>
                        ) : isLoading ? (
                            <div className="flex-1 flex items-center justify-center p-10 text-slate-400">Loading...</div>
                        ) : (
                            <>
                                {/* Full Due List */}
                                <div className="flex-1 border-r border-slate-700 flex flex-col min-h-0">
                                    <div className="p-3 bg-red-900/20 border-b border-red-900/30 flex justify-between items-center">
                                        <span className="font-semibold text-red-400 flex items-center gap-2">
                                            <AlertCircle size={16} /> Full Dues ({filteredFullDueList.length}{searchQuery ? `/${fullDueList.length}` : ''})
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={isFullClearAll}
                                                onChange={toggleFullClearAll}
                                                className="w-4 h-4 text-red-500 rounded bg-slate-800 border-slate-600 focus:ring-red-500"
                                            />
                                            <span className="text-xs text-red-400 font-medium">Clear All Dues</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-900 custom-scrollbar">
                                        {fullDueList.length === 0 && <p className="text-center text-slate-500 text-sm mt-4">No pending full dues.</p>}
                                        {fullDueList.length > 0 && filteredFullDueList.length === 0 && <p className="text-center text-slate-500 text-sm mt-4">No results match your search.</p>}
                                        {filteredFullDueList.map((s: any) => {
                                            const isSelected = selectedFullIds.includes(s.student_id);
                                            // Greyed out if Clear All is ON
                                            const isLocked = isFullClearAll;

                                            return (
                                                <div key={s.student_id} className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${isSelected ? 'bg-red-900/10 border-red-500/30' : 'hover:bg-slate-800 border-slate-800'} ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleFullId(s.student_id)}
                                                            className="w-4 h-4 text-red-500 rounded bg-slate-800 border-slate-600 focus:ring-red-500"
                                                            disabled={isLocked}
                                                        />
                                                        <div>
                                                            <p className="font-medium text-slate-200">{s.name}</p>
                                                            <p className="text-xs text-slate-500">ID: {s.student_id} | Due: {s.due_amount}</p>
                                                        </div>
                                                    </div>
                                                    <div className="w-24">
                                                        <input
                                                            type="number"
                                                            disabled={isLocked}
                                                            className={`w-full text-right p-1 text-sm border rounded bg-slate-800 border-slate-600 text-white ${isLocked ? 'text-slate-500' : 'focus:ring-1 focus:ring-red-500 outline-none'}`}
                                                            value={customAmounts[s.student_id] ?? (isSelected ? s.due_amount : '')}
                                                            placeholder={String(s.due_amount)}
                                                            onChange={(e) => handleAmountChange(s.student_id, e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Partial Due List */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <div className="p-3 bg-yellow-900/20 border-b border-yellow-900/30 flex justify-between items-center">
                                        <span className="font-semibold text-yellow-500 flex items-center gap-2">
                                            <DollarSign size={16} /> Partial / Remaining ({filteredPartialDueList.length}{searchQuery ? `/${partialDueList.length}` : ''})
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={isPartialClearAll}
                                                onChange={togglePartialClearAll}
                                                className="w-4 h-4 text-yellow-500 rounded bg-slate-800 border-slate-600 focus:ring-yellow-500"
                                            />
                                            <span className="text-xs text-yellow-500 font-medium">Clear All Dues</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-900 custom-scrollbar">
                                        {partialDueList.length === 0 && <p className="text-center text-slate-500 text-sm mt-4">No partial dues.</p>}
                                        {partialDueList.length > 0 && filteredPartialDueList.length === 0 && <p className="text-center text-slate-500 text-sm mt-4">No results match your search.</p>}
                                        {filteredPartialDueList.map((s: any) => {
                                            const isSelected = selectedPartialIds.includes(s.student_id);
                                            const isLocked = isPartialClearAll;

                                            return (
                                                <div key={s.student_id} className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${isSelected ? 'bg-yellow-900/10 border-yellow-500/30' : 'hover:bg-slate-800 border-slate-800'} ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => togglePartialId(s.student_id)}
                                                            className="w-4 h-4 text-yellow-500 rounded bg-slate-800 border-slate-600 focus:ring-yellow-500"
                                                            disabled={isLocked}
                                                        />
                                                        <div>
                                                            <p className="font-medium text-slate-200">{s.name}</p>
                                                            <p className="text-xs text-slate-500">ID: {s.student_id} | Due: {s.due_amount}</p>
                                                        </div>
                                                    </div>
                                                    <div className="w-24">
                                                        <input
                                                            type="number"
                                                            disabled={isLocked}
                                                            className={`w-full text-right p-1 text-sm border rounded bg-slate-800 border-slate-600 text-white ${isLocked ? 'text-slate-500' : 'focus:ring-1 focus:ring-yellow-500 outline-none'}`}
                                                            placeholder={String(s.due_amount)}
                                                            value={customAmounts[s.student_id] ?? (isSelected ? s.due_amount : '')}
                                                            onChange={(e) => handleAmountChange(s.student_id, e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-800/50 border-t border-slate-700 flex justify-between items-center rounded-b-xl">
                    <div className="text-sm text-slate-400">
                        Selected: <b className="text-white">{selectedFullIds.length + selectedPartialIds.length}</b> Students
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                        <button
                            onClick={handleProcessBatch}
                            disabled={bulkPaymentMutation.isPending || (selectedFullIds.length === 0 && selectedPartialIds.length === 0)}
                            className="bg-emerald-600 text-white px-6 py-2 rounded-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 font-bold transition-all"
                        >
                            <Check size={18} /> Process Batch Payment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BatchPaymentModal;
