import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentRepository } from '../repositories/StudentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import StudentFinancialStatus from '../components/StudentFinancialStatus';
import StudentPerformance from './StudentPerformance';
import WithdrawalModal from '../components/WithdrawalModal';
import { User, BookOpen, CreditCard, Edit2, Save, Trash2, Plus, TrendingUp, ArrowLeft } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import IDCardTemplate from '../components/IDCardTemplate';

const StudentProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [selectedProgramId, setSelectedProgramId] = useState('');
    const [withdrawEnrollment, setWithdrawEnrollment] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'performance'>('overview');

    // Print Handler (Must be before early returns)
    const printRef = React.useRef<HTMLDivElement>(null);
    // documentTitle depends on student, which might be undefined initially. 
    // We can rely on student being available when print is called, or use default.
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `ID_Card`,
        pageStyle: `
            @page { size: A4; margin: 0; }
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                }
            }
        `
    });

    // 1. Fetch Student Details
    const { data: student, isLoading } = useQuery({
        queryKey: ['student', id],
        queryFn: () => StudentRepository.getStudentById(id!),
        enabled: !!id
    });

    // 2. Fetch Enrollments
    const { data: enrollments } = useQuery({
        queryKey: ['enrollments', id],
        queryFn: () => StudentRepository.getEnrollments(id!),
        enabled: !!id
    });

    // 3. Fetch All Programs (for enrollment dropdown)
    const { data: allPrograms } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms
    });

    // 4. Fetch Batches (for profile edit)
    const { data: batches } = useQuery({
        queryKey: ['batches'],
        queryFn: ProgramRepository.getAllBatches
    });

    // Mutations
    const updateMutation = useMutation({
        mutationFn: (updates: any) => StudentRepository.updateStudent(id!, updates),
        onSuccess: () => {
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ['student', id] });
        }
    });

    const enrollMutation = useMutation({
        mutationFn: (programId: number) => StudentRepository.enrollStudent({
            student_id: parseInt(id!),
            program_id: programId
        }),
        onSuccess: (data: any) => {
            setShowEnrollModal(false);
            queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
            if (data.is_reenrollment) {
                alert("Student re-enrolled successfully. Enrollment date has been updated to today.");
            } else {
                alert("Student enrolled successfully.");
            }
        },
        onError: (err: any) => {
            alert(err.message);
        }
    });

    if (isLoading) return <div className="p-8 text-center text-slate-400 animate-pulse">Loading profile...</div>;
    if (!student) return <div className="p-8 text-center text-red-400">Student not found</div>;

    const handleEditToggle = () => {
        setEditForm(student);
        setIsEditing(true);
    };

    const handleSave = () => {
        updateMutation.mutate(editForm);
    };

    // Print Handler


    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            {/* BREADCRUMB */}
            <div className="flex items-center gap-4 text-slate-500 mb-4">
                <Link to="/students" className="hover:text-white flex items-center gap-1 transition-colors">
                    <ArrowLeft size={16} /> Back to Students
                </Link>
            </div>

            {/* HEADER CARD */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700 p-8 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div className="flex gap-6 items-center">
                        <div className="w-24 h-24 bg-slate-700/50 rounded-full flex items-center justify-center text-slate-400 border border-slate-600 shadow-inner">
                            <User size={48} />
                        </div>
                        <div>
                            {isEditing ? (
                                <div className="space-y-3">
                                    <input
                                        className="block w-full border border-slate-600 p-2 rounded-lg font-bold text-xl text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        placeholder="Full Name"
                                    />
                                    <div className="flex gap-3">
                                        <input
                                            className="border border-slate-600 p-2 rounded-lg text-sm text-white bg-slate-900/50 w-24 focus:ring-2 focus:ring-blue-500/50 focus:outline-none" placeholder="Class"
                                            value={editForm.class || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setEditForm({ ...editForm, class: val === '' ? '' : parseInt(val) });
                                            }}
                                        />
                                        <select
                                            className="border border-slate-600 p-2 rounded-lg text-sm text-white bg-slate-900/50 min-w-[140px] focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                                            value={editForm.batch_id || ''}
                                            onChange={e => setEditForm({ ...editForm, batch_id: e.target.value ? parseInt(e.target.value) : null })}
                                        >
                                            <option value="" className="bg-slate-900">No Batch</option>
                                            {batches?.map((b: any) => (
                                                <option key={b.batch_id} value={b.batch_id} className="bg-slate-900">{b.batch_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-3xl font-bold text-white mb-2">{student.name}</h1>
                                    <div className="flex gap-3 text-slate-400 items-center">
                                        <span className="bg-slate-700/50 px-3 py-1 rounded-full text-sm border border-slate-600">Class {student.class}</span>
                                        {student.batch && (
                                            <span className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-sm font-bold uppercase border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                                                {student.batch.batch_name}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 mt-2 font-mono">Student ID: #{student.student_code || student.student_id}</p>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3 items-center w-full md:w-auto">
                        <button
                            onClick={() => handlePrint()}
                            className="bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-600 font-medium text-sm flex items-center gap-2 border border-slate-600 shadow-lg transition-all flex-1 md:flex-none justify-center"
                        >
                            <CreditCard size={18} /> <span className="hidden sm:inline">Download ID</span>
                        </button>
                        {isEditing ? (
                            <button onClick={handleSave} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all flex-1 md:flex-none justify-center font-bold">
                                <Save size={18} /> Save
                            </button>
                        ) : (
                            <button onClick={handleEditToggle} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex-1 md:flex-none justify-center font-bold">
                                <Edit2 size={18} /> Edit
                            </button>
                        )}
                    </div>
                </div>

                {/* DETAILS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8 pt-8 border-t border-slate-700/50">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Father's Name</label>
                        {isEditing ? (
                            <input
                                className="block w-full border border-slate-600 p-2 rounded-lg text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                                value={editForm.fathers_name || ''}
                                onChange={e => setEditForm({ ...editForm, fathers_name: e.target.value })}
                            />
                        ) : (
                            <p className="text-slate-200 font-medium text-lg">{student.fathers_name || '-'}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">School/College</label>
                        {isEditing ? (
                            <input
                                className="block w-full border border-slate-600 p-2 rounded-lg text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                                value={editForm.school || ''}
                                onChange={e => setEditForm({ ...editForm, school: e.target.value })}
                            />
                        ) : (
                            <p className="text-slate-200 font-medium text-lg">{student.school || '-'}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Contact</label>
                        {isEditing ? (
                            <input
                                className="block w-full border border-slate-600 p-2 rounded-lg text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                                value={editForm.contact || ''}
                                onChange={e => setEditForm({ ...editForm, contact: e.target.value })}
                            />
                        ) : (
                            <p className="text-slate-200 font-medium text-lg font-mono">{student.contact || '-'}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700 overflow-hidden mb-8">
                <div className="flex border-b border-slate-700/50">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-4 text-sm font-bold text-center transition-all whitespace-nowrap ${activeTab === 'overview'
                            ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            } `}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <BookOpen size={16} /> Overview
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('performance')}
                        className={`flex-1 py-4 text-sm font-bold text-center transition-all whitespace-nowrap ${activeTab === 'performance'
                            ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5'
                            : 'text-emerald-500/70 hover:text-emerald-300 hover:bg-emerald-500/10'
                            } `}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <TrendingUp size={16} /> Performance
                        </div>
                    </button>
                </div>

                <div className="p-6">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                            {/* FINANCIAL STATUS */}
                            <StudentFinancialStatus studentId={id!} />

                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <BookOpen size={24} className="text-blue-400" />
                                        Enrolled Programs
                                    </h3>
                                    <button
                                        onClick={() => setShowEnrollModal(true)}
                                        className="text-sm bg-blue-500/10 text-blue-400 px-4 py-2 rounded-lg font-bold hover:bg-blue-500/20 border border-blue-500/20 transition-all flex items-center gap-1"
                                    >
                                        <Plus size={16} /> Enroll
                                    </button>
                                </div>

                                {showEnrollModal && (
                                    <div className="bg-slate-900/50 p-6 rounded-xl mb-6 border border-slate-700 animate-fade-in">
                                        <p className="text-sm font-bold text-blue-400 mb-3">Select Program to Enroll</p>
                                        <div className="flex flex-col md:flex-row gap-3">
                                            <select
                                                className="flex-1 border border-slate-600 p-2.5 rounded-lg text-white bg-slate-800 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                                                value={selectedProgramId}
                                                onChange={e => setSelectedProgramId(e.target.value)}
                                            >
                                                <option value="" className="bg-slate-800">Choose a Program...</option>
                                                {allPrograms?.map((p: any) => (
                                                    <option key={p.program_id} value={p.program_id} className="bg-slate-800">
                                                        {p.program_name} (Batch: {p.batch?.batch_name})
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => enrollMutation.mutate(parseInt(selectedProgramId))}
                                                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg shadow-lg hover:bg-blue-500 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                                    disabled={!selectedProgramId}
                                                >
                                                    Confirm
                                                </button>
                                                <button onClick={() => setShowEnrollModal(false)} className="text-slate-400 px-4 hover:text-white transition-colors">Cancel</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {enrollments?.map((enroll: any) => (
                                        <div key={enroll.enrollment_id} className="bg-slate-900/30 border border-slate-700/50 p-5 rounded-xl flex justify-between items-center hover:bg-slate-800/50 transition-colors group">
                                            <div>
                                                <p className="font-bold text-lg text-slate-200">{enroll.program?.program_name || 'Unknown Program'}</p>
                                                <div className="flex gap-4 mt-2 text-sm text-slate-400 items-center">
                                                    <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-blue-400 font-bold border border-slate-700">Roll: {enroll.roll_no || 'N/A'}</span>
                                                    <span>Joined: {enroll.enrollment_date || 'N/A'}</span>
                                                    {enroll.status === 'Withdrawn' && <span className="text-red-400 bg-red-500/10 px-2 rounded border border-red-500/20">Withdrawn</span>}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setWithdrawEnrollment(enroll)}
                                                className="text-red-400 hover:text-red-300 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 rounded-lg hover:bg-red-500/20"
                                                title="Withdraw / Delete Enrollment"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    ))}
                                    {(!student.enrollment || student.enrollment.length === 0) && (
                                        <div className="text-center py-8 border-2 border-dashed border-slate-700 rounded-xl">
                                            <p className="text-slate-500 italic">No active enrollments.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PERFORMANCE TAB */}
                    {activeTab === 'performance' && (
                        <StudentPerformance studentId={id!} />
                    )}
                </div>
            </div>

            {/* WITHDRAWAL MODAL */}
            {withdrawEnrollment && (
                <WithdrawalModal
                    isOpen={!!withdrawEnrollment}
                    onClose={() => setWithdrawEnrollment(null)}
                    enrollment={withdrawEnrollment}
                    studentId={id!}
                    onSuccess={() => {
                        setWithdrawEnrollment(null);
                        queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
                        queryClient.invalidateQueries({ queryKey: ['student-financial-summary', id] });
                    }}
                />
            )}

            {/* Hidden Print Area */}
            <div className="hidden">
                <div ref={printRef} className="print:w-auto print:overflow-visible bg-white text-black p-8">
                    <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="break-inside-avoid">
                            <IDCardTemplate student={student} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentProfile;
