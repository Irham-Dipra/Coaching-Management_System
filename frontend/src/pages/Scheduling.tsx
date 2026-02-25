import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScheduleRepository, type Room, type ScheduleWindow } from '../repositories/ScheduleRepository';
import { Trash2, Plus, Calendar, MapPin, AlertCircle, Clock } from 'lucide-react';
import { ProgramRepository } from '../repositories/ProgramRepository';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const Scheduling: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'rooms' | 'schedule'>('schedule');

    // --- QUERIES ---
    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: ScheduleRepository.getRooms });
    const { data: windows } = useQuery({ queryKey: ['windows'], queryFn: ScheduleRepository.getAllWindows });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Calendar className="text-blue-500" size={32} /> Class Scheduling
            </h1>

            {/* TABS */}
            <div className="flex border-b border-slate-700">
                <button
                    onClick={() => setActiveTab('rooms')}
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'rooms' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
                >
                    Room Manager
                </button>
                <button
                    onClick={() => setActiveTab('schedule')}
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'schedule' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
                >
                    Master Schedule
                </button>
            </div>

            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-6 min-h-[500px]">
                {activeTab === 'rooms' ? (
                    <RoomManager rooms={rooms || []} />
                ) : (
                    <MasterSchedule
                        rooms={rooms || []}
                        windows={windows || []}
                    />
                )}
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: ROOM MANAGER ---
const RoomManager: React.FC<{ rooms: Room[] }> = ({ rooms }) => {
    const queryClient = useQueryClient();
    const [newRoomName, setNewRoomName] = useState('');
    const [newCapacity, setNewCapacity] = useState('');

    const createMutation = useMutation({
        mutationFn: () => ScheduleRepository.createRoom(newRoomName, newCapacity ? parseInt(newCapacity) : undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            setNewRoomName('');
            setNewCapacity('');
        },
        onError: (err) => alert(err)
    });

    const deleteMutation = useMutation({
        mutationFn: ScheduleRepository.deleteRoom,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        onError: (err) => alert(err)
    });

    return (
        <div className="max-w-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Physical Classrooms</h3>

            {/* ADD FORM */}
            <div className="flex gap-4 mb-8 items-end bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 mb-1">Room Name</label>
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={e => setNewRoomName(e.target.value)}
                        placeholder="e.g. Mars, Room 101"
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="w-32">
                    <label className="block text-xs font-bold text-slate-400 mb-1">Capacity</label>
                    <input
                        type="number"
                        value={newCapacity}
                        onChange={e => setNewCapacity(e.target.value)}
                        placeholder="Opt."
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newRoomName}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 disabled:opacity-50 font-medium transition-colors"
                >
                    Add Room
                </button>
            </div>

            {/* LIST */}
            <div className="grid gap-3">
                {rooms.map(room => (
                    <div key={room.room_id} className="flex justify-between items-center p-4 border border-slate-700 rounded-xl hover:bg-slate-700/30 bg-slate-800/50 transition-colors group">
                        <Link to={`/admin/scheduling/rooms/${room.room_id}`} className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-slate-700 text-blue-400 rounded-full flex items-center justify-center group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors">{room.room_name}</p>
                                {room.capacity && <p className="text-xs text-slate-500">Capacity: {room.capacity} students</p>}
                            </div>
                        </Link>
                        <button
                            onClick={(e) => {
                                e.preventDefault(); // Prevent navigation
                                if (confirm('Delete room?')) deleteMutation.mutate(room.room_id)
                            }}
                            className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
                {rooms.length === 0 && <p className="text-slate-500 italic text-center p-4">No rooms added yet.</p>}
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: MASTER SCHEDULE ---

// Helper for 12-hour format
const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
};

const MasterSchedule: React.FC<{
    rooms: Room[];
    windows: ScheduleWindow[];
}> = ({ rooms, windows }) => {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // FETCH DATA - Programs only (rooms/windows passed via props)
    const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms });

    // FORM STATE
    const [formData, setFormData] = useState({
        room_id: '',
        day_of_week: 'Saturday',
        start_time: '',
        end_time: '',
        window_name: '', // New Field
        program_ids: [] as number[]
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => ScheduleRepository.createWindow({
            ...data,
            room_id: parseInt(data.room_id)
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['windows'] });
            setIsCreateOpen(false);
            setCreateError(null);
            setFormData({ room_id: '', day_of_week: 'Saturday', start_time: '', end_time: '', window_name: '', program_ids: [] });
            alert("Time Slot Created!");
        },
        onError: (err: any) => setCreateError(err.message || 'Failed to create time slot.')
    });

    const deleteMutation = useMutation({
        mutationFn: ScheduleRepository.deleteWindow,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['windows'] })
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);
        createMutation.mutate(formData);
    };

    const toggleProgram = (pid: number) => {
        setFormData(prev => {
            const current = prev.program_ids;
            return {
                ...prev,
                program_ids: current.includes(pid)
                    ? current.filter(id => id !== pid)
                    : [...current, pid]
            };
        });
    };

    // --- GRID VIEW HELPERS ---
    const timeSlots = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM
    const [gridDay, setGridDay] = useState('Saturday');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
                <div className="flex gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-slate-700 shadow text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        List View
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'grid' ? 'bg-slate-700 shadow text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Grid View (Occupancy)
                    </button>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 font-medium shadow-sm transition-transform hover:scale-105 active:scale-95 border border-transparent"
                >
                    <Plus size={18} /> Add Time Slot
                </button>
            </div>

            {/* LIST VIEW */}
            {viewMode === 'list' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {DAYS.map(day => {
                        const dayWindows = windows?.filter((w: any) => w.day_of_week === day)
                            .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

                        return (
                            <div key={day} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm flex flex-col h-full">
                                <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-200">{day}</h3>
                                    <span className="text-xs font-semibold bg-slate-700 text-slate-300 px-2 py-1 rounded-full border border-slate-600">
                                        {dayWindows?.length || 0} Slots
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-700/50 flex-1">
                                    {(!dayWindows || dayWindows.length === 0) ? (
                                        <div className="p-8 text-center text-slate-500 italic text-sm">No classes scheduled</div>
                                    ) : (
                                        dayWindows.map((w: any) => {
                                            // Handling Data Structure Compatibility (View vs Join)
                                            const displayPrograms = w.programs || w.program_schedule?.map((ps: any) => ps.program) || [];

                                            return (
                                                <div key={w.window_id} className="relative group">
                                                    <Link to={`/admin/scheduling/${w.window_id}`} className="block p-4 hover:bg-slate-700/30 flex justify-between items-start transition-colors">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Clock size={16} className="text-blue-500" />
                                                                <span className="font-mono font-bold text-lg text-white">
                                                                    {formatTime(w.start_time)} - {formatTime(w.end_time)}
                                                                </span>
                                                                {w.window_name && (
                                                                    <span className="ml-2 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs font-bold rounded border border-yellow-500/20">
                                                                        {w.window_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400 mt-2">
                                                                <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                                                                    <MapPin size={12} /> {w.room?.room_name || w.room_name || 'No Room'}
                                                                </span>

                                                                {/* Student Count Badge */}
                                                                <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20" title="Active Students Enrolled">
                                                                    <span className="font-bold">{w.student_count || 0}</span> Students
                                                                </span>

                                                                {/* Assigned Programs */}
                                                                {displayPrograms.map((p: any) => (
                                                                    <span key={p.program_id} className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded text-xs border border-purple-500/20">
                                                                        {p.program_name}
                                                                    </span>
                                                                ))}

                                                                {displayPrograms.length === 0 && (
                                                                    <span className="text-xs italic text-amber-500/80 flex items-center gap-1">
                                                                        <AlertCircle size={10} /> Unassigned
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (confirm('Delete schedule window?')) deleteMutation.mutate(w.window_id);
                                                        }}
                                                        className="absolute top-4 right-4 text-slate-600 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-full transition-colors z-10"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* GRID VIEW */}
            {viewMode === 'grid' && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-sm p-6 overflow-x-auto">
                    <div className="flex items-center gap-4 mb-6">
                        <label className="font-bold text-slate-300">Select Day:</label>
                        <select
                            value={gridDay}
                            onChange={(e) => setGridDay(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {DAYS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                        </select>
                    </div>

                    <table className="min-w-full text-center border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 border border-slate-700 bg-slate-900/50 text-xs uppercase text-slate-500 w-24">Time</th>
                                {rooms?.map((r: any) => (
                                    <th key={r.room_id} className="p-3 border border-slate-700 bg-slate-900/50 text-xs uppercase text-slate-300">
                                        {r.room_name} ({r.capacity || '-'})
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {timeSlots.map(hour => {
                                // 12-hour format label
                                const suffix = hour >= 12 ? "PM" : "AM";
                                const h12 = hour % 12 || 12; // 0 becomes 12
                                const timeLabel = `${h12}:00 ${suffix}`;

                                return (
                                    <tr key={hour}>
                                        <th className="p-3 border border-slate-700 bg-slate-900/30 text-xs font-mono text-slate-500 whitespace-nowrap">{timeLabel}</th>
                                        {rooms?.map((r: any) => {
                                            // Robust start time check using integer hour
                                            const slot = windows?.find((w: any) => {
                                                if (w.room_id !== r.room_id || w.day_of_week !== gridDay) return false;
                                                const startH = parseInt(w.start_time.split(':')[0]);
                                                return startH === hour;
                                            });

                                            // Check occupancy for background coloring
                                            const occupied = windows?.find((w: any) => {
                                                if (w.room_id !== r.room_id || w.day_of_week !== gridDay) return false;
                                                const startH = parseInt(w.start_time.split(':')[0]);
                                                const endH = parseInt(w.end_time.split(':')[0]);
                                                return hour >= startH && hour < endH;
                                            });

                                            return (
                                                <td key={r.room_id} className={`border border-slate-700 p-1 h-20 relative align-top transition-colors ${occupied ? 'bg-blue-500/10' : 'hover:bg-slate-700/30'}`}>
                                                    {slot && (
                                                        <div className="absolute inset-x-1 top-1 bottom-1 bg-blue-600/20 border-l-4 border-blue-500 rounded p-1.5 text-left overflow-y-auto shadow-sm z-10 hover:shadow-md hover:bg-blue-600/30 group transition-all">
                                                            <div className="font-bold text-xs text-blue-100 mb-0.5 leading-tight">
                                                                {slot.window_name || 'Class'}
                                                            </div>
                                                            <div className="text-[10px] text-blue-300 font-medium mb-1">
                                                                {(() => {
                                                                    const format = (t: string) => {
                                                                        const [h, m] = t.split(':');
                                                                        const hi = parseInt(h);
                                                                        const s = hi >= 12 ? 'PM' : 'AM';
                                                                        const h12 = hi % 12 || 12;
                                                                        return `${h12}:${m} ${s}`;
                                                                    };
                                                                    return `${format(slot.start_time)} - ${format(slot.end_time)}`;
                                                                })()}
                                                            </div>
                                                            <div className="text-[10px] text-blue-200 leading-tight">
                                                                {/* Handle flat programs or nested */}
                                                                {(() => {
                                                                    const progs = slot.programs || slot.program_schedule?.map((ps: any) => ps.program) || [];
                                                                    if (progs.length === 0) return <span className="text-slate-400 italic">Unassigned</span>;
                                                                    return progs.map((p: any) => p.program_name).join(', ');
                                                                })()}
                                                            </div>
                                                            {/* Student Count Badge */}
                                                            {slot.student_count !== undefined && (
                                                                <div className="mt-1 flex justify-end">
                                                                    <span className="text-[9px] bg-slate-900/60 px-1.5 py-0.5 rounded text-blue-200 font-bold border border-blue-500/30">
                                                                        {slot.student_count} 👥
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* CREATE MODAL */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-700 flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg text-white">Add New Time Slot</h3>
                            <button onClick={() => { setIsCreateOpen(false); setCreateError(null); }} className="text-slate-400 hover:text-slate-200">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            {createError && (
                                <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r shadow-sm animate-pulse">
                                    <div className="flex items-start">
                                        <AlertCircle className="text-red-500 mr-2 mt-0.5 flex-shrink-0" size={18} />
                                        <div>
                                            <p className="text-sm text-red-400 font-bold">Validation Error</p>
                                            <p className="text-xs text-red-300 mt-1">{createError}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Window Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Subject / Window Name <span className="text-slate-500 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. Morning Assembly, Biology 101"
                                    value={formData.window_name}
                                    onChange={e => setFormData({ ...formData, window_name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Room</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.room_id}
                                    onChange={e => setFormData({ ...formData, room_id: e.target.value })}
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
                                        value={formData.day_of_week}
                                        onChange={e => setFormData({ ...formData, day_of_week: e.target.value })}
                                    >
                                        {DAYS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Start</label>
                                    <input
                                        type="time" // Browser time input usually adapts to system theme, but might need custom CSS for icon
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none date-input-dark"
                                        value={formData.start_time}
                                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">End</label>
                                    <input
                                        type="time" // Browser time input usually adapts to system theme
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none date-input-dark"
                                        value={formData.end_time}
                                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Capacity and Program Assignment */}
                            {(() => {
                                // Calculate Capacity
                                const selectedRoom = rooms?.find((r: any) => r.room_id.toString() === formData.room_id.toString());
                                const capacity = selectedRoom?.capacity || 0;
                                const selectedPrograms = programs?.filter((p: any) => formData.program_ids.includes(p.program_id)) || [];
                                const totalStudents = selectedPrograms.reduce((sum: number, p: any) => sum + (p.student_count || 0), 0);
                                const isOverCapacity = capacity > 0 && totalStudents > capacity;

                                return (
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-medium text-slate-300">Assign Programs (Optional)</label>
                                            {formData.room_id && (
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
                                                if (windows && formData.day_of_week && formData.start_time && formData.end_time) {
                                                    const parseT = (t: string) => parseInt(t.replace(/:/g, '').substring(0, 4));

                                                    const newStart = parseT(formData.start_time);
                                                    const newEnd = parseT(formData.end_time);

                                                    // eslint-disable-next-line array-callback-return
                                                    windows.forEach((w: any) => {
                                                        if (w.day_of_week !== formData.day_of_week) return;
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
                                                    const isSelected = formData.program_ids.includes(prog.program_id);

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
                                                                    {isBusy && <span className="text-red-400 font-bold ml-1"> (Busy in {conflictWindow?.room?.room_name || 'another room'})</span>}
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
                                            disabled={isOverCapacity || createMutation.isPending}
                                            className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-transparent"
                                        >
                                            {createMutation.isPending ? 'Creating...' : 'Create Time Slot'}
                                        </button>
                                    </div>
                                );
                            })()}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Scheduling;
