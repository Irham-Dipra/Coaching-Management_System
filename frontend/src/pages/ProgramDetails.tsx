import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { Users, FileText, DollarSign, Calendar, GraduationCap, Clock, Plus, X, Trash2, AlertCircle, Edit, ExternalLink, TrendingUp, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import CreateExamModal from '../components/CreateExamModal';
import EditProgramModal from '../components/EditProgramModal';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { ScheduleRepository } from '../repositories/ScheduleRepository';
import BatchPaymentModal from '../components/BatchPaymentModal';
import WithdrawalModal from '../components/WithdrawalModal';
import ProgramPerformance from './ProgramPerformance';

const ProgramDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = useState<'students' | 'exams' | 'attendance' | 'schedule' | 'performance'>('students');
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [withdrawEnrollment, setWithdrawEnrollment] = useState<any>(null); // New state for modal
    const queryClient = useQueryClient();

    const { data: program, isLoading } = useQuery({
        queryKey: ['program', id],
        queryFn: () => ProgramRepository.getProgramById(id!),
        enabled: !!id
    });

    // Fetch Attendance when tab is active
    const { data: fetchedAttendance } = useQuery({
        queryKey: ['attendance', id, attendanceDate],
        queryFn: () => AttendanceRepository.getDailyAttendance(id!, attendanceDate),
        enabled: activeTab === 'attendance' && !!id
    });

    // Update local state when data loads
    React.useEffect(() => {
        if (fetchedAttendance) {
            setAttendanceData(fetchedAttendance);
        }
    }, [fetchedAttendance]);

    const attendanceMutation = useMutation({
        mutationFn: (data: any) => AttendanceRepository.submitAttendance(parseInt(id!), attendanceDate, data),
        onSuccess: () => {
            alert("Attendance Saved!");
            queryClient.invalidateQueries({ queryKey: ['attendance', id] });
        }
    });

    const handleAttendanceChange = (enrollmentId: number, status: string) => {
        setAttendanceData(prev => prev.map(item =>
            item.enrollment_id === enrollmentId ? { ...item, status } : item
        ));
    };

    const saveAttendance = () => {
        const records = attendanceData.map(item => ({
            enrollment_id: item.enrollment_id,
            status: item.status, // Only send marked status
            attendance_id: item.attendance_id,
            date: attendanceDate
        })).filter(r => r.status);
        attendanceMutation.mutate(records);
    };

    if (isLoading) return <div className="p-8">Loading details...</div>;
    if (!program) return <div className="p-8">Program not found</div>;

    // --- Statistics Calculation ---
    const totalEnrolled = program.enrollment?.length || 0;
    const teachersCount = program.teacher_program_enrollment?.length || 0;
    const totalExams = program.program_exam?.length || 0;

    // Calculate Fees
    let totalCollected = 0;

    // Iterate through enrollments to sum up payments (if loaded)
    program.enrollment?.forEach((enroll: any) => {
        enroll.payment?.forEach((pay: any) => {
            // Assuming 'paid_amount' exists in payment table
            totalCollected += Number(pay.paid_amount || 0);
        });
    });

    return (
        <div className="space-y-8 animate-fade-in">
            {/* HEADER */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 p-8 shadow-xl">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-wider">Program</span>
                            {program.batch && (
                                <span className="text-xs text-slate-400 font-medium px-2 py-0.5 border border-slate-600 rounded bg-slate-800">
                                    {program.batch.batch_name}
                                </span>
                            )}
                            {program.routine && (
                                <a
                                    href={program.routine}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline ml-2 transition-colors"
                                >
                                    <ExternalLink size={12} /> View Routine
                                </a>
                            )}
                        </div>
                        <h1 className="text-4xl font-bold text-white mb-2">{program.program_name}</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 p-3 rounded-xl shadow-lg transition-all hover:-translate-y-0.5"
                            title="Edit Program Details"
                        >
                            <Edit size={20} />
                        </button>

                        <button
                            onClick={() => setIsBatchModalOpen(true)}
                            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 font-bold transition-all hover:-translate-y-0.5"
                        >
                            <Users size={20} /> Record Batch Payment
                        </button>
                    </div>
                </div>

                {/* Quick Stats / Finance Links Row */}
                <div className="flex flex-wrap gap-4 pt-6 border-t border-slate-700/50">
                    <Link
                        to={`/admin/finance/program/${id}?view=revenue`}
                        className="flex-1 min-w-[160px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-5 py-4 rounded-xl hover:bg-emerald-500/20 transition-all flex flex-col items-start group hover:-translate-y-0.5"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-80 mb-2">
                            <DollarSign size={14} /> Revenue
                        </div>
                        <span className="text-sm font-medium group-hover:text-emerald-300 transition-colors">View Breakdown</span>
                    </Link>

                    <Link
                        to={`/admin/finance/program/${id}?view=due_monthly`}
                        className="flex-1 min-w-[160px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-5 py-4 rounded-xl hover:bg-amber-500/20 transition-all flex flex-col items-start group hover:-translate-y-0.5"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-80 mb-2">
                            <FileText size={14} /> Due (Monthly)
                        </div>
                        <span className="text-sm font-medium group-hover:text-amber-300 transition-colors">View List</span>
                    </Link>

                    <Link
                        to={`/admin/finance/program/${id}?view=due_overall`}
                        className="flex-1 min-w-[160px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-5 py-4 rounded-xl hover:bg-rose-500/20 transition-all flex flex-col items-start group hover:-translate-y-0.5"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-80 mb-2">
                            <AlertCircle size={14} /> Due (All-Time)
                        </div>
                        <span className="text-sm font-medium group-hover:text-rose-300 transition-colors">View List</span>
                    </Link>
                </div>
            </div>

            {/* Batch Payment Modal */}
            <BatchPaymentModal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                initialProgramId={id}
            />

            {/* Edit Program Modal */}
            <EditProgramModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                program={program}
            />

            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 p-8 shadow-xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <div className="flex gap-6 mt-2 text-sm text-slate-400">
                            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
                                <Calendar size={16} className="text-blue-400" />
                                <span>Starts: <span className="text-slate-200 font-medium">{program.start_date || 'TBD'}</span></span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
                                <Clock size={16} className="text-purple-400" />
                                <span>Ends: <span className="text-slate-200 font-medium">{program.end_date || 'Tentative'}</span></span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right mt-6 md:mt-0 bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-sm">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">Monthly Fee</p>
                        <p className="text-3xl font-bold text-emerald-400">৳{program.monthly_fee}</p>
                    </div>
                </div>

                {/* STATS GRID */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-8 pt-8 border-t border-slate-700/50">
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors">
                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Total Students</p>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Users size={20} /></div>
                            <span className="text-2xl font-bold text-white">{totalEnrolled}</span>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors">
                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Total Revenue</p>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><DollarSign size={20} /></div>
                            <span className="text-2xl font-bold text-white">৳{totalCollected}</span>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors">
                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Teachers Info</p>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><GraduationCap size={20} /></div>
                            <span className="text-2xl font-bold text-white">{teachersCount} <span className="text-sm font-normal text-slate-500 ml-1">Assigned</span></span>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors">
                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Exams Conducted</p>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400"><FileText size={20} /></div>
                            <span className="text-2xl font-bold text-white">{totalExams}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 overflow-hidden min-h-[400px] shadow-xl">
                <div className="flex border-b border-slate-700/50 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('students')}
                        className={`flex-1 py-5 text-sm font-bold text-center transition-all whitespace-nowrap min-w-[120px] ${activeTab === 'students'
                            ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                    >
                        Enrolled Students ({totalEnrolled})
                    </button>
                    <button
                        onClick={() => setActiveTab('exams')}
                        className={`flex-1 py-5 text-sm font-bold text-center transition-all whitespace-nowrap min-w-[120px] ${activeTab === 'exams'
                            ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                    >
                        Exams History ({totalExams})
                    </button>
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`flex-1 py-5 text-sm font-bold text-center transition-all whitespace-nowrap min-w-[120px] ${activeTab === 'attendance'
                            ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                    >
                        Attendance
                    </button>
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`flex-1 py-5 text-sm font-bold text-center transition-all whitespace-nowrap min-w-[120px] ${activeTab === 'schedule'
                            ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                    >
                        Schedule
                    </button>
                    <button
                        onClick={() => setActiveTab('performance')}
                        className={`flex-1 py-5 text-sm font-bold text-center transition-all whitespace-nowrap min-w-[120px] ${activeTab === 'performance'
                            ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5'
                            : 'text-emerald-500/70 hover:text-emerald-300 hover:bg-emerald-500/10'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <TrendingUp size={16} /> Performance
                        </div>
                    </button>
                </div>

                <div className="p-8">
                    {/* STUDENTS TAB */}
                    {activeTab === 'students' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold border-b border-slate-700">
                                    <tr>
                                        <th className="p-4 border-b border-slate-700">ID</th>
                                        <th className="p-4 border-b border-slate-700">Name</th>
                                        <th className="p-4 border-b border-slate-700">Roll</th>
                                        <th className="p-4 border-b border-slate-700">Contact</th>
                                        <th className="p-4 border-b border-slate-700">Joined Date</th>
                                        <th className="p-4 border-b border-slate-700 w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {program.enrollment
                                        ?.filter((enroll: any) => enroll.status !== 'Withdrawn') // Filter out soft-deleted
                                        .map((enroll: any) => (
                                            <tr key={enroll.enrollment_id} className="hover:bg-slate-700/30 transition-colors group">
                                                <td className="p-4 text-slate-500 text-sm">#{enroll.student.student_id}</td>
                                                <td className="p-4 font-medium text-slate-200">
                                                    <Link to={`/students/${enroll.student.student_id}`} className="hover:text-blue-400 hover:underline">
                                                        {enroll.student.name}
                                                    </Link>
                                                </td>
                                                <td className="p-4 text-slate-400 text-sm font-mono">{enroll.roll_no}</td>
                                                <td className="p-4 text-slate-400 text-sm">{enroll.student.contact || '-'}</td>
                                                <td className="p-4 text-slate-500 text-sm">{enroll.enrollment_date || '-'}</td>
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => setWithdrawEnrollment(enroll)}
                                                        className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                        title="Withdraw / Remove Student"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    {totalEnrolled === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-slate-500 italic">
                                                No students enrolled yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* EXAMS TAB */}
                    {activeTab === 'exams' && (
                        <div>
                            <div className="flex justify-end mb-4">
                                {/* Button Removed as per request */}
                            </div>
                            {totalExams === 0 ? (
                                <div className="text-center py-12 text-slate-500 border border-dashed border-slate-700 rounded-2xl bg-slate-900/30">
                                    No exams scheduled for this program yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {program.program_exam?.map((pe: any) => {
                                        const exam = pe.exam;
                                        if (!exam) return null;
                                        return (
                                            <div key={exam.exam_id} className="relative bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-blue-500/30 transition-all group">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                        <Award size={20} />
                                                    </div>
                                                    <span className="text-xs text-slate-500 font-mono">{exam.exam_date}</span>
                                                </div>
                                                <h3 className="text-lg font-bold text-white mb-1">{exam.exam_name}</h3>
                                                <div className="flex justify-between items-center text-sm text-slate-400 mt-4">
                                                    <span>{exam.subject}</span>
                                                    <span className="bg-slate-700/50 px-2 py-1 rounded text-xs">{exam.exam_type}</span>
                                                </div>
                                                <Link to={`/exams/${exam.exam_id}`} className="absolute inset-0 z-10" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Create Exam Modal */}
                            <CreateExamModal
                                isOpen={isExamModalOpen}
                                onClose={() => setIsExamModalOpen(false)}
                                programId={id!}
                            />
                        </div>
                    )}

                    {/* ATTENDANCE TAB */}
                    {activeTab === 'attendance' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-semibold text-slate-400">Select Date:</label>
                                    <input
                                        type="date"
                                        value={attendanceDate}
                                        onChange={(e) => setAttendanceDate(e.target.value)}
                                        className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                    />
                                </div>
                                <button
                                    onClick={saveAttendance}
                                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5"
                                >
                                    Save Attendance
                                </button>
                            </div>

                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden backdrop-blur-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold border-b border-slate-700">
                                        <tr>
                                            <th className="p-4">Student Name</th>
                                            <th className="p-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {attendanceData.map((student: any) => (
                                            <tr key={student.enrollment_id} className={`hover:bg-slate-700/30 transition-colors ${!student.status ? 'opacity-70 bg-slate-800/30' : ''}`}>
                                                <td className="p-4">
                                                    <p className="font-medium text-slate-200">{student.name}</p>
                                                    <p className="text-xs text-slate-500">Roll: {student.roll_no}</p>
                                                </td>
                                                <td className="p-4 flex justify-center items-center gap-3">
                                                    {!student.status && (
                                                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 uppercase tracking-wide">
                                                            Not Recorded
                                                        </span>
                                                    )}
                                                    {['Present', 'Absent'].map((status) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleAttendanceChange(student.enrollment_id, status)}
                                                            className={`px-4 py-1.5 text-sm rounded-lg border transition-all ${student.status === status
                                                                ? status === 'Absent' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 font-bold shadow-lg shadow-rose-500/10'
                                                                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 font-bold shadow-lg shadow-emerald-500/10'
                                                                : 'text-slate-500 border-transparent hover:bg-slate-700/50 hover:text-slate-300'
                                                                }`}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                </td>
                                            </tr>
                                        ))}
                                        {attendanceData.length === 0 && (
                                            <tr><td colSpan={2} className="p-12 text-center text-slate-500 italic">No students found for attendance.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SCHEDULE TAB */}
                    {activeTab === 'schedule' && <ProgramScheduleManager programId={parseInt(id!)} />}

                    {/* PERFORMANCE TAB */}
                    {activeTab === 'performance' && (
                        <ProgramPerformance programId={id!} />
                    )}
                </div>
            </div>

            {/* WITHDRAWAL MODAL */}
            {withdrawEnrollment && (
                <WithdrawalModal
                    isOpen={!!withdrawEnrollment}
                    onClose={() => setWithdrawEnrollment(null)}
                    enrollment={withdrawEnrollment}
                    studentId={String(withdrawEnrollment.student.student_id)}
                    onSuccess={() => {
                        setWithdrawEnrollment(null);
                        queryClient.invalidateQueries({ queryKey: ['program', id] });
                    }}
                />
            )}
        </div>
    );
};

// --- SUB-COMPONENT: PROGRAM SCHEDULE MANAGER ---

const ProgramScheduleManager: React.FC<{ programId: number }> = ({ programId }) => {
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isConnectOpen, setIsConnectOpen] = useState(false);
    const [selectedWindowIds, setSelectedWindowIds] = useState<number[]>([]);

    // FETCH DATA
    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: ScheduleRepository.getRooms });
    const { data: assignedWindows } = useQuery({
        queryKey: ['program_schedule', programId],
        queryFn: () => ScheduleRepository.getProgramSchedule(programId)
    });

    // Sync local state when modal opens
    React.useEffect(() => {
        if (isConnectOpen && assignedWindows) {
            setSelectedWindowIds(assignedWindows.map((w: any) => w.window_id));
        }
    }, [isConnectOpen, assignedWindows]);

    // Fetch all windows only when needed for the Connect modal
    const { data: allWindows } = useQuery({
        queryKey: ['windows'],
        queryFn: ScheduleRepository.getAllWindows,
        enabled: isConnectOpen
    });

    // MUTATIONS
    const updateScheduleMutation = useMutation({
        mutationFn: (newIds: number[]) => ScheduleRepository.assignSchedule(programId, newIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['program_schedule', programId] });
            setIsConnectOpen(false);
        },
        onError: (err) => alert("Failed: " + err)
    });

    const unassignMutation = useMutation({
        mutationFn: (windowId: number) => {
            const currentIds = assignedWindows?.map((w: any) => w.window_id) || [];
            return ScheduleRepository.assignSchedule(programId, currentIds.filter((id: number) => id !== windowId));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['program_schedule', programId] });
        },
        onError: (err) => alert("Failed to unlink: " + err)
    });

    // Quick Create State
    const [newData, setNewData] = useState({
        room_id: '',
        day_of_week: 'Saturday',
        start_time: '',
        end_time: ''
    });

    const createMutation = useMutation({
        mutationFn: () => ScheduleRepository.createWindow({
            ...newData,
            room_id: parseInt(newData.room_id),
            program_ids: [programId] // Auto-assign
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['windows'] });
            queryClient.invalidateQueries({ queryKey: ['program_schedule', programId] });
            setIsCreateOpen(false);
            setNewData({ room_id: '', day_of_week: 'Saturday', start_time: '', end_time: '' });
            alert("New Slot Created & Assigned!");
        },
        onError: (err: any) => alert(err.message)
    });

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate();
    };

    const toggleConnection = (windowId: number) => {
        setSelectedWindowIds(prev =>
            prev.includes(windowId)
                ? prev.filter(id => id !== windowId)
                : [...prev, windowId]
        );
    };

    const handleSaveConnection = () => {
        updateScheduleMutation.mutate(selectedWindowIds);
    };

    const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    if (!assignedWindows && !rooms) return <div className="p-4 text-gray-500">Loading schedule...</div>;

    return (
        <div className="space-y-8">
            {/* HEADER & ACTIONS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                <div>
                    <h3 className="text-xl font-bold text-white">Weekly Class Schedule</h3>
                    <p className="text-sm text-slate-400 mt-1">Manage time slots for this batch.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsConnectOpen(true)}
                        className="bg-slate-700 border border-slate-600 text-slate-200 px-5 py-2.5 rounded-xl hover:bg-slate-600 hover:text-white flex items-center gap-2 font-semibold transition-colors shadow-lg"
                    >
                        <Calendar size={18} /> Connect Existing
                    </button>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center gap-2 font-bold transition-all hover:-translate-y-0.5"
                    >
                        <Plus size={18} /> Quick Create
                    </button>
                </div>
            </div>

            {/* ASSIGNED SLOTS LIST */}
            <div className="bg-slate-800/30 rounded-2xl border border-slate-700 min-h-[300px] shadow-inner">
                {!assignedWindows || assignedWindows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                        <Calendar size={64} className="mb-4 text-slate-600" />
                        <p className="text-lg font-medium text-slate-400">No classes scheduled yet.</p>
                        <p className="text-sm">Click "Quick Create" to add a new time slot.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                        {days.map(day => {
                            const mySlots = assignedWindows?.filter((w: any) => w.day_of_week === day).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
                            if (!mySlots || mySlots.length === 0) return null;

                            return (
                                <div key={day} className="border border-slate-700 rounded-xl overflow-hidden shadow-lg bg-slate-800/80 hover:bg-slate-800 transition-colors">
                                    <div className="bg-slate-900/50 px-5 py-4 border-b border-slate-700 flex justify-between items-center">
                                        <h4 className="font-bold text-slate-300 uppercase text-xs tracking-wider">{day}</h4>
                                        <span className="text-xs font-semibold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full border border-slate-600">{mySlots.length} Classes</span>
                                    </div>
                                    <div className="divide-y divide-slate-700/50">
                                        {mySlots.map((s: any) => (
                                            <div key={s.window_id} className="p-5 flex justify-between items-center bg-transparent group hover:bg-slate-700/30 transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-blue-400" />
                                                        <span className="font-mono text-lg font-bold text-slate-200">
                                                            {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2 ml-6">
                                                        <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                                                            {s.room?.room_name || 'Room TBD'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => { if (confirm('Are you sure you want to remove this class from the schedule?')) unassignMutation.mutate(s.window_id) }}
                                                    className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                    title="Remove from schedule"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* CREATE MODAL */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 border border-slate-700">
                        <div className="px-6 py-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-white">Quick Create Slot</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white rounded-full p-1 hover:bg-slate-700 transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
                            <div className="bg-blue-500/10 text-blue-300 text-sm p-4 rounded-xl border border-blue-500/20 mb-4 flex gap-3 items-start">
                                <Users size={18} className="mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-bold">Auto-Assignment</p>
                                    <p className="text-xs opacity-80 mt-1">This slot will be created and automatically linked to this program.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-2">Select Room</label>
                                <select
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={newData.room_id}
                                    onChange={e => setNewData({ ...newData, room_id: e.target.value })}
                                    required
                                >
                                    <option value="" className="bg-slate-800">Choose a room...</option>
                                    {rooms?.map((r: any) => (
                                        <option key={r.room_id} value={r.room_id} className="bg-slate-800">{r.room_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-2">Day of Week</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        value={newData.day_of_week}
                                        onChange={e => setNewData({ ...newData, day_of_week: e.target.value })}
                                    >
                                        {days.map(d => <option key={d} value={d} className="bg-slate-800">{d}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-300 mb-2">Start Time</label>
                                        <input
                                            type="time"
                                            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            value={newData.start_time}
                                            onChange={e => setNewData({ ...newData, start_time: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-300 mb-2">End Time</label>
                                        <input
                                            type="time"
                                            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            value={newData.end_time}
                                            onChange={e => setNewData({ ...newData, end_time: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 mt-2">
                                Create & Assign Slot
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* CONNECT MODAL */}
            {isConnectOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-[80vh] border border-slate-700">
                        <div className="px-6 py-5 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-lg text-white">Connect Existing Slots</h3>
                                <p className="text-xs text-slate-400">Check the boxes to assign slots to this program.</p>
                            </div>
                            <button onClick={() => setIsConnectOpen(false)} className="text-slate-400 hover:text-white rounded-full p-1 hover:bg-slate-700 transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
                            {!allWindows ? (
                                <div className="flex justify-center items-center h-full text-slate-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-2"></div>
                                    Loading available slots...
                                </div>
                            ) : (
                                <div className="masonry-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {days.map(day => {
                                        const daySlots = allWindows.filter((w: any) => w.day_of_week === day).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
                                        if (daySlots.length === 0) return null;
                                        return (
                                            <div key={day} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden h-fit shadow-md">
                                                <div className="bg-slate-800 px-4 py-2 text-xs font-bold uppercase text-slate-400 border-b border-slate-700 flex justify-between items-center">
                                                    <span>{day}</span>
                                                    <span className="text-slate-500 font-normal">{daySlots.length} slots</span>
                                                </div>
                                                <div className="divide-y divide-slate-700/50">
                                                    {daySlots.map((slot: any) => {
                                                        const isSelected = selectedWindowIds.includes(slot.window_id);
                                                        return (
                                                            <div
                                                                key={slot.window_id}
                                                                onClick={() => toggleConnection(slot.window_id)}
                                                                className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/20 hover:bg-blue-500/30' : 'hover:bg-slate-700/50'}`}
                                                            >
                                                                <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-600 bg-slate-800'}`}>
                                                                    {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                                                </div>
                                                                <div>
                                                                    <div className={`font-mono font-bold text-sm ${isSelected ? 'text-blue-300' : 'text-slate-300'}`}>
                                                                        {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 mt-0.5">{slot.room?.room_name}</div>
                                                                    {slot.program_schedule?.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                                            {slot.program_schedule.map((ps: any) => (
                                                                                <span key={ps.program.program_id} className="text-[10px] bg-slate-700 text-slate-300 px-1.5 rounded truncate max-w-[100px] border border-slate-600">
                                                                                    {ps.program.program_name}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-700 bg-slate-800 shrink-0 flex justify-between items-center z-10">
                            <span className="text-xs text-slate-500">Click Done to save changes.</span>
                            <button onClick={handleSaveConnection} className="px-6 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-white font-bold transition-colors">Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgramDetails;
