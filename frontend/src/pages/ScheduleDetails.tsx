import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScheduleRepository } from '../repositories/ScheduleRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import {
    ArrowLeft, Clock, MapPin, Users, Edit2, Save, X, Plus, Trash2,
    DollarSign, Search
} from 'lucide-react';
import BatchPaymentModal from '../components/BatchPaymentModal';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ScheduleDetails: React.FC = () => {
    const { id: windowId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

    // BATCH PAYMENT STATE
    const [isBatchPaymentOpen, setIsBatchPaymentOpen] = useState(false);

    // FETCH WINDOW DETAILS
    const { data: windowData, isLoading, error } = useQuery({
        queryKey: ['window', windowId],
        queryFn: () => ScheduleRepository.getWindowDetails(windowId || ''),
        enabled: !!windowId
    });

    // EDIT FORM STATE
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
                program_ids: windowData.programs?.map((p: any) => p.program_id) || windowData.program_schedule?.map((ps: any) => ps.program_id) || []
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
            alert("Schedule updated!");
        },
        onError: (err: any) => alert(err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: ScheduleRepository.deleteWindow,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['windows'] });
            navigate('/admin/scheduling');
        }
    });

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


    if (isLoading) return <div className="p-8 text-white">Loading schedule details...</div>;
    if (error || !windowData) return <div className="p-8 text-red-500">Error loading schedule.</div>;

    const attachedPrograms = windowData.programs || windowData.program_schedule?.map((ps: any) => ps.program) || [];

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
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border ${isEditing ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                    >
                        {isEditing ? <X size={18} /> : <Edit2 size={18} />}
                        {isEditing ? 'Cancel Edit' : 'Edit Details'}
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

            {/* EDIT FORM */}
            {isEditing && (
                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 animate-in slide-in-from-top-4">
                    <h3 className="font-bold text-lg text-white mb-4">Edit Schedule Window</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Name (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={editForm.window_name}
                                onChange={e => setEditForm({ ...editForm, window_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Room</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={editForm.room_id}
                                placeholder="Room ID"
                                onChange={e => setEditForm({ ...editForm, room_id: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2 md:col-span-2">
                            <select
                                className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none"
                                value={editForm.day_of_week}
                                onChange={e => setEditForm({ ...editForm, day_of_week: e.target.value })}
                            >
                                {DAYS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                            </select>
                            <input
                                type="time"
                                className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none date-input-dark"
                                value={editForm.start_time}
                                onChange={e => setEditForm({ ...editForm, start_time: e.target.value })}
                            />
                            <input
                                type="time"
                                className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none date-input-dark"
                                value={editForm.end_time}
                                onChange={e => setEditForm({ ...editForm, end_time: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={() => updateMutation.mutate(editForm)}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-500 font-bold flex items-center gap-2"
                        >
                            <Save size={18} /> Save Changes
                        </button>
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
                                        <Link to={`/admin/programs/${p.program_id}`} className="text-lg font-bold text-blue-400 hover:text-blue-300 hover:underline">
                                            {p.program_name}
                                        </Link>
                                        <p className="text-sm text-slate-400">{p.batch?.batch_name || 'No Batch'}</p>
                                    </div>
                                    <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-1 rounded border border-emerald-500/20">
                                        {p.active_students || p.student_count || 0} Students
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            // Open Batch Payment for THIS program if we want specific program targeting
                                            // For now just view students
                                        }}
                                        className="text-xs flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded transition-colors"
                                    >
                                        <Users size={14} /> View Students
                                    </button>
                                </div>
                            </div>
                        ))}
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
                                        const load = attachedPrograms.reduce((s: number, p: any) => s + (p.student_count || 0), 0);
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
