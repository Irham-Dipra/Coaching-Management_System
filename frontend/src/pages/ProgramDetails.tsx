import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { Users, FileText, DollarSign, Calendar, GraduationCap, Clock, Plus, X, Trash2, AlertCircle, Edit, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import CreateExamModal from '../components/CreateExamModal';
import EditProgramModal from '../components/EditProgramModal';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { ScheduleRepository } from '../repositories/ScheduleRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import BatchPaymentModal from '../components/BatchPaymentModal';

const ProgramDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = useState<'students' | 'exams' | 'attendance' | 'schedule'>('students');
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // New Edit State
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const queryClient = useQueryClient();

    const { data: program, isLoading } = useQuery({
        queryKey: ['program', id],
        queryFn: () => ProgramRepository.getProgramById(id!),
        enabled: !!id
    });

    // Fetch Attendance when tab is active
    const { data: fetchedAttendance, refetch: refetchAttendance } = useQuery({
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

    // Added Delete Mutation
    const deleteEnrollmentMutation = useMutation({
        mutationFn: StudentRepository.deleteEnrollment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['program', id] });
            // Also invalidate student list if needed
        },
        onError: (err) => {
            alert("Failed to remove student");
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
    const totalExams = program.exam?.length || 0;

    // Calculate Fees
    let totalCollected = 0;
    let totalDue = 0; // This requires more complex logic, for now we sum known dues if available

    // Iterate through enrollments to sum up payments (if loaded)
    program.enrollment?.forEach((enroll: any) => {
        enroll.payment?.forEach((pay: any) => {
            // Assuming 'paid_amount' exists in payment table
            totalCollected += Number(pay.paid_amount || 0);
        });
    });

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">Program</span>
                        {program.batch && (
                            <span className="text-xs text-gray-500 font-medium px-2 py-0.5 border rounded">
                                {program.batch.batch_name}
                            </span>
                        )}
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">{program.program_name}</h1>
                </div>
                <div className="flex gap-3">
                    {/* View Routine Button */}
                    {program.routine && (
                        <a
                            href={program.routine}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded shadow-sm hover:bg-blue-100 flex items-center gap-2 font-medium text-sm"
                        >
                            <ExternalLink size={16} /> View Routine
                        </a>
                    )}

                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="bg-white text-gray-700 border border-gray-300 p-2 rounded shadow-sm hover:bg-gray-50 flex items-center justify-center font-medium"
                        title="Edit Program Details"
                    >
                        <Edit size={18} />
                    </button>

                    <button
                        onClick={() => setIsBatchModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 flex items-center gap-2 font-medium"
                    >
                        <Users size={18} /> Record Batch Payment
                    </button>

                    <Link
                        to={`/admin/finance/program/${id}?view=revenue`}
                        className="bg-white text-green-600 border border-green-200 px-3 py-2 rounded shadow-sm hover:bg-green-50 flex items-center gap-2 font-medium text-sm"
                    >
                        <DollarSign size={16} /> Revenue
                    </Link>
                    <Link
                        to={`/admin/finance/program/${id}?view=due_monthly`}
                        className="bg-white text-amber-600 border border-amber-200 px-3 py-2 rounded shadow-sm hover:bg-amber-50 flex items-center gap-2 font-medium text-sm"
                    >
                        <FileText size={16} /> Due (Mo)
                    </Link>
                    <Link
                        to={`/admin/finance/program/${id}?view=due_overall`}
                        className="bg-white text-red-600 border border-red-200 px-3 py-2 rounded shadow-sm hover:bg-red-50 flex items-center gap-2 font-medium text-sm"
                    >
                        <AlertCircle size={16} /> Due (All)
                    </Link>
                </div>
            </div>

            {/* ... stats ... */}

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

            {/* ... rest of component ... */}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>

                        <div className="flex gap-4 mt-2 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                                <Calendar size={16} />
                                <span>Starts: {program.start_date || 'TBD'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock size={16} />
                                <span>Ends: {program.end_date || 'Tentative'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right mt-4 md:mt-0">
                        <p className="text-sm text-gray-500">Monthly Fee</p>
                        <p className="text-2xl font-bold text-green-600">৳{program.monthly_fee}</p>
                    </div>
                </div>

                {/* STATS GRID */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-100">
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Total Students</p>
                        <div className="flex items-center gap-2 mt-1">
                            <Users size={20} className="text-blue-500" />
                            <span className="text-xl font-bold text-gray-900">{totalEnrolled}</span>
                        </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Total Revenue</p>
                        <div className="flex items-center gap-2 mt-1">
                            <DollarSign size={20} className="text-green-500" />
                            <span className="text-xl font-bold text-gray-900">৳{totalCollected}</span>
                        </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Teachers Info</p>
                        <div className="flex items-center gap-2 mt-1">
                            <GraduationCap size={20} className="text-purple-500" />
                            <span className="text-xl font-bold text-gray-900">{teachersCount} Assigned</span>
                        </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Exams Conducted</p>
                        <div className="flex items-center gap-2 mt-1">
                            <FileText size={20} className="text-orange-500" />
                            <span className="text-xl font-bold text-gray-900">{totalExams}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('students')}
                        className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'students'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Enrolled Students ({totalEnrolled})
                    </button>
                    <button
                        onClick={() => setActiveTab('exams')}
                        className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'exams'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Exams History ({totalExams})
                    </button>
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'attendance'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Attendance
                    </button>
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'schedule'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Schedule
                    </button>
                </div>

                <div className="p-6">
                    {/* STUDENTS TAB */}
                    {activeTab === 'students' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="p-3 border-b">ID</th>
                                        <th className="p-3 border-b">Name</th>
                                        <th className="p-3 border-b">Roll</th>
                                        <th className="p-3 border-b">Contact</th>
                                        <th className="p-3 border-b">Joined Date</th>
                                        <th className="p-3 border-b w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {program.enrollment
                                        ?.filter((enroll: any) => enroll.status !== 'Withdrawn') // Filter out soft-deleted
                                        .map((enroll: any) => (
                                            <tr key={enroll.enrollment_id} className="hover:bg-gray-50 border-b border-gray-50 group">
                                                <td className="p-3 text-gray-500 text-sm">#{enroll.student.student_id}</td>
                                                <td className="p-3 font-medium text-gray-900">
                                                    <Link to={`/students/${enroll.student.student_id}`} className="hover:text-blue-600 hover:underline">
                                                        {enroll.student.name}
                                                    </Link>
                                                </td>
                                                <td className="p-3 text-gray-600 text-sm font-mono">{enroll.roll_no}</td>
                                                <td className="p-3 text-gray-600 text-sm">{enroll.student.contact || '-'}</td>
                                                <td className="p-3 text-gray-600 text-sm">{enroll.enrollment_date || '-'}</td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Are you sure you want to remove ${enroll.student.name} from this program?`)) {
                                                                deleteEnrollmentMutation.mutate(enroll.enrollment_id);
                                                            }
                                                        }}
                                                        className="text-gray-300 hover:text-red-600 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                        title="Remove Student"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    {totalEnrolled === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-gray-400">
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
                                <div className="text-center py-8 text-gray-400 border border-dashed rounded-lg">
                                    No exams scheduled for this program yet.
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {program.program_exam?.map((pe: any) => {
                                        const exam = pe.exam; // Extract nested exam
                                        if (!exam) return null;

                                        return (
                                            <li key={exam.exam_id} className="border p-4 rounded-lg flex justify-between items-center hover:bg-gray-50 transition-colors">
                                                <Link to={`/exams/${exam.exam_id}`} className="block flex-1">
                                                    <div>
                                                        <p className="font-bold text-blue-600 hover:underline">{exam.exam_name}</p>
                                                        <p className="text-xs text-gray-500">{exam.exam_date} • {exam.exam_type}</p>
                                                    </div>
                                                </Link>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-gray-700">Total Marks: {exam.total_marks}</p>
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>
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
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-gray-700">Select Date:</label>
                                    <input
                                        type="date"
                                        value={attendanceDate}
                                        onChange={(e) => setAttendanceDate(e.target.value)}
                                        className="border rounded px-3 py-1.5 text-gray-700 focus:outline-blue-500"
                                    />
                                </div>
                                <button
                                    onClick={saveAttendance}
                                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 shadow-sm"
                                >
                                    Save Attendance
                                </button>
                            </div>

                            <div className="bg-white border rounded-xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="p-4">Student Name</th>
                                            <th className="p-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {attendanceData.map((student: any) => (
                                            <tr key={student.enrollment_id} className={`hover:bg-gray-50 ${!student.status ? 'opacity-60 bg-gray-50/50' : ''}`}>
                                                <td className="p-4">
                                                    <p className="font-medium text-gray-900">{student.name}</p>
                                                    <p className="text-xs text-gray-400">Roll: {student.roll_no}</p>
                                                </td>
                                                <td className="p-4 flex justify-center items-center gap-3">
                                                    {!student.status && (
                                                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 uppercase tracking-wide">
                                                            Not Recorded
                                                        </span>
                                                    )}
                                                    {['Present', 'Absent'].map((status) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleAttendanceChange(student.enrollment_id, status)}
                                                            className={`px-3 py-1 text-sm rounded-full border transition-colors ${student.status === status
                                                                ? status === 'Absent' ? 'bg-red-100 text-red-700 border-red-200 font-bold'
                                                                    : 'bg-green-100 text-green-700 border-green-200 font-bold'
                                                                : 'text-gray-500 border-transparent hover:bg-gray-100'
                                                                }`}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                </td>
                                            </tr>
                                        ))}
                                        {attendanceData.length === 0 && (
                                            <tr><td colSpan={2} className="p-8 text-center text-gray-400">No students found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SCHEDULE TAB */}
                    {activeTab === 'schedule' && <ProgramScheduleManager programId={parseInt(id!)} />}
                </div>
            </div>
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Weekly Class Schedule</h3>
                    <p className="text-sm text-gray-500">Manage time slots for this batch.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsConnectOpen(true)}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2 font-semibold transition-colors shadow-sm"
                    >
                        <Calendar size={18} /> Connect Existing
                    </button>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2 font-bold transition-colors"
                    >
                        <Plus size={18} /> Quick Create
                    </button>
                </div>
            </div>

            {/* ASSIGNED SLOTS LIST */}
            <div className="bg-white rounded-xl border border-gray-200 min-h-[300px] shadow-sm">
                {!assignedWindows || assignedWindows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Calendar size={64} className="mb-4 text-gray-200" />
                        <p className="text-lg font-medium">No classes scheduled yet.</p>
                        <p className="text-sm">Click "Quick Create" to add a new time slot.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                        {days.map(day => {
                            const mySlots = assignedWindows?.filter((w: any) => w.day_of_week === day).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
                            if (!mySlots || mySlots.length === 0) return null;

                            return (
                                <div key={day} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider">{day}</h4>
                                        <span className="text-xs font-semibold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{mySlots.length} Classes</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {mySlots.map((s: any) => (
                                            <div key={s.window_id} className="p-4 flex justify-between items-center bg-white group hover:bg-gray-50 transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-blue-500" />
                                                        <span className="font-mono text-lg font-bold text-gray-800">
                                                            {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 ml-6">
                                                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                            {s.room?.room_name || 'Room TBD'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => { if (confirm('Are you sure you want to remove this class from the schedule?')) unassignMutation.mutate(s.window_id) }}
                                                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">Quick Create Slot</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200 transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                            <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg mb-4 flex gap-3 items-start">
                                <Users size={18} className="mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-bold">Auto-Assignment</p>
                                    <p className="text-xs opacity-90 mt-1">This slot will be created and automatically linked to this program.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Select Room</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    value={newData.room_id}
                                    onChange={e => setNewData({ ...newData, room_id: e.target.value })}
                                    required
                                >
                                    <option value="">Choose a room...</option>
                                    {rooms?.map((r: any) => (
                                        <option key={r.room_id} value={r.room_id}>{r.room_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Day of Week</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        value={newData.day_of_week}
                                        onChange={e => setNewData({ ...newData, day_of_week: e.target.value })}
                                    >
                                        {days.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Start Time</label>
                                        <input
                                            type="time"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            value={newData.start_time}
                                            onChange={e => setNewData({ ...newData, start_time: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">End Time</label>
                                        <input
                                            type="time"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            value={newData.end_time}
                                            onChange={e => setNewData({ ...newData, end_time: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg mt-2">
                                Create & Assign Slot
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* CONNECT MODAL */}
            {isConnectOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-[80vh]">
                        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">Connect Existing Slots</h3>
                                <p className="text-xs text-gray-500">Check the boxes to assign slots to this program.</p>
                            </div>
                            <button onClick={() => setIsConnectOpen(false)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200 transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                            {!allWindows ? (
                                <div className="flex justify-center items-center h-full text-gray-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
                                    Loading available slots...
                                </div>
                            ) : (
                                <div className="masonry-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {days.map(day => {
                                        const daySlots = allWindows.filter((w: any) => w.day_of_week === day).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
                                        if (daySlots.length === 0) return null;
                                        return (
                                            <div key={day} className="bg-white border rounded-lg overflow-hidden h-fit shadow-sm">
                                                <div className="bg-gray-100 px-3 py-1.5 text-xs font-bold uppercase text-gray-600 border-b flex justify-between">
                                                    <span>{day}</span>
                                                    <span className="text-gray-400 font-normal">{daySlots.length} slots</span>
                                                </div>
                                                <div className="divide-y divide-gray-50">
                                                    {daySlots.map((slot: any) => {
                                                        const isSelected = selectedWindowIds.includes(slot.window_id);
                                                        return (
                                                            <div
                                                                key={slot.window_id}
                                                                onClick={() => toggleConnection(slot.window_id)}
                                                                className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                                                            >
                                                                <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
                                                                    {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                                                </div>
                                                                <div>
                                                                    <div className={`font-mono font-bold text-sm ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                                                        {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-0.5">{slot.room?.room_name}</div>
                                                                    {slot.program_schedule?.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                                            {slot.program_schedule.map((ps: any) => (
                                                                                <span key={ps.program.program_id} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded truncate max-w-[100px]">
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
                        <div className="p-4 border-t bg-white shrink-0 flex justify-between items-center z-10">
                            <span className="text-xs text-gray-500">Click Done to save changes.</span>
                            <button onClick={handleSaveConnection} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium transition-colors">Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgramDetails;
