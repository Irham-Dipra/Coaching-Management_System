import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentRepository } from '../repositories/StudentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import StudentFinancialStatus from '../components/StudentFinancialStatus';
import StudentPerformance from './StudentPerformance';
import WithdrawalModal from '../components/WithdrawalModal';
import AdjustFeeModal from '../components/AdjustFeeModal';
import { User, BookOpen, CreditCard, Edit2, Save, Trash2, Plus, TrendingUp, DollarSign, UserCircle, GraduationCap, Phone, X } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import IDCardTemplate from '../components/IDCardTemplate';
import BulkFeeModal from '../components/BulkFeeModal';

const StudentProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [selectedProgramId, setSelectedProgramId] = useState('');
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [withdrawEnrollment, setWithdrawEnrollment] = useState<any>(null);
    const [adjustFeeEnrollment, setAdjustFeeEnrollment] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'performance'>('overview');

    // Print Handler (Must be before early returns)
    const printRef = React.useRef<HTMLDivElement>(null);
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
        mutationFn: async ({ enrollmentDate, customFees }: { enrollmentDate: string, customFees: any }) => {
            return StudentRepository.enrollStudentsBulk({
                student_ids: [parseInt(id!)],
                program_ids: [parseInt(selectedProgramId)],
                enrollment_date: enrollmentDate,
                custom_fees: customFees
            });
        },
        onSuccess: () => {
            setShowEnrollModal(false);
            setIsBulkModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
            alert("Student enrolled successfully.");
            setSelectedProgramId('');
        },
        onError: (err: any) => {
            alert(err.message);
        }
    });

    const navigate = useNavigate();

    const deleteMutation = useMutation({
        mutationFn: () => StudentRepository.deleteStudent(parseInt(id!)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats-quick'] });
            queryClient.invalidateQueries({ queryKey: ['finance-stats-dues'] });
            alert("Student deleted successfully.");
            navigate('/students');
        },
        onError: (err: any) => {
            alert("Failed to delete student: " + err.message);
        }
    });

    if (isLoading) return <div className="p-8 flex items-center justify-center text-slate-400 animate-pulse min-h-[50vh]">Loading profile...</div>;
    if (!student) return <div className="p-8 text-center text-red-400 font-bold min-h-[50vh] flex items-center justify-center">Student not found</div>;

    const handleEditToggle = () => {
        setEditForm(student);
        setIsEditing(true);
    };

    const handleSave = () => {
        updateMutation.mutate(editForm);
    };

    return (
        <div className="max-w-7xl mx-auto animate-fade-in p-2 md:p-6 lg:p-8 font-sans">
            <div className="flex flex-col lg:flex-row gap-8 items-start">

                {/* LEFT SIDEBAR: PROFILE CARD */}
                <div className="w-full lg:w-1/3 space-y-6">
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl shadow-xl border border-slate-700/50 p-6 sm:p-8 relative overflow-hidden group">
                        {/* Decorative Gradient Background Layer */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-bl-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-110"></div>

                        <div className="relative z-10">
                            {/* Avatar & Header */}
                            <div className="flex flex-col items-center mb-6 text-center">
                                <div className="w-28 h-28 bg-slate-700/50 rounded-full flex items-center justify-center text-slate-400 border-2 border-slate-600 shadow-inner mb-4 relative overflow-hidden group-hover:border-blue-500/50 transition-colors">
                                    <User size={56} className="opacity-80 group-hover:opacity-100 transition-opacity" />
                                </div>

                                {isEditing ? (
                                    <div className="w-full space-y-4">
                                        <input
                                            className="block w-full border border-slate-600 p-3 rounded-xl font-bold text-center text-xl text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all"
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            placeholder="Full Name"
                                        />
                                        <div className="flex flex-col gap-3">
                                            <input
                                                className="w-full border border-slate-600 p-3 rounded-xl text-sm text-center text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all"
                                                placeholder="Class (e.g., 9)"
                                                value={editForm.class || ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setEditForm({ ...editForm, class: val === '' ? '' : parseInt(val) });
                                                }}
                                            />
                                            <select
                                                className="w-full border border-slate-600 p-3 rounded-xl text-sm text-center text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none transition-all cursor-pointer"
                                                value={editForm.batch_id || ''}
                                                onChange={e => setEditForm({ ...editForm, batch_id: e.target.value ? parseInt(e.target.value) : null })}
                                            >
                                                <option value="" className="bg-slate-900">No Batch Assigned</option>
                                                {batches?.map((b: any) => (
                                                    <option key={b.batch_id} value={b.batch_id} className="bg-slate-900">{b.batch_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight group-hover:text-blue-200 transition-colors">{student.name}</h1>
                                        <div className="flex flex-wrap justify-center gap-2 mb-3">
                                            <span className="bg-slate-700/50 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border border-slate-600 text-slate-300">
                                                Class {student.class}
                                            </span>
                                            {student.batch && (
                                                <span className="bg-purple-500/10 text-purple-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                                                    {student.batch.batch_name}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-400 font-medium font-mono bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-800 inline-block">
                                            ID: #{student.student_code || student.student_id}
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-slate-700/50 w-full my-6"></div>

                            {/* Personal Details */}
                            <div className="space-y-5 mb-8">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-2 bg-slate-700/30 rounded-lg text-slate-400"><UserCircle size={18} /></div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Father's Name</p>
                                        {isEditing ? (
                                            <input
                                                className="w-full border border-slate-600 p-2.5 rounded-lg text-sm text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                                value={editForm.fathers_name || ''}
                                                onChange={e => setEditForm({ ...editForm, fathers_name: e.target.value })}
                                                placeholder="Enter name"
                                            />
                                        ) : (
                                            <p className="text-slate-200 font-medium">{student.fathers_name || '-'}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-2 bg-slate-700/30 rounded-lg text-slate-400"><GraduationCap size={18} /></div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">School / College</p>
                                        {isEditing ? (
                                            <input
                                                className="w-full border border-slate-600 p-2.5 rounded-lg text-sm text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                                value={editForm.school || ''}
                                                onChange={e => setEditForm({ ...editForm, school: e.target.value })}
                                                placeholder="Enter institution"
                                            />
                                        ) : (
                                            <p className="text-slate-200 font-medium">{student.school || '-'}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-2 bg-slate-700/30 rounded-lg text-slate-400"><Phone size={18} /></div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact</p>
                                        {isEditing ? (
                                            <input
                                                className="w-full border border-slate-600 p-2.5 rounded-lg text-sm text-white bg-slate-900/50 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono"
                                                value={editForm.contact || ''}
                                                onChange={e => setEditForm({ ...editForm, contact: e.target.value })}
                                                placeholder="Enter phone number"
                                            />
                                        ) : (
                                            <p className="text-slate-200 font-medium font-mono">{student.contact || '-'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                {isEditing ? (
                                    <>
                                        <button onClick={handleSave} className="col-span-2 bg-emerald-600 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all font-bold">
                                            <Save size={18} /> Save Changes
                                        </button>
                                        <button onClick={() => setIsEditing(false)} className="col-span-2 bg-slate-700 text-slate-300 px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-600 hover:text-white transition-all font-bold">
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={handleEditToggle} className="col-span-2 bg-blue-600/90 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all font-bold group">
                                            <Edit2 size={16} className="group-hover:scale-110 transition-transform" /> Edit Profile
                                        </button>
                                        <button
                                            onClick={() => handlePrint()}
                                            className="bg-slate-700 text-slate-300 px-4 py-3 rounded-xl hover:bg-slate-600 hover:text-white font-medium text-sm flex items-center justify-center gap-2 transition-all hover:shadow-lg"
                                        >
                                            <CreditCard size={16} /> ID
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm("Are you sure you want to delete this student? This action cannot be undone. It will withdraw all enrollments and delete exam results. Payments will be preserved.")) {
                                                    deleteMutation.mutate();
                                                }
                                            }}
                                            className="bg-red-500/10 text-red-500 px-4 py-3 rounded-xl hover:bg-red-500 hover:text-white transition-all font-medium flex items-center justify-center gap-2 border border-red-500/20"
                                            title="Delete Student"
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT CONTENT AREA */}
                <div className="w-full lg:w-2/3 space-y-6">
                    {/* TABS HEADER */}
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-2 flex gap-2">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 py-3 px-6 rounded-xl text-sm font-bold text-center transition-all flex items-center justify-center gap-2 ${activeTab === 'overview'
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-inner'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                }`}
                        >
                            <BookOpen size={18} /> Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('performance')}
                            className={`flex-1 py-3 px-6 rounded-xl text-sm font-bold text-center transition-all flex items-center justify-center gap-2 ${activeTab === 'performance'
                                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-inner'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                }`}
                        >
                            <TrendingUp size={18} /> Performance
                        </button>
                    </div>

                    {/* TAB CONTENT */}
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl shadow-xl border border-slate-700/50 overflow-hidden min-h-[500px]">
                        <div className="p-6 md:p-8">

                            {/* OVERVIEW TAB */}
                            {activeTab === 'overview' && (
                                <div className="space-y-10 animate-fade-in">
                                    {/* FINANCIAL STATUS COMPONENT */}
                                    <StudentFinancialStatus studentId={id!} />

                                    {/* ENROLLED PROGRAMS */}
                                    <div>
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                            <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                                                <BookOpen size={22} className="text-blue-400" />
                                                Enrolled Programs
                                            </h3>
                                            <button
                                                onClick={() => setShowEnrollModal(true)}
                                                className="text-sm bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
                                            >
                                                <Plus size={18} /> Enroll to Program
                                            </button>
                                        </div>

                                        {showEnrollModal && (
                                            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl mb-6 shadow-inner animate-slide-up">
                                                <div className="flex items-center justify-between mb-4">
                                                    <p className="text-sm font-bold text-blue-400 uppercase tracking-wider">Select Program to Enroll</p>
                                                    <button
                                                        onClick={() => { setShowEnrollModal(false); setSelectedProgramId(''); }}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-all"
                                                        title="Cancel"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                                                    <select
                                                        className="flex-1 border border-slate-600 p-3 rounded-xl text-white bg-slate-800 focus:ring-2 focus:ring-blue-500/50 focus:outline-none cursor-pointer"
                                                        value={selectedProgramId}
                                                        onChange={e => setSelectedProgramId(e.target.value)}
                                                    >
                                                        <option value="" className="bg-slate-800">Choose a Program...</option>
                                                        {allPrograms?.map((p: any) => (
                                                            <option key={p.program_id} value={p.program_id} className="bg-slate-800 font-medium">
                                                                {p.program_name} (Batch: {p.batch?.batch_name})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => setIsBulkModalOpen(true)}
                                                        className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-blue-500 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                        disabled={!selectedProgramId}
                                                    >
                                                        Configure Fee
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-4">
                                            {enrollments?.map((enroll: any) => (
                                                <div key={enroll.enrollment_id} className="bg-slate-800/50 border border-slate-700/80 p-5 md:p-6 rounded-2xl md:flex md:justify-between items-center hover:bg-slate-800 hover:border-slate-600 transition-all group relative overflow-hidden">

                                                    {enroll.status === 'Withdrawn' && (
                                                        <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-bl-full overflow-hidden"></div>
                                                    )}

                                                    <div className="mb-4 md:mb-0 relative z-10 w-full md:pr-4">
                                                        <h4 className="font-extrabold text-xl text-slate-100 group-hover:text-blue-300 transition-colors cursor-pointer" onClick={() => navigate(`/admin/programs/${enroll.program?.program_id}`)}>
                                                            {enroll.program?.program_name || 'Unknown Program'}
                                                        </h4>

                                                        <div className="flex flex-wrap gap-x-6 gap-y-3 mt-3 items-center">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs text-slate-500 font-bold uppercase">Roll</span>
                                                                <span className="font-mono bg-slate-900/80 px-2 py-0.5 rounded text-blue-400 font-bold border border-slate-700/50">
                                                                    {enroll.roll_no || 'N/A'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs text-slate-500 font-bold uppercase">Joined</span>
                                                                <span className="text-sm font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                                                                    {enroll.enrollment_date || 'N/A'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs text-slate-500 font-bold uppercase">Fee</span>
                                                                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold tracking-wide font-mono">
                                                                    ৳{enroll.current_agreed_fee !== null && enroll.current_agreed_fee !== undefined ? enroll.current_agreed_fee : (enroll.program?.monthly_fee || 0)}
                                                                </span>
                                                            </div>
                                                            {enroll.status === 'Withdrawn' && (
                                                                <span className="text-red-400 bg-red-500/10 px-3 py-0.5 rounded-full border border-red-500/20 font-bold text-xs uppercase tracking-wider">
                                                                    Withdrawn
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-4 md:mt-0 pt-4 md:pt-0 border-t border-slate-700 md:border-none w-full md:w-auto md:justify-end">
                                                        <button
                                                            onClick={() => setAdjustFeeEnrollment(enroll)}
                                                            className="flex-1 md:flex-none flex justify-center items-center gap-2 text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white px-4 py-2.5 rounded-xl transition-all border border-transparent hover:border-blue-400/50 shadow-sm font-medium text-sm"
                                                            title="Adjust Custom Fee"
                                                        >
                                                            <DollarSign size={18} /> <span className="md:hidden">Adjust Fee</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setWithdrawEnrollment(enroll)}
                                                            className="flex-1 md:flex-none flex justify-center items-center gap-2 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white px-4 py-2.5 rounded-xl transition-all border border-transparent hover:border-red-400/50 shadow-sm font-medium text-sm"
                                                            title="Withdraw / Delete Enrollment"
                                                        >
                                                            <Trash2 size={18} /> <span className="md:hidden">Withdraw</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!student.enrollment || student.enrollment.length === 0) && (
                                                <div className="text-center py-12 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-3">
                                                    <BookOpen size={32} className="text-slate-600" />
                                                    <p className="text-slate-400 font-medium">Student is not enrolled in any active programs.</p>
                                                    <button
                                                        onClick={() => setShowEnrollModal(true)}
                                                        className="mt-2 text-sm text-blue-400 hover:text-blue-300 font-bold underline underline-offset-4"
                                                    >
                                                        Enroll Now
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PERFORMANCE TAB */}
                            {activeTab === 'performance' && (
                                <div className="animate-fade-in">
                                    <StudentPerformance studentId={id!} />
                                </div>
                            )}

                        </div>
                    </div>
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

            {/* ADJUST FEE MODAL */}
            <AdjustFeeModal
                isOpen={!!adjustFeeEnrollment}
                onClose={() => setAdjustFeeEnrollment(null)}
                enrollment={adjustFeeEnrollment}
                studentId={id!}
            />

            {/* BULK FEE MODAL FOR ENROLLMENT */}
            <BulkFeeModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onSubmit={(date, fees) => {
                    enrollMutation.mutate({ enrollmentDate: date, customFees: fees });
                }}
                selectedStudents={[student].filter(Boolean)}
                selectedPrograms={allPrograms?.filter((p: any) => p.program_id === parseInt(selectedProgramId)) || []}
                isSubmitting={enrollMutation.isPending}
                initialDate={new Date().toISOString().split('T')[0]}
            />

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
