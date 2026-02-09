import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { X, Check, DollarSign, Users, AlertCircle } from 'lucide-react';

interface BatchPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialProgramId?: string; // Optional pre-select
}

const BatchPaymentModal: React.FC<BatchPaymentModalProps> = ({ isOpen, onClose, initialProgramId }) => {
    const queryClient = useQueryClient();

    // States
    const [selectedProgramId, setSelectedProgramId] = useState<string>(initialProgramId || '');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    const [selectedFullIds, setSelectedFullIds] = useState<number[]>([]);
    const [selectedPartialIds, setSelectedPartialIds] = useState<number[]>([]);

    // New: Clear All Modes
    const [isFullClearAll, setIsFullClearAll] = useState(false);
    const [isPartialClearAll, setIsPartialClearAll] = useState(false);

    // Custom amounts for ANY student (Full or Partial list)
    const [customAmounts, setCustomAmounts] = useState<{ [key: number]: number }>({});

    // Fetch Programs
    const { data: programs } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms
    });

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
    const { data: statusData, isLoading, isError } = useQuery({
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
            queryClient.invalidateQueries({ queryKey: ['finance'] });
            alert(`Successfully processed ${data?.length || 'batch'} payments!`);
            onClose();
            // Reset selection
            setSelectedFullIds([]);
            setSelectedPartialIds([]);
            setPartialAmounts({});
            setIsFullClearAll(false);
            setIsPartialClearAll(false);
            setCustomAmounts({});
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Users className="text-blue-600" /> Record Batch Payment
                        </h2>
                        <p className="text-sm text-gray-500">Settle multiple dues at once</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full">
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

                    // Auto-adjust if selected date is invalid
                    // We can't use useEffect inside this render block easily without re-renders.
                    // Better to control the OPTIONS. 
                    // But if user switches program, we should reset.

                    return (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100">
                            {/* Program Select */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Target Program</label>
                                <select
                                    className="w-full border rounded-md p-2"
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
                                    <p className="text-xs text-gray-400 mt-1">
                                        Starts: {new Date(selectedProgram.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                    </p>
                                )}
                            </div>

                            {/* Date Selects */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                                    <select
                                        className="w-full border rounded-md p-2"
                                        value={month}
                                        onChange={(e) => setMonth(Number(e.target.value))}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                            const isDisabled = (year < startYear) || (year === startYear && m < startMonth);
                                            return (
                                                <option key={m} value={m} disabled={isDisabled} className={isDisabled ? "text-gray-300" : ""}>
                                                    {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                    <select
                                        className="w-full border rounded-md p-2"
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
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {!selectedProgramId ? (
                        <div className="flex-1 flex items-center justify-center text-gray-400 italic p-10">
                            Please select a program to view dues.
                        </div>
                    ) : isLoading ? (
                        <div className="flex-1 flex items-center justify-center p-10">Loading...</div>
                    ) : (
                        <>
                            {/* Full Due List */}
                            <div className="flex-1 border-r border-gray-100 flex flex-col min-h-0">
                                <div className="p-3 bg-red-50 border-b border-red-100 flex justify-between items-center">
                                    <span className="font-semibold text-red-800 flex items-center gap-2">
                                        <AlertCircle size={16} /> Full Dues ({fullDueList.length})
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={isFullClearAll}
                                            onChange={toggleFullClearAll}
                                            className="w-4 h-4 text-red-600 rounded"
                                        />
                                        <span className="text-xs text-red-600 font-medium">Clear All Dues</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-white">
                                    {fullDueList.length === 0 && <p className="text-center text-gray-400 text-sm mt-4">No pending full dues.</p>}
                                    {fullDueList.map((s: any) => {
                                        const isSelected = selectedFullIds.includes(s.student_id);
                                        // Greyed out if Clear All is ON
                                        const isLocked = isFullClearAll;

                                        return (
                                            <div key={s.student_id} className={`p-3 rounded border flex items-center justify-between transition-colors ${isSelected ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50 border-gray-100'} ${isLocked ? 'opacity-75' : ''}`}>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleFullId(s.student_id)}
                                                        className="w-4 h-4 text-red-600 rounded"
                                                        disabled={isLocked}
                                                    />
                                                    <div>
                                                        <p className="font-medium text-gray-900">{s.name}</p>
                                                        <p className="text-xs text-gray-500">ID: {s.student_id} | Due: {s.due_amount}</p>
                                                    </div>
                                                </div>
                                                <div className="w-24">
                                                    <input
                                                        type="number"
                                                        disabled={isLocked} // User requirement: "if checked... greyed out"
                                                        className={`w-full text-right p-1 text-sm border rounded ${isLocked ? 'bg-gray-100 text-gray-500' : 'border-gray-300 focus:ring-red-500'}`}
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
                                <div className="p-3 bg-yellow-50 border-b border-yellow-100 flex justify-between items-center">
                                    <span className="font-semibold text-yellow-800 flex items-center gap-2">
                                        <DollarSign size={16} /> Partial / Remaining ({partialDueList.length})
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={isPartialClearAll}
                                            onChange={togglePartialClearAll}
                                            className="w-4 h-4 text-yellow-600 rounded"
                                        />
                                        <span className="text-xs text-yellow-600 font-medium">Clear All Dues</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-white">
                                    {partialDueList.length === 0 && <p className="text-center text-gray-400 text-sm mt-4">No partial dues.</p>}
                                    {partialDueList.map((s: any) => {
                                        const isSelected = selectedPartialIds.includes(s.student_id);
                                        const isLocked = isPartialClearAll;

                                        return (
                                            <div key={s.student_id} className={`p-3 rounded border flex items-center justify-between transition-colors ${isSelected ? 'bg-yellow-50 border-yellow-200' : 'hover:bg-gray-50 border-gray-100'} ${isLocked ? 'opacity-75' : ''}`}>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => togglePartialId(s.student_id)}
                                                        className="w-4 h-4 text-yellow-600 rounded"
                                                        disabled={isLocked}
                                                    />
                                                    <div>
                                                        <p className="font-medium text-gray-900">{s.name}</p>
                                                        <p className="text-xs text-gray-500">ID: {s.student_id} | Due: {s.due_amount}</p>
                                                    </div>
                                                </div>
                                                <div className="w-24">
                                                    <input
                                                        type="number"
                                                        disabled={isLocked}
                                                        className={`w-full text-right p-1 text-sm border rounded ${isLocked ? 'bg-gray-100 text-gray-500' : 'border-gray-300 focus:ring-yellow-500'}`}
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

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-xl">
                    <div className="text-sm text-gray-600">
                        Selected: <b>{selectedFullIds.length + selectedPartialIds.length}</b> Students
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-900">Cancel</button>
                        <button
                            onClick={handleProcessBatch}
                            disabled={bulkPaymentMutation.isPending || (selectedFullIds.length === 0 && selectedPartialIds.length === 0)}
                            className="bg-green-600 text-white px-6 py-2 rounded shadow-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-bold"
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
