import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScheduleRepository, type Room, type ScheduleWindow } from '../repositories/ScheduleRepository';
import { Trash2, Plus, Calendar, MapPin, AlertCircle, Clock } from 'lucide-react';
import { ProgramRepository } from '../repositories/ProgramRepository';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const Scheduling: React.FC = () => {
    const queryClient = useQueryClient();
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
                {activeTab === 'rooms' ? <RoomManager rooms={rooms || []} /> : <MasterSchedule rooms={rooms || []} windows={windows || []} />}
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
                    <div key={room.room_id} className="flex justify-between items-center p-4 border rounded hover:bg-gray-50 bg-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800">{room.room_name}</p>
                                {room.capacity && <p className="text-xs text-gray-500">Capacity: {room.capacity} students</p>}
                            </div>
                        </div>
                        <button
                            onClick={() => { if (confirm('Delete room?')) deleteMutation.mutate(room.room_id) }}
                            className="text-red-500 hover:bg-red-50 p-2 rounded"
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

const MasterSchedule: React.FC<{ rooms: Room[], windows: ScheduleWindow[] }> = ({ rooms, windows }) => {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // FETCH DATA - Programs only (rooms/windows passed via props)
    const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms });

    // FORM STATE
    const [formData, setFormData] = useState({
        room_id: '',
        day_of_week: 'Saturday',
        start_time: '',
        end_time: '',
        program_ids: [] as number[] // Multi-select
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => ScheduleRepository.createWindow({
            ...data,
            room_id: parseInt(data.room_id)
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['windows'] });
            setIsCreateOpen(false);
            setFormData({ room_id: '', day_of_week: 'Saturday', start_time: '', end_time: '', program_ids: [] });
            alert("Time Slot Created!");
        },
        onError: (err: any) => alert(err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: ScheduleRepository.deleteWindow,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['windows'] })
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
    const timeSlots = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM (20)
    // Let's use a separate state for Grid View Day Filter
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

                        if (!dayWindows || dayWindows.length === 0) return null;

                        return (
                            <div key={day} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800">{day}</h3>
                                    <span className="text-xs font-semibold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{dayWindows.length} Slots</span>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {dayWindows.map((w: any) => (
                                        <div key={w.window_id} className="relative group">
                                            <Link to={`/admin/scheduling/${w.window_id}`} className="block p-4 hover:bg-gray-50 flex justify-between items-start transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock size={16} className="text-blue-500" />
                                                        <span className="font-mono font-bold text-lg text-gray-900">
                                                            {w.start_time.substring(0, 5)} - {w.end_time.substring(0, 5)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                                        <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                                            <MapPin size={12} /> {w.room?.room_name || 'No Room'}
                                                        </span>
                                                        {/* Assigned Programs */}
                                                        {w.program_schedule?.map((ps: any) => (
                                                            <span key={ps.program.program_id} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs border border-purple-200">
                                                                {ps.program.program_name}
                                                            </span>
                                                        ))}
                                                        {(!w.program_schedule || w.program_schedule.length === 0) && (
                                                            <span className="text-xs italic text-orange-400 flex items-center gap-1">
                                                                <AlertCircle size={10} /> Unassigned
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault(); // Prevent Link click
                                                    if (confirm('Delete schedule window?')) deleteMutation.mutate(w.window_id);
                                                }}
                                                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors z-10"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
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
                                const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
                                return (
                                    <tr key={hour}>
                                        <th className="p-3 border bg-gray-50 text-xs font-mono text-gray-400">{timeLabel}</th>
                                        {rooms?.map((r: any) => {
                                            // Find window matching this room, day, and starting hour
                                            const slot = windows?.find((w: any) =>
                                                w.room_id === r.room_id &&
                                                w.day_of_week === gridDay &&
                                                w.start_time.startsWith(timeLabel)
                                            );

                                            // Check overlaps if slot starts earlier? 
                                            // Simple View: Only exact start matches. 
                                            // Advanced: Check if hour falls within range.

                                            const occupied = windows?.find((w: any) => {
                                                if (w.room_id !== r.room_id || w.day_of_week !== gridDay) return false;
                                                const startH = parseInt(w.start_time.split(':')[0]);
                                                const endH = parseInt(w.end_time.split(':')[0]);
                                                // If window is 10:00 - 12:00, it occupies 10 and 11.
                                                // Logic: hour >= startH && hour < endH
                                                return hour >= startH && hour < endH;
                                            });

                                            return (
                                                <td key={r.room_id} className={`border p-1 h-16 relative ${occupied ? 'bg-blue-50/50' : ''}`}>
                                                    {slot && (
                                                        <div className="absolute inset-1 bg-blue-100 border-l-4 border-blue-500 rounded p-1 text-left overflow-hidden shadow-sm z-10">
                                                            <div className="font-bold text-xs text-blue-900">
                                                                {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                                                            </div>
                                                            <div className="text-[10px] text-blue-700 truncate">
                                                                {slot.program_schedule?.map((p: any) => p.program.program_name).join(', ') || 'Unassigned'}
                                                            </div>
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
                            <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                                        <option key={r.room_id} value={r.room_id}>{r.room_name}</option>
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Programs (Optional)</label>
                                <div className="border rounded-lg max-h-40 overflow-y-auto divide-y">
                                    {programs?.map((prog: any) => (
                                        <div
                                            key={prog.program_id}
                                            onClick={() => toggleProgram(prog.program_id)}
                                            className={`px-3 py-2 text-sm cursor-pointer flex justify-between items-center ${formData.program_ids.includes(prog.program_id) ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50'}`}
                                        >
                                            <span>{prog.program_name} {prog.batch?.batch_name ? `(${prog.batch.batch_name})` : ''}</span>
                                            {formData.program_ids.includes(prog.program_id) && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Click to select multiple programs.</p>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                                Create Time Slot
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Scheduling;
