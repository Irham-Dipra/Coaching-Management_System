import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScheduleRepository } from '../repositories/ScheduleRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import {
    ArrowLeft, Clock, MapPin, Users, Edit2, Save, X, Plus, Trash2,
    DollarSign, Search, AlertCircle
} from 'lucide-react';
import BatchPaymentModal from '../components/BatchPaymentModal';
import { ProgramRepository } from '../repositories/ProgramRepository';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ScheduleDetails: React.FC = () => {
    const { id: windowId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');

    // BATCH PAYMENT STATE
    const [isBatchPaymentOpen, setIsBatchPaymentOpen] = useState(false);

    // FETCH WINDOW DETAILS
    const { data: windowData, isLoading, error } = useQuery({
        queryKey: ['window', windowId],
        queryFn: () => ScheduleRepository.getWindowDetails(windowId || ''),
        enabled: !!windowId
    });

    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: ScheduleRepository.getRooms });
    const { data: windows } = useQuery({ queryKey: ['windows'], queryFn: ScheduleRepository.getAllWindows });
    const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms });

    // EDIT FORM STATE
    const [editError, setEditError] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        window_name: '',
        day_of_week: '',
        start_time: '',
        end_time: '',
        room_id: '',
        program_ids: [] as number[]
    });

    // Populate Edit Form
    useEffect(() => {
        if (windowData) {
            setEditForm({
                window_name: windowData.window_name || '',
                day_of_week: windowData.day_of_week,
                start_time: windowData.start_time,
                end_time: windowData.end_time,
                room_id: windowData.room_id.toString(),
                program_ids: windowData.programs?.map((p: any) => p.program_id) || windowData.program_schedule?.map((ps: any) => ps.program?.program_id) || []
            });
        }
    }, [windowData]);


    const updateMutation = useMutation({
        mutationFn: (data: any) => ScheduleRepository.updateWindow(windowId!, {
            ...data,
            room_id: parseInt(data.room_id)
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['window', windowId] });
            queryClient.invalidateQueries({ queryKey: ['windows'] });
            setIsEditing(false);
            setEditError(null);
            alert("Schedule updated!");
        },
        onError: (err: any) => setEditError(err.message || 'Failed to update schedule')
    });

    const deleteMutation = useMutation({
        mutationFn: ScheduleRepository.deleteWindow,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['windows'] });
            navigate('/admin/scheduling');
        }
    });

    const toggleProgram = (pid: number) => {
        setEditForm(prev => {
            const current = prev.program_ids;
            return {
                ...prev,
                program_ids: current.includes(pid)
                    ? current.filter(id => id !== pid)
                    : [...current, pid]
            };
        });
    };

    // Handle Manual Add Student
    const [selectedProgramForEnroll, setSelectedProgramForEnroll] = useState('');
    const [enrollSearch, setEnrollSearch] = useState('');

    // Using getAllStudents and filtering client side for now as searchStudents doesn't exist
    const { data: allStudents } = useQuery({
        queryKey: ['students-all'],
        queryFn: StudentRepository.getAllStudents,
        enabled: isAddStudentOpen
    });

    const searchResults = useMemo(() => {
        if (!allStudents || enrollSearch.length < 2) return [];
        return allStudents.filter((s: any) => s.name.toLowerCase().includes(enrollSearch.toLowerCase()));
    }, [allStudents, enrollSearch]);

    const enrollMutation = useMutation({
        mutationFn: (data: { student_id: number, program_id: number }) => StudentRepository.enrollStudent(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['window', windowId] });
            queryClient.invalidateQueries({ queryKey: ['students-by-program'] });
            setIsAddStudentOpen(false);
            setEnrollSearch('');
            alert("Student enrolled!");
        },
        onError: (err: any) => alert(err.message)
    });


    const attachedPrograms = windowData?.programs || windowData?.program_schedule?.map((ps: any) => ps.program) || [];

    const filteredStudents = useMemo(() => {
        if (!windowData?.students) return [];
        return windowData.students.filter((s: any) =>
            s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
            (s.student_code && s.student_code.toLowerCase().includes(studentSearch.toLowerCase())) ||
            (s.student_id && s.student_id.toString().includes(studentSearch))
        );
    }, [windowData, studentSearch]);

    if (isLoading) return <div className="p-8 text-white">Loading schedule details...</div>;
    if (error || !windowData) return <div className="p-8 text-red-500">Error loading schedule.</div>;

    // Helper to format time
    const formatTime = (t: string) => {
        if (!t) return '';
        const [h, m] = t.split(':');
        const hi = parseInt(h);
        const s = hi >= 12 ? 'PM' : 'AM';
        const h12 = hi % 12 || 12;
        return `${h12}:${m} ${s}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* TOP BAR */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/scheduling')} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            {windowData.window_name || "Untitled Slot"}
                            {windowData.window_name && <span className="text-sm font-normal text-slate-500 bg-slate-900 border border-slate-700 px-2 py-1 rounded">ID: {windowId}</span>}
                        </h1>
                        <div className="flex items-center gap-4 text-slate-400 mt-1">
                            <span className="flex items-center gap-1"><Clock size={16} className="text-blue-500" /> {windowData.day_of_week}, {formatTime(windowData.start_time)} - {formatTime(windowData.end_time)}</span>
                            <span className="flex items-center gap-1"><MapPin size={16} className="text-purple-500" /> {windowData.room?.room_name || 'No Room'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsEditing(true)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700`}
                    >
                        <Edit2 size={18} />
                        Edit Details
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Delete this schedule window? This cannot be undone.')) deleteMutation.mutate(Number(windowId));
                        }}
                        className="flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/20 border border-red-500/20 font-medium transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* EDIT MODAL */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-700 flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg text-white">Edit Schedule Window</h3>
                            <button onClick={() => { setIsEditing(false); setEditError(null); }} className="text-slate-400 hover:text-slate-200">&times;</button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); setEditError(null); updateMutation.mutate(editForm); }} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            {editError && (
                                <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r shadow-sm animate-pulse">
                                    <div className="flex items-start">
                                        <AlertCircle className="text-red-500 mr-2 mt-0.5 flex-shrink-0" size={18} />
                                        <div>
                                            <p className="text-sm text-red-400 font-bold">Validation Error</p>
                                            <p className="text-xs text-red-300 mt-1">{editError}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Subject / Window Name <span className="text-slate-500 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. Morning Assembly, Biology 101"
                                    value={editForm.window_name}
                                    onChange={e => setEditForm({ ...editForm, window_name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Room</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editForm.room_id}
                                    onChange={e => setEditForm({ ...editForm, room_id: e.target.value })}
                                    required
                                >
                                    <option value="" className="bg-slate-900">Select Room...</option>
                                    {rooms?.map((r: any) => (
                                        <option key={r.room_id} value={r.room_id} className="bg-slate-900">
                                            {r.room_name} (Cap: {r.capacity || '∞'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Day</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editForm.day_of_week}
                                        onChange={e => setEditForm({ ...editForm, day_of_week: e.target.value })}
                                    >
                                        {DAYS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Start</label>
                                    <input
                                        type="time"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none date-input-dark"
                                        value={editForm.start_time}
                                        onChange={e => setEditForm({ ...editForm, start_time: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">End</label>
                                    <input
                                        type="time"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none date-input-dark"
                                        value={editForm.end_time}
                                        onChange={e => setEditForm({ ...editForm, end_time: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Capacity and Program Assignment */}
                            {(() => {
                                const selectedRoom = rooms?.find((r: any) => r.room_id.toString() === editForm.room_id.toString());
                                const capacity = selectedRoom?.capacity || 0;
                                const selectedPrograms = programs?.filter((p: any) => editForm.program_ids.includes(p.program_id)) || [];
                                const totalStudents = selectedPrograms.reduce((sum: number, p: any) => sum + (p.student_count || 0), 0);
                                const isOverCapacity = capacity > 0 && totalStudents > capacity;

                                return (
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-medium text-slate-300">Assign Programs (Optional)</label>
                                            {editForm.room_id && (
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${isOverCapacity ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                                                    {totalStudents} / {capacity || '∞'} Students
                                                </span>
                                            )}
                                        </div>

                                        {isOverCapacity && (
                                            <div className="mb-3 text-xs text-red-400 font-bold flex items-center bg-red-500/10 p-2 rounded border border-red-500/20 animate-pulse">
                                                <AlertCircle size={14} className="mr-2" />
                                                Capacity Exceeded! Room can't fit active students.
                                            </div>
                                        )}

                                        <div className="border border-slate-700 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-700/50 bg-slate-900/30 custom-scrollbar">
                                            {(() => {
                                                const busyProgramMap = new Map<number, any>();
                                                if (windows && editForm.day_of_week && editForm.start_time && editForm.end_time) {
                                                    const parseT = (t: string) => parseInt(t.replace(/:/g, '').substring(0, 4));

                                                    const newStart = parseT(editForm.start_time);
                                                    const newEnd = parseT(editForm.end_time);

                                                    windows.forEach((w: any) => {
                                                        // Exclude the current window being edited
                                                        if (w.window_id.toString() === windowId) return;
                                                        if (w.day_of_week !== editForm.day_of_week) return;

                                                        const existStart = parseT(w.start_time);
                                                        const existEnd = parseT(w.end_time);

                                                        if (newStart < existEnd && newEnd > existStart) {
                                                            const progs = w.programs || w.program_schedule?.map((ps: any) => ps.program) || [];
                                                            progs.forEach((p: any) => busyProgramMap.set(p.program_id, w));
                                                        }
                                                    });
                                                }

                                                return programs?.map((prog: any) => {
                                                    const conflictWindow = busyProgramMap.get(prog.program_id);
                                                    const isBusy = !!conflictWindow;
                                                    const isSelected = editForm.program_ids.includes(prog.program_id);

                                                    return (
                                                        <div
                                                            key={prog.program_id}
                                                            onClick={() => !isBusy && toggleProgram(prog.program_id)}
                                                            className={`px-3 py-2.5 text-sm flex justify-between items-center transition-colors ${isBusy ? 'bg-slate-800/50 opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-800'} ${isSelected ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300'}`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center">
                                                                    <span className="font-medium mr-1">{prog.program_name}</span>
                                                                    {prog.batch?.batch_name && <span className="text-slate-500 text-xs">({prog.batch.batch_name})</span>}
                                                                </div>
                                                                <span className="text-[10px] text-slate-500">
                                                                    {prog.student_count || 0} active students
                                                                    {isBusy && <span className="text-red-400 font-bold ml-1"> (Busy in {conflictWindow?.room?.room_name || conflictWindow?.window_name || 'another room'})</span>}
                                                                </span>
                                                            </div>
                                                            {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            Programs busy in other rooms are disabled.
                                        </p>

                                        <button
                                            type="submit"
                                            disabled={isOverCapacity || updateMutation.isPending}
                                            className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-transparent flex justify-center items-center gap-2"
                                        >
                                            <Save size={18} /> {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                );
                            })()}
                        </form>
                    </div>
                </div>
            )}

            {/* ATTACHED PROGRAMS & PAYMENT ACTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Programs List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users size={20} className="text-emerald-500" /> Attached Programs
                        </h3>
                        <button
                            onClick={() => setIsAddStudentOpen(!isAddStudentOpen)}
                            className="text-sm bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Plus size={16} /> Enroll Student
                        </button>
                    </div>

                    {/* ENROLL FORM */}
                    {isAddStudentOpen && (
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h4 className="text-sm font-bold text-slate-300 mb-2">Enroll Student into Program</h4>
                            <div className="flex flex-col gap-3">
                                <select
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedProgramForEnroll}
                                    onChange={e => setSelectedProgramForEnroll(e.target.value)}
                                >
                                    <option value="" className="bg-slate-900">Select Program...</option>
                                    {attachedPrograms.map((p: any) => (
                                        <option key={p.program_id} value={p.program_id} className="bg-slate-900">{p.program_name}</option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search student name to enroll..."
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 p-2 text-white outline-none focus:border-blue-500"
                                        value={enrollSearch}
                                        onChange={e => setEnrollSearch(e.target.value)}
                                    />
                                    {searchResults && searchResults.length > 0 && (
                                        <div className="absolute top-12 left-0 right-0 bg-slate-800 border border-slate-700 shadow-xl rounded-lg z-10 max-h-48 overflow-y-auto">
                                            {searchResults.map((s: any) => (
                                                <button
                                                    key={s.student_id}
                                                    onClick={() => {
                                                        if (!selectedProgramForEnroll) return alert("Select a program first");
                                                        if (confirm(`Enroll ${s.name} into selected program?`)) {
                                                            enrollMutation.mutate({ student_id: s.student_id, program_id: parseInt(selectedProgramForEnroll) });
                                                        }
                                                    }}
                                                    className="w-full text-left p-2 hover:bg-slate-700 text-slate-300 border-b border-slate-700 last:border-0"
                                                >
                                                    {s.name} <span className="text-xs text-slate-500 ml-2">ID: {s.student_code || s.student_id}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4">
                        {attachedPrograms.length === 0 && <p className="text-slate-500 italic">No programs attached to this window.</p>}
                        {attachedPrograms.map((p: any) => (
                            <div key={p.program_id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-sm hover:border-slate-600 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <Link to={`/programs/${p.program_id}`} className="text-lg font-bold text-blue-400 hover:text-blue-300 hover:underline">
                                            {p.program_name}
                                        </Link>
                                        <p className="text-sm text-slate-400">{p.batch?.batch_name || 'No Batch'}</p>
                                    </div>
                                    <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-1 rounded border border-emerald-500/20">
                                        {p.active_students || p.student_count || 0} Students
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* STUDENTS LIST */}
                    <div className="mt-8 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Users size={20} className="text-blue-500" /> Enrolled Students
                            </h3>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search by Name or ID..."
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 p-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {filteredStudents.length > 0 ? (
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left font-mono text-sm min-w-[500px]">
                                        <thead className="bg-slate-800 border-b border-slate-700 text-slate-300">
                                            <tr>
                                                <th className="p-3">Student ID</th>
                                                <th className="p-3 font-sans">Name</th>
                                                <th className="p-3 font-sans">Institution Name</th>
                                                <th className="p-3">Contact</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.map((student: any) => (
                                                <tr key={`${student.student_id}-${student.program_name}`} className="border-b border-slate-700 last:border-0 hover:bg-slate-700/50 transition-colors">
                                                    <td className="p-3 text-blue-400">{student.student_code || student.student_id}</td>
                                                    <td className="p-3 text-white font-sans font-medium">
                                                        <Link to={`/students/${student.student_id}`} className="hover:text-blue-300 transition-colors">
                                                            {student.name}
                                                        </Link>
                                                    </td>
                                                    <td className="p-3 text-slate-400 font-sans">{student.school || '-'}</td>
                                                    <td className="p-3 text-slate-400">{student.contact ? String(student.contact).replace(/\.0$/, '') : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
                                {windowData.students?.length === 0
                                    ? "No students are currently enrolled in any of the attached programs."
                                    : "No students matching your search criteria."}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions Card */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 border border-blue-500/30 p-6 rounded-2xl shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <DollarSign className="text-blue-400" /> Quick Finance
                        </h3>
                        <p className="text-sm text-blue-200/70 mb-6">
                            Record payments for students in this schedule block efficiently.
                        </p>
                        <button
                            onClick={() => setIsBatchPaymentOpen(true)}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex justify-center items-center gap-2 border border-transparent"
                        >
                            <DollarSign size={20} /> Record Batch Payment
                        </button>
                        <p className="text-xs text-center text-blue-300/50 mt-3">
                            Opens bulk payment interface for attached programs.
                        </p>
                    </div>

                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl">
                        <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Window Stats</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                                <span className="text-slate-400">Duration</span>
                                <span className="text-white font-mono">
                                    {(() => {
                                        const start = new Date(`2000/01/01 ${windowData.start_time}`);
                                        const end = new Date(`2000/01/01 ${windowData.end_time}`);
                                        const diff = (end.getTime() - start.getTime()) / (1000 * 60);
                                        return `${diff} mins`;
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                                <span className="text-slate-400">Programs</span>
                                <span className="text-white font-mono">{attachedPrograms.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Capacity Load</span>
                                <span className="text-white font-mono">
                                    {/* Calculating load */}
                                    {(() => {
                                        const cap = windowData.room?.capacity || 0;
                                        // Use the actual number of enrolled students rather than program hypothetical counts
                                        const load = windowData?.students?.length || 0;
                                        const pct = cap ? Math.round((load / cap) * 100) : 0;
                                        return (
                                            <span className={pct > 100 ? 'text-red-400' : 'text-emerald-400'}>
                                                {load} / {cap || '∞'} ({pct}%)
                                            </span>
                                        );
                                    })()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BATCH PAYMENT MODAL */}
            <BatchPaymentModal
                isOpen={isBatchPaymentOpen}
                onClose={() => setIsBatchPaymentOpen(false)}
                allowedProgramIds={attachedPrograms.map((p: any) => p.program_id)}
            />
        </div>
    );
};

export default ScheduleDetails;
