import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Search, CheckCircle } from 'lucide-react';

interface BulkFeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (enrollmentDate: string, customFees: any) => void;
    selectedStudents: any[];
    selectedPrograms: any[];
    isSubmitting: boolean;
    initialDate?: string;
}

const BulkFeeModal: React.FC<BulkFeeModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    selectedStudents,
    selectedPrograms,
    isSubmitting,
    initialDate
}) => {
    // Determine the default date
    const today = new Date().toISOString().split('T')[0];
    const [enrollmentDate, setEnrollmentDate] = useState(initialDate || today);

    // Active Tab (Program ID)
    const [activeProgramId, setActiveProgramId] = useState<number>(selectedPrograms[0]?.program_id || 0);

    // Search term for filtering students within the tab
    const [searchTerm, setSearchTerm] = useState('');

    // customFees: { program_id: { student_id: fee } }
    const [customFees, setCustomFees] = useState<any>({});

    useEffect(() => {
        if (isOpen && selectedPrograms.length > 0) {
            setActiveProgramId(selectedPrograms[0].program_id);
            setEnrollmentDate(initialDate || today);

            // Initialize customFees with default program fees
            const initialFees: any = {};
            selectedPrograms.forEach(p => {
                initialFees[p.program_id] = {};
                selectedStudents.forEach(s => {
                    initialFees[p.program_id][s.student_id] = p.monthly_fee || 0;
                });
            });
            setCustomFees(initialFees);
            setSearchTerm('');
        }
    }, [isOpen, selectedPrograms, selectedStudents]);

    if (!isOpen) return null;

    const handleFeeChange = (programId: number, studentId: number, value: string) => {
        const numericValue = value === '' ? 0 : Number(value);
        setCustomFees((prev: any) => ({
            ...prev,
            [programId]: {
                ...prev[programId],
                [studentId]: numericValue
            }
        }));
    };

    const handleConfirm = () => {
        onSubmit(enrollmentDate, customFees);
    };

    const activeProgram = selectedPrograms.find(p => p.program_id === activeProgramId);

    // Filter students
    const filteredStudents = selectedStudents.filter((s: any) => {
        const searchRegex = new RegExp(searchTerm, 'i');
        return searchRegex.test(s.name) || searchRegex.test(s.student_code || String(s.student_id));
    });

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700/50 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700/50 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Configure Batch Enrollment</h2>
                        <p className="text-sm text-slate-400">Review selected students and set custom agreed fees.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-900/50 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-hidden flex flex-col flex-1">
                    {/* Enrollment Date Picker */}
                    <div className="mb-6 flex items-center gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 flex-shrink-0">
                        <label className="text-sm font-bold text-slate-300 uppercase tracking-wider">Enrollment Date</label>
                        <input
                            type="date"
                            value={enrollmentDate}
                            onChange={(e) => setEnrollmentDate(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition-all font-mono"
                        />
                        <span className="text-xs text-slate-500 ml-auto">Applies to all selected students across all programs.</span>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-700 overflow-x-auto scrollbar-none mb-4 flex-shrink-0">
                        {selectedPrograms.map(p => (
                            <button
                                key={p.program_id}
                                onClick={() => setActiveProgramId(p.program_id)}
                                className={`px-6 py-3 font-bold text-sm whitespace-nowrap transition-colors border-b-2 ${activeProgramId === p.program_id ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'}`}
                            >
                                {p.program_name}
                            </button>
                        ))}
                    </div>

                    {/* Search inside Tab */}
                    <div className="relative mb-4 flex-shrink-0">
                        <Search className="absolute left-3 top-3 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder={`Search among ${selectedStudents.length} selected students...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2 pl-9 pr-4 text-white placeholder:text-slate-600 outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Student List */}
                    <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 space-y-2">
                        {filteredStudents.map(student => {
                            // Check if student is already enrolled in activeProgram
                            const isAlreadyEnrolled = student?.enrollment?.some((e: any) => e.program_id === activeProgramId);
                            const currentFee = customFees[activeProgramId]?.[student.student_id] ?? (activeProgram?.monthly_fee || 0);

                            return (
                                <div key={student.student_id} className={`flex items-center justify-between p-3 rounded-xl border ${isAlreadyEnrolled ? 'bg-slate-900/80 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700/50 hover:border-slate-600'} transition-colors`}>
                                    <div>
                                        <h3 className="font-bold text-slate-200">{student.name}</h3>
                                        <p className="text-xs text-slate-500">{student.student_code || student.student_id} • Class {student.class}</p>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {isAlreadyEnrolled ? (
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                                                Already Enrolled
                                            </span>
                                        ) : (
                                            <div className="flex flex-col items-end">
                                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Agreed Fee</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2 text-slate-400 font-bold">Tk</span>
                                                    <input
                                                        type="number"
                                                        value={currentFee}
                                                        onChange={(e) => handleFeeChange(activeProgramId, student.student_id, e.target.value)}
                                                        className="w-28 bg-slate-900 border border-slate-700 rounded-lg py-1.5 pl-8 pr-2 text-white font-mono text-right outline-none focus:border-blue-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {filteredStudents.length === 0 && (
                            <p className="text-center text-slate-500 py-8">No students mathematically match your search.</p>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-700/50 flex justify-end gap-3 bg-slate-900/30 rounded-b-2xl flex-shrink-0">
                    <button onClick={onClose} className="px-6 py-2.5 font-bold text-slate-400 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</span>
                        ) : (
                            <span className="flex items-center gap-2"><CheckCircle size={18} /> Confirm Enrollment</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
        , document.body);
};

export default BulkFeeModal;
