import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScheduleRepository } from '../repositories/ScheduleRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { Clock, MapPin, Users, Edit, Save, ArrowLeft, Trash2, AlertCircle, X, DollarSign } from 'lucide-react';
import BatchPaymentModal from '../components/BatchPaymentModal';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ScheduleDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // FETCH DATA
    const { data: window, isLoading } = useQuery({
        queryKey: ['window', id],
        queryFn: () => ScheduleRepository.getWindowDetails(id!)
    });

    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: ScheduleRepository.getRooms });
    const { data: allPrograms } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms });
    const { data: allWindows } = useQuery({ queryKey: ['windows'], queryFn: ScheduleRepository.getAllWindows });

    // EDIT FORM STATE
    const [editData, setEditData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize edit data when window loads
    React.useEffect(() => {
        if (window) {
            setEditData({
                window_name: window.window_name || '',
                room_id: window.room_id,
                day_of_week: window.day_of_week,
                start_time: window.start_time,
                end_time: window.end_time,
                program_ids: window.program_schedule?.map((ps: any) => ps.program.program_id) || []
            });
        }
    }, [window]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => ScheduleRepository.updateWindow(id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['window', id] });
            setIsEditing(false);
            setError(null);
            alert("Schedule Updated!");
        },
        onError: (err: any) => setError(err.message || "Failed to update schedule.")
    });

    const deleteMutation = useMutation({
        mutationFn: () => ScheduleRepository.deleteWindow(parseInt(id!)),
        onSuccess: () => {
            navigate('/admin/scheduling');
        }
    });

    const handleSave = () => {
        updateMutation.mutate(editData);
    };

    const toggleProgram = (pid: number) => {
        setEditData((prev: any) => ({
            ...prev,
            program_ids: prev.program_ids.includes(pid)
                ? prev.program_ids.filter((id: number) => id !== pid)
                : [...prev.program_ids, pid]
        }));
    };

    if (isLoading || !window) return <div className="p-8">Loading details...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* HEADER */}
            <div className="flex items-center gap-4 text-gray-500 mb-4">
                <Link to="/admin/scheduling" className="hover:text-gray-900 flex items-center gap-1">
                    <ArrowLeft size={16} /> Back to Master Schedule
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b bg-gray-50 flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Clock className="text-blue-600" />
                            {isEditing ? 'Edit Schedule Window' : (window.window_name || `${window.day_of_week}, ${window.start_time.substring(0, 5)} - ${window.end_time.substring(0, 5)}`)}
                        </h1>
                        <p className="text-gray-500 mt-1 flex items-center gap-2">
                            <MapPin size={16} /> {rooms?.find((r: any) => r.room_id === window.room_id)?.room_name || 'Room TBD'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <>
                                <button
                                    onClick={() => setShowPaymentModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 font-medium text-green-700"
                                >
                                    <DollarSign size={16} /> Record Payment
                                </button>
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 font-medium text-gray-700">
                                    <Edit size={16} /> Edit Details
                                </button>
                                <button
                                    onClick={() => { if (confirm('Are you sure you want to delete this time slot?')) deleteMutation.mutate() }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 font-medium text-red-600">
                                    <Trash2 size={16} /> Delete
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                {(() => {
                                    const selectedRoom = rooms?.find((r: any) => r.room_id.toString() === editData?.room_id?.toString());
                                    const capacity = selectedRoom?.capacity || 0;
                                    const selectedPrograms = allPrograms?.filter((p: any) => editData?.program_ids?.includes(p.program_id)) || [];
                                    const totalStudents = selectedPrograms.reduce((sum: number, p: any) => sum + (p.student_count || 0), 0);
                                    const isOverCapacity = capacity > 0 && totalStudents > capacity;

                                    return (
                                        <button
                                            onClick={handleSave}
                                            disabled={isOverCapacity || updateMutation.isPending}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Save size={16} /> Save Changes
                                        </button>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                </div>

                {/* EDIT FORM */}
                {isEditing && (
                    <div className="p-6 bg-blue-50/50 border-b space-y-6 animate-in fade-in slide-in-from-top-4 duration-200">
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm">
                                <div className="flex items-start">
                                    <AlertCircle className="text-red-500 mr-2 mt-0.5 flex-shrink-0" size={18} />
                                    <div>
                                        <p className="text-sm text-red-700 font-bold">Validation Error</p>
                                        <p className="text-xs text-red-600 mt-1">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Subject / Name</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded p-2 bg-white"
                                        placeholder="e.g. Physics Lab, Weekly Meeting"
                                        value={editData.window_name}
                                        onChange={e => setEditData({ ...editData, window_name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Start Time</label>
                                        <input
                                            type="time"
                                            className="w-full border rounded p-2 bg-white"
                                            value={editData.start_time}
                                            onChange={e => setEditData({ ...editData, start_time: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">End Time</label>
                                        <input
                                            type="time"
                                            className="w-full border rounded p-2 bg-white"
                                            value={editData.end_time}
                                            onChange={e => setEditData({ ...editData, end_time: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Day</label>
                                        <select
                                            className="w-full border rounded p-2 bg-white"
                                            value={editData.day_of_week}
                                            onChange={e => setEditData({ ...editData, day_of_week: e.target.value })}
                                        >
                                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Room</label>
                                        <select
                                            className="w-full border rounded p-2 bg-white"
                                            value={editData.room_id}
                                            onChange={e => setEditData({ ...editData, room_id: e.target.value })}
                                        >
                                            {rooms?.map((r: any) => (
                                                <option key={r.room_id} value={r.room_id}>
                                                    {r.room_name} (Cap: {r.capacity || '∞'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Assigned Programs</label>

                                {(() => {
                                    // Calculate Capacity for UI
                                    const selectedRoom = rooms?.find((r: any) => r.room_id.toString() === editData.room_id?.toString());
                                    const capacity = selectedRoom?.capacity || 0;
                                    const selectedPrograms = allPrograms?.filter((p: any) => editData.program_ids.includes(p.program_id)) || [];
                                    const totalStudents = selectedPrograms.reduce((sum: number, p: any) => sum + (p.student_count || 0), 0);
                                    const isOverCapacity = capacity > 0 && totalStudents > capacity;

                                    return (
                                        <>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs text-gray-500">Manage enrolled classes</span>
                                                {editData.room_id && (
                                                    <span className={`text-xs font-bold px-2 py-1 rounded ${isOverCapacity ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                        {totalStudents} / {capacity || '∞'} Students
                                                    </span>
                                                )}
                                            </div>

                                            {isOverCapacity && (
                                                <div className="mb-2 text-xs text-red-600 font-bold flex items-center bg-red-50 p-2 rounded border border-red-200 animate-pulse">
                                                    <AlertCircle size={14} className="mr-2" />
                                                    Capacity Exceeded!
                                                </div>
                                            )}

                                            {/* Selected Programs List */}
                                            <div className="bg-white border rounded-lg p-2 min-h-[100px] max-h-[150px] overflow-y-auto space-y-1 mb-2">
                                                {editData.program_ids.length === 0 && <p className="text-gray-400 text-xs italic p-2">No programs assigned.</p>}
                                                {editData.program_ids.map((pid: number) => {
                                                    const prog = allPrograms?.find((p: any) => p.program_id === pid);
                                                    return (
                                                        <div key={pid} className="flex justify-between items-center bg-blue-50 text-blue-800 px-3 py-1.5 rounded text-sm group hover:bg-blue-100 transition-colors">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{prog?.program_name || `Program ${pid}`}</span>
                                                                <span className="text-[10px] text-blue-600/70">{prog?.student_count || 0} students</span>
                                                            </div>
                                                            <button onClick={() => toggleProgram(pid)} className="text-blue-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    );
                                })()}

                                {/* Add Program Dropdown */}
                                <div className="relative">
                                    {(() => {
                                        // Dynamic Busy Calculation
                                        const busyMap = new Map<number, string>();
                                        if (allWindows && editData.day_of_week && editData.start_time && editData.end_time) {
                                            const parseT = (t: string) => parseInt(t.replace(/:/g, '').substring(0, 4));
                                            const newStart = parseT(editData.start_time);
                                            const newEnd = parseT(editData.end_time);

                                            // eslint-disable-next-line array-callback-return
                                            allWindows.forEach((w: any) => {
                                                if (w.window_id === parseInt(id!)) return; // Exclude current window
                                                if (w.day_of_week !== editData.day_of_week) return;

                                                const wStart = parseT(w.start_time);
                                                const wEnd = parseT(w.end_time);

                                                if (newStart < wEnd && newEnd > wStart) {
                                                    const progs = w.programs || w.program_schedule?.map((ps: any) => ps.program) || [];
                                                    progs.forEach((p: any) => {
                                                        const roomName = w.room?.room_name || w.room_name || 'another room';
                                                        busyMap.set(p.program_id, roomName);
                                                    });
                                                }
                                            });
                                        }

                                        return (
                                            <select
                                                className="w-full border rounded p-2 bg-white text-sm"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        toggleProgram(parseInt(e.target.value));
                                                        e.target.value = ''; // Reset
                                                    }
                                                }}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>+ Add Program...</option>
                                                {allPrograms?.filter((p: any) => !editData.program_ids.includes(p.program_id)).map((p: any) => {
                                                    const busyRoom = busyMap.get(p.program_id);
                                                    return (
                                                        <option key={p.program_id} value={p.program_id} disabled={!!busyRoom} className={busyRoom ? "text-gray-400 bg-gray-50" : ""}>
                                                            {p.program_name} {p.batch?.batch_name ? `(${p.batch.batch_name})` : ''} ({p.student_count || 0} students)
                                                            {busyRoom ? ` (Busy in ${busyRoom})` : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ASSIGNED PROGRAMS LIST (READ ONLY) */}
                <div className="px-6 pt-6">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Assigned Classes</h3>
                    <div className="flex flex-wrap gap-2">
                        {window.program_schedule?.map((ps: any) => (
                            <Link
                                key={ps.program.program_id}
                                to={`/programs/${ps.program.program_id}`}
                                className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-100 text-sm font-medium hover:bg-blue-100 transition-colors flex items-center gap-1"
                            >
                                {ps.program.program_name}
                            </Link>
                        ))}
                        {(!window.program_schedule || window.program_schedule.length === 0) && (
                            <span className="text-gray-400 italic text-sm">No programs assigned.</span>
                        )}
                    </div>
                </div>

                {/* STUDENTS LIST */}
                <div className="p-6">
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Users size={20} className="text-gray-400" />
                            Students List
                        </h3>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-blue-600">{window.students?.length || 0}</p>
                            <p className="text-xs text-gray-500 uppercase font-semibold">Total Students</p>
                        </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-left bg-white">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b">
                                <tr>
                                    <th className="p-3">Student Name</th>
                                    <th className="p-3">Roll No</th>
                                    <th className="p-3">Program</th>
                                    <th className="p-3">Contact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {window.students?.map((s: any) => (
                                    <tr key={s.student_id} className="hover:bg-gray-50 group">
                                        <td className="p-3 font-medium text-gray-900">
                                            <Link to={`/students/${s.student_id}`} className="hover:text-blue-600 hover:underline">
                                                {s.name}
                                            </Link>
                                        </td>
                                        <td className="p-3 text-gray-600 font-mono text-sm">{s.roll_no}</td>
                                        <td className="p-3">
                                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">
                                                {s.program_name}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-500 text-sm">{s.contact || '-'}</td>
                                    </tr>
                                ))}
                                {(!window.students || window.students.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                                            No students assigned to this time slot yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Batch Payment Modal */}
            {window && (
                <BatchPaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    allowedProgramIds={window.program_schedule?.map((ps: any) => ps.program.program_id) || []}
                />
            )}
        </div>
    );
};

export default ScheduleDetails;
