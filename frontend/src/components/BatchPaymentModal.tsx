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
    const [partialAmounts, setPartialAmounts] = useState<{ [key: number]: number }>({}); // student_id -> amount

    // Fetch Programs
    const { data: programs } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms
    });

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
        },
        onError: (err: any) => alert("Batch Payment Failed: " + err.message)
    });

    // Handlers
    const toggleFullSelectAll = () => {
        if (selectedFullIds.length === fullDueList.length) {
            setSelectedFullIds([]);
        } else {
            setSelectedFullIds(fullDueList.map((s: any) => s.student_id));
        }
    };

    const toggleFullId = (id: number) => {
        if (selectedFullIds.includes(id)) {
            setSelectedFullIds(prev => prev.filter(i => i !== id));
        } else {
            setSelectedFullIds(prev => [...prev, id]);
        }
    };

    const togglePartialSelectAll = () => {
        if (selectedPartialIds.length === partialDueList.length) {
            setSelectedPartialIds([]);
        } else {
            setSelectedPartialIds(partialDueList.map((s: any) => s.student_id));
        }
    };

    const togglePartialId = (id: number) => {
        if (selectedPartialIds.includes(id)) {
            setSelectedPartialIds(prev => prev.filter(i => i !== id));
        } else {
            setSelectedPartialIds(prev => [...prev, id]);
        }
    };

    const handlePartialAmountChange = (id: number, val: string) => {
        setPartialAmounts(prev => ({
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

        // 1. Process Full Dues (Pay remaining due)
        for (const id of selectedFullIds) {
            const student = fullDueList.find((s: any) => s.student_id === id);
            if (student) {
                payments.push({
                    enrollment_id: student.enrollment_id,
                    student_id: student.student_id, // backend might need this for validation or logging
                    program_id: Number(selectedProgramId),
                    paid_amount: student.due_amount, // Paying full remaining
                    payment_date: today,
                    month,
                    year,
                    payment_method: 'Cash', // Default for batch
                    remarks: 'Batch Payment - Full Due'
                });
            }
        }

        // 2. Process Partial Dues (Pay custom amount or full remaining)
        for (const id of selectedPartialIds) {
            const student = partialDueList.find((s: any) => s.student_id === id);
            const customAmount = partialAmounts[id];

            // If custom amount is entered, use it. Otherwise use full due?
            // Requirement says: "Record Partial Batch' opens input... to manually enter"
            // Let's assume if selected, we MUST have an amount. If no amount entered, maybe default to 0 or Full?
            // Let's default to Full Due if 0/Empty, or strictly require input.
            // Better UX: Default input to 'Due Amount' when selected? Or just use Due if 0.

            const amount = customAmount && customAmount > 0 ? customAmount : student.due_amount;

            if (student) {
                payments.push({
                    enrollment_id: student.enrollment_id,
                    student_id: student.student_id,
                    program_id: Number(selectedProgramId),
                    paid_amount: amount,
                    payment_date: today,
                    month,
                    year,
                    payment_method: 'Cash',
                    remarks: 'Batch Payment - Partial/Custom'
                });
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

                {/* Filters */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target Program</label>
                        <select
                            className="w-full border rounded-md p-2"
                            value={selectedProgramId}
                            onChange={(e) => setSelectedProgramId(e.target.value)}
                            disabled={!!initialProgramId}
                        >
                            <option value="">Select Program...</option>
                            {programs?.map((p: any) => (
                                <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                            <select className="w-full border rounded-md p-2" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                            <input type="number" className="w-full border rounded-md p-2" value={year} onChange={(e) => setYear(Number(e.target.value))} />
                        </div>
                    </div>
                </div>

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
                                            checked={fullDueList.length > 0 && selectedFullIds.length === fullDueList.length}
                                            onChange={toggleFullSelectAll}
                                            className="w-4 h-4 text-red-600 rounded"
                                        />
                                        <span className="text-xs text-red-600 font-medium">Select All</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-white">
                                    {fullDueList.length === 0 && <p className="text-center text-gray-400 text-sm mt-4">No pending full dues.</p>}
                                    {fullDueList.map((s: any) => (
                                        <div key={s.student_id} className={`p-3 rounded border flex items-center justify-between transition-colors ${selectedFullIds.includes(s.student_id) ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50 border-gray-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFullIds.includes(s.student_id)}
                                                    onChange={() => toggleFullId(s.student_id)}
                                                    className="w-4 h-4 text-red-600 rounded"
                                                />
                                                <div>
                                                    <p className="font-medium text-gray-900">{s.name}</p>
                                                    <p className="text-xs text-gray-500">ID: {s.student_id} | Due: <span className="font-mono text-red-600 font-bold">{s.due_amount}</span></p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
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
                                            checked={partialDueList.length > 0 && selectedPartialIds.length === partialDueList.length}
                                            onChange={togglePartialSelectAll}
                                            className="w-4 h-4 text-yellow-600 rounded"
                                        />
                                        <span className="text-xs text-yellow-600 font-medium">Select All</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-white">
                                    {partialDueList.length === 0 && <p className="text-center text-gray-400 text-sm mt-4">No partial dues.</p>}
                                    {partialDueList.map((s: any) => {
                                        const isSelected = selectedPartialIds.includes(s.student_id);
                                        return (
                                            <div key={s.student_id} className={`p-3 rounded border flex items-center justify-between transition-colors ${isSelected ? 'bg-yellow-50 border-yellow-200' : 'hover:bg-gray-50 border-gray-100'}`}>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => togglePartialId(s.student_id)}
                                                        className="w-4 h-4 text-yellow-600 rounded"
                                                    />
                                                    <div>
                                                        <p className="font-medium text-gray-900">{s.name}</p>
                                                        <p className="text-xs text-gray-500">ID: {s.student_id} | Due: <span className="font-mono text-red-600 font-bold">{s.due_amount}</span></p>
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <div className="w-24">
                                                        <input
                                                            type="number"
                                                            className="w-full text-right p-1 text-sm border-gray-300 rounded border focus:ring-yellow-500 focus:border-yellow-500"
                                                            placeholder={String(s.due_amount)}
                                                            value={partialAmounts[s.student_id] || ''}
                                                            onChange={(e) => handlePartialAmountChange(s.student_id, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                )}
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
