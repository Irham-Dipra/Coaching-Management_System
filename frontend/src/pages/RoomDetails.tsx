import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScheduleRepository, type ScheduleWindow } from '../repositories/ScheduleRepository';
import { ArrowLeft, Edit, Save, Calendar, MapPin, Grid, List as ListIcon, Users } from 'lucide-react';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Helper for 12-hour format
const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
        // Handle HH:MM:SS or HH:MM
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHour = hours % 12 || 12;
        return `${formattedHour}:${minutes} ${ampm}`;
    } catch (e) {
        return timeStr;
    }
};

const RoomDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editCapacity, setEditCapacity] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    // Fetch Room Details
    const { data: room, isLoading, error } = useQuery({
        queryKey: ['room', id],
        queryFn: () => ScheduleRepository.getRoomById(id!),
        enabled: !!id
    });

    // Fetch Schedules for THIS Room (Using Search API)
    const { data: schedules } = useQuery({
        queryKey: ['room-schedules', id],
        queryFn: () => ScheduleRepository.searchWindows({ room_id: Number(id) }),
        enabled: !!id
    });

    // Sync state
    React.useEffect(() => {
        if (room) {
            setEditName(room.room_name);
            setEditCapacity(room.capacity?.toString() || '');
        }
    }, [room]);

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: (data: { room_name: string; capacity?: number }) =>
            ScheduleRepository.updateRoom(id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['room', id] });
            setIsEditing(false);
        },
        onError: (err: any) => alert("Update failed: " + err.message)
    });

    const handleSave = () => {
        if (!editName.trim()) return;
        updateMutation.mutate({
            room_name: editName,
            capacity: editCapacity ? parseInt(editCapacity) : undefined
        });
    };

    if (isLoading) return <div className="p-8 text-slate-400">Loading details...</div>;
    if (error || !room) return <div className="p-8 text-red-500">Room not found.</div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-in fade-in duration-300">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4 text-slate-500">
                <Link to="/admin/scheduling" className="hover:text-white flex items-center gap-1 transition-colors">
                    <ArrowLeft size={16} /> Back to Scheduling
                </Link>
            </div>

            {/* Title & Actions */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20">
                        <MapPin size={24} />
                    </div>
                    <div>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    className="text-2xl font-bold text-white bg-slate-900 border-b-2 border-blue-500 outline-none w-48 px-2 py-1 rounded-t"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    autoFocus
                                    placeholder="Room Name"
                                />
                                <input
                                    type="number"
                                    className="text-lg text-slate-300 bg-slate-900 border-b-2 border-slate-600 outline-none w-24 px-2 py-1 rounded-t focus:border-blue-500"
                                    value={editCapacity}
                                    onChange={e => setEditCapacity(e.target.value)}
                                    placeholder="Cap."
                                />
                            </div>
                        ) : (
                            <div>
                                <h1 className="text-2xl font-bold text-white">{room.room_name}</h1>
                                <p className="text-slate-400 text-sm flex items-center gap-2">
                                    <Users size={14} className="text-emerald-400" /> Capacity: {room.capacity || 'Unlimited'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-500 shadow-lg shadow-blue-900/20 border border-blue-500/50 transition-all font-medium"
                        >
                            <Save size={18} /> Save Changes
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 text-slate-400 hover:text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 transition-all"
                    >
                        <Edit size={18} /> Edit Details
                    </button>
                )}
            </div>

            {/* Schedule Section */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Calendar size={20} className="text-purple-400" />
                        Room Schedule ({schedules?.length || 0})
                    </h2>

                    {/* View Toggle */}
                    <div className="bg-slate-800 p-1 rounded-lg flex gap-1 border border-slate-700">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-700 shadow-sm text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <ListIcon size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-700 shadow-sm text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Grid size={18} />
                        </button>
                    </div>
                </div>

                {viewMode === 'list' ? (
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="p-4 border-b border-slate-700">Day</th>
                                    <th className="p-4 border-b border-slate-700">Time</th>
                                    <th className="p-4 border-b border-slate-700">Program(s)</th>
                                    <th className="p-4 border-b border-slate-700 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {DAYS.map(day => {
                                    const daySchedules = schedules?.filter((s: any) => s.day_of_week === day)
                                        .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

                                    if (!daySchedules || daySchedules.length === 0) return null;

                                    return daySchedules.map((win: ScheduleWindow, index: number) => (
                                        <tr key={win.window_id} className="hover:bg-slate-800/50 group transition-colors">
                                            {index === 0 && (
                                                <td className="p-4 font-medium text-slate-200 align-top border-r border-slate-700 bg-slate-900/30" rowSpan={daySchedules.length}>
                                                    {day}
                                                </td>
                                            )}
                                            <td className="p-4 text-slate-400 font-mono text-sm border-b border-slate-700/50">
                                                {formatTime(win.start_time)} - {formatTime(win.end_time)}
                                            </td>
                                            <td className="p-4 border-b border-slate-700/50">
                                                <div className="flex flex-wrap gap-2">
                                                    {(win.programs || win.program_schedule?.map((ps: any) => ps.program))?.map((p: any) => (
                                                        <span key={p.program_id} className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-semibold border border-blue-500/20">
                                                            {p.program_name}
                                                        </span>
                                                    ))}
                                                    {(!win.programs && !win.program_schedule?.length) && (
                                                        <span className="text-slate-600 text-xs italic">No programs assigned</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right border-b border-slate-700/50">
                                                <Link
                                                    to={`/admin/scheduling/${win.window_id}`}
                                                    className="text-blue-400 hover:text-blue-300 text-sm font-medium hover:underline"
                                                >
                                                    View Details
                                                </Link>
                                            </td>
                                        </tr>
                                    ));
                                })}

                                {(!schedules || schedules.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500 italic">No classes scheduled in this room.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // GRID VIEW
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 overflow-x-auto custom-scrollbar">
                        <div className="grid grid-cols-8 min-w-[800px] border-b border-slate-700 bg-slate-900/50">
                            <div className="p-3 text-xs font-bold text-slate-400 uppercase">Day</div>
                            <div className="col-span-7 p-3 text-xs font-bold text-slate-400 uppercase text-center">Timeline</div>
                        </div>
                        {DAYS.map(day => {
                            const daySchedules = schedules?.filter((s: any) => s.day_of_week === day)
                                .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

                            return (
                                <div key={day} className="grid grid-cols-8 border-b border-slate-700/50 min-h-[80px]">
                                    <div className="p-4 font-bold text-slate-300 border-r border-slate-700 bg-slate-900/30 flex items-center justify-center">
                                        {day.substring(0, 3)}
                                    </div>
                                    <div className="col-span-7 p-2 relative flex items-center gap-2 flex-wrap">
                                        {daySchedules?.map((win: ScheduleWindow) => (
                                            <Link
                                                key={win.window_id}
                                                to={`/admin/scheduling/${win.window_id}`}
                                                className="flex-shrink-0 bg-blue-900/30 border border-blue-500/30 text-blue-300 p-2 rounded-lg text-xs hover:shadow-lg hover:bg-blue-900/50 hover:border-blue-500/50 transition-all cursor-pointer min-w-[120px]"
                                            >
                                                <div className="font-bold mb-1 text-blue-200">{formatTime(win.start_time)} - {formatTime(win.end_time)}</div>
                                                <div className="truncate opacity-80">
                                                    {(win.programs || win.program_schedule?.map((ps: any) => ps.program))?.map((p: any) => p.program_name).join(', ') || 'Empty Slot'}
                                                </div>
                                            </Link>
                                        ))}
                                        {(!daySchedules || daySchedules.length === 0) && (
                                            <div className="text-slate-600 text-xs italic px-4">No classes</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoomDetails;
