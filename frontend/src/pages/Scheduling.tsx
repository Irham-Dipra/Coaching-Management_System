import React, { useState, useEffect } from 'react';
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
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="text-blue-600" /> Class Scheduling
            </h1>

            {/* TABS */}
            <div className="flex border-b">
                <button
                    onClick={() => setActiveTab('rooms')}
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'rooms' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Room Manager
                </button>
                <button
                    onClick={() => setActiveTab('schedule')}
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Master Schedule
                </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[500px]">
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
            <h3 className="text-lg font-bold text-gray-800 mb-4">Physical Classrooms</h3>

            {/* ADD FORM */}
            <div className="flex gap-4 mb-8 items-end bg-gray-50 p-4 rounded-lg">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Room Name</label>
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={e => setNewRoomName(e.target.value)}
                        placeholder="e.g. Mars, Room 101"
                        className="w-full p-2 border rounded"
                    />
                </div>
                <div className="w-32">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Capacity</label>
                    <input
                        type="number"
                        value={newCapacity}
                        onChange={e => setNewCapacity(e.target.value)}
                        placeholder="Opt."
                        className="w-full p-2 border rounded"
                    />
                </div>
                <button
                    onClick={() => createMutation.mutate()}
                    disabled={!newRoomName}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                    Add Room
                </button>
            </div>

            {/* LIST */}
            <div className="grid gap-3">
                {rooms.map(room => (
                    <div key={room.room_id} className="flex justify-between items-center p-4 border rounded hover:bg-gray-50 bg-white group">
                        <Link to={`/admin/scheduling/rooms/${room.room_id}`} className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{room.room_name}</p>
                                {room.capacity && <p className="text-xs text-gray-500">Capacity: {room.capacity} students</p>}
                            </div>
                        </Link>
                        <button
                            onClick={(e) => {
                                e.preventDefault(); // Prevent navigation
                                if (confirm('Delete room?')) deleteMutation.mutate(room.room_id)
                            }}
                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
                {rooms.length === 0 && <p className="text-gray-400 italic text-center p-4">No rooms added yet.</p>}
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
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        List View
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Grid View (Occupancy)
                    </button>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-transform hover:scale-105 active:scale-95"
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

                        // We show the day header even if empty? User said "If a specific day has no scheduled windows, show a 'No classes scheduled' placeholder."
                        // Current map returns null if empty. Let's change this.

                        return (
                            <div key={day} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col h-full">
                                <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800">{day}</h3>
                                    <span className="text-xs font-semibold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                                        {dayWindows?.length || 0} Slots
                                    </span>
                                </div>
                                <div className="divide-y divide-gray-100 flex-1">
                                    {(!dayWindows || dayWindows.length === 0) ? (
                                        <div className="p-8 text-center text-gray-400 italic text-sm">No classes scheduled</div>
                                    ) : (
                                        dayWindows.map((w: any) => {
                                            // Handling Data Structure Compatibility (View vs Join)
                                            const displayPrograms = w.programs || w.program_schedule?.map((ps: any) => ps.program) || [];

                                            return (
                                                <div key={w.window_id} className="relative group">
                                                    <Link to={`/admin/scheduling/${w.window_id}`} className="block p-4 hover:bg-gray-50 flex justify-between items-start transition-colors">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Clock size={16} className="text-blue-500" />
                                                                <span className="font-mono font-bold text-lg text-gray-900">
                                                                    {formatTime(w.start_time)} - {formatTime(w.end_time)}
                                                                </span>
                                                                {w.window_name && (
                                                                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded border border-yellow-200">
                                                                        {w.window_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-2">
                                                                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                                                    <MapPin size={12} /> {w.room?.room_name || w.room_name || 'No Room'}
                                                                </span>

                                                                {/* Student Count Badge */}
                                                                <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200" title="Active Students Enrolled">
                                                                    <span className="font-bold">{w.student_count || 0}</span> Students
                                                                </span>

                                                                {/* Assigned Programs */}
                                                                {displayPrograms.map((p: any) => (
                                                                    <span key={p.program_id} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs border border-purple-200">
                                                                        {p.program_name}
                                                                    </span>
                                                                ))}

                                                                {displayPrograms.length === 0 && (
                                                                    <span className="text-xs italic text-orange-400 flex items-center gap-1">
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
                                                        className="absolute top-4 right-4 text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors z-10"
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
                <div className="bg-white rounded-xl border shadow-sm p-6 overflow-x-auto">
                    <div className="flex items-center gap-4 mb-6">
                        <label className="font-bold text-gray-700">Select Day:</label>
                        <select
                            value={gridDay}
                            onChange={(e) => setGridDay(e.target.value)}
                            className="border rounded-md px-3 py-1.5 font-medium text-gray-800"
                        >
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    <table className="min-w-full text-center border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 border bg-gray-50 text-xs uppercase text-gray-500 w-24">Time</th>
                                {rooms?.map((r: any) => (
                                    <th key={r.room_id} className="p-3 border bg-gray-50 text-xs uppercase text-gray-700">
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
                                        <th className="p-3 border bg-gray-50 text-xs font-mono text-gray-500 whitespace-nowrap">{timeLabel}</th>
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
                                                // If class is 8:30-9:30, it occupies 8 and 9 slots? 
                                                // Simplified: If starts in this hour or runs through it.
                                                // Current logic: occupies [startH, endH).
                                                return hour >= startH && hour < endH;
                                            });

                                            return (
                                                <td key={r.room_id} className={`border p-1 h-20 relative align-top transition-colors ${occupied ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                                                    {slot && (
                                                        <div className="absolute inset-x-1 top-1 bottom-1 bg-blue-100 border-l-4 border-blue-500 rounded p-1.5 text-left overflow-y-auto shadow-sm z-10 hover:shadow-md group">
                                                            <div className="font-bold text-xs text-blue-900 mb-0.5 leading-tight">
                                                                {slot.window_name || 'Class'}
                                                            </div>
                                                            <div className="text-[10px] text-blue-700 font-medium mb-1">
                                                                {(() => {
                                                                    // Format time range: 14:00:00 -> 2:00 PM
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
                                                            <div className="text-[10px] text-blue-800 leading-tight">
                                                                {/* Handle flat programs or nested */}
                                                                {(() => {
                                                                    const progs = slot.programs || slot.program_schedule?.map((ps: any) => ps.program) || [];
                                                                    if (progs.length === 0) return <span className="text-gray-400 italic">Unassigned</span>;
                                                                    return progs.map((p: any) => p.program_name).join(', ');
                                                                })()}
                                                            </div>
                                                            {/* Student Count Badge */}
                                                            {slot.student_count !== undefined && (
                                                                <div className="mt-1 flex justify-end">
                                                                    <span className="text-[9px] bg-white/60 px-1.5 py-0.5 rounded text-blue-800 font-bold border border-blue-200">
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">Add New Time Slot</h3>
                            <button onClick={() => { setIsCreateOpen(false); setCreateError(null); }} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {createError && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm animate-pulse">
                                    <div className="flex items-start">
                                        <AlertCircle className="text-red-500 mr-2 mt-0.5 flex-shrink-0" size={18} />
                                        <div>
                                            <p className="text-sm text-red-700 font-bold">Validation Error</p>
                                            <p className="text-xs text-red-600 mt-1">{createError}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Window Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject / Window Name <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2"
                                    placeholder="e.g. Morning Assembly, Biology 101"
                                    value={formData.window_name}
                                    onChange={e => setFormData({ ...formData, window_name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                    value={formData.room_id}
                                    onChange={e => setFormData({ ...formData, room_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select Room...</option>
                                    {rooms?.map((r: any) => (
                                        <option key={r.room_id} value={r.room_id}>
                                            {r.room_name} (Cap: {r.capacity || '∞'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                                    <select
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={formData.day_of_week}
                                        onChange={e => setFormData({ ...formData, day_of_week: e.target.value })}
                                    >
                                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                                    <input
                                        type="time"
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={formData.start_time}
                                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                                    <input
                                        type="time"
                                        className="w-full border rounded-lg px-3 py-2"
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
                                            <label className="block text-sm font-medium text-gray-700">Assign Programs (Optional)</label>
                                            {formData.room_id && (
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${isOverCapacity ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {totalStudents} / {capacity || '∞'} Students
                                                </span>
                                            )}
                                        </div>

                                        {isOverCapacity && (
                                            <div className="mb-3 text-xs text-red-600 font-bold flex items-center bg-red-50 p-2 rounded border border-red-200 animate-pulse">
                                                <AlertCircle size={14} className="mr-2" />
                                                Capacity Exceeded! Room can't fit active students.
                                            </div>
                                        )}

                                        <div className="border rounded-lg max-h-48 overflow-y-auto divide-y bg-gray-50/50">
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
                                                            className={`px-3 py-2.5 text-sm flex justify-between items-center transition-colors ${isBusy ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white'} ${isSelected ? 'bg-blue-50 text-blue-800' : ''}`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center">
                                                                    <span className="font-medium mr-1">{prog.program_name}</span>
                                                                    {prog.batch?.batch_name && <span className="text-gray-500 text-xs">({prog.batch.batch_name})</span>}
                                                                </div>
                                                                <span className="text-[10px] text-gray-500">
                                                                    {prog.student_count || 0} active students
                                                                    {isBusy && <span className="text-red-500 font-bold ml-1"> (Busy in {conflictWindow?.room?.room_name || 'another room'})</span>}
                                                                </span>
                                                            </div>
                                                            {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            Programs busy in other rooms are disabled.
                                        </p>

                                        <button
                                            type="submit"
                                            disabled={isOverCapacity || createMutation.isPending}
                                            className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
