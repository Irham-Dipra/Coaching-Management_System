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

    if (isLoading) return <div className="p-8">Loading details...</div>;
    if (error || !room) return <div className="p-8 text-red-500">Room not found.</div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4 text-gray-500">
                <Link to="/admin/scheduling" className="hover:text-gray-900 flex items-center gap-1 transition-colors">
                    <ArrowLeft size={16} /> Back to Scheduling
                </Link>
            </div>

            {/* Title & Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                        <MapPin size={24} />
                    </div>
                    <div>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none w-48"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    autoFocus
                                    placeholder="Room Name"
                                />
                                <input
                                    type="number"
                                    className="text-lg text-gray-600 border-b-2 border-gray-300 outline-none w-24"
                                    value={editCapacity}
                                    onChange={e => setEditCapacity(e.target.value)}
                                    placeholder="Cap."
                                />
                            </div>
                        ) : (
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{room.room_name}</h1>
                                <p className="text-gray-500 text-sm flex items-center gap-2">
                                    <Users size={14} /> Capacity: {room.capacity || 'Unlimited'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm"
                        >
                            <Save size={18} /> Save
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 text-gray-500 hover:text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        <Edit size={18} /> Edit Details
                    </button>
                )}
            </div>

            {/* Schedule Section */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Calendar size={20} className="text-gray-400" />
                        Room Schedule ({schedules?.length || 0})
                    </h2>

                    {/* View Toggle */}
                    <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ListIcon size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Grid size={18} />
                        </button>
                    </div>
                </div>

                {viewMode === 'list' ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="p-4 border-b">Day</th>
                                    <th className="p-4 border-b">Time</th>
                                    <th className="p-4 border-b">Program(s)</th>
                                    <th className="p-4 border-b text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {DAYS.map(day => {
                                    const daySchedules = schedules?.filter((s: any) => s.day_of_week === day)
                                        .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

                                    if (!daySchedules || daySchedules.length === 0) return null;

                                    return daySchedules.map((win: ScheduleWindow, index: number) => (
                                        <tr key={win.window_id} className="hover:bg-gray-50 group">
                                            {index === 0 && (
                                                <td className="p-4 font-medium text-gray-900 align-top border-r border-gray-100 bg-gray-50/30" rowSpan={daySchedules.length}>
                                                    {day}
                                                </td>
                                            )}
                                            <td className="p-4 text-gray-600 font-mono text-sm border-b border-gray-100">
                                                {formatTime(win.start_time)} - {formatTime(win.end_time)}
                                            </td>
                                            <td className="p-4 border-b border-gray-100">
                                                <div className="flex flex-wrap gap-1">
                                                    {(win.programs || win.program_schedule?.map((ps: any) => ps.program))?.map((p: any) => (
                                                        <span key={p.program_id} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                                            {p.program_name}
                                                        </span>
                                                    ))}
                                                    {(!win.programs && !win.program_schedule?.length) && (
                                                        <span className="text-gray-400 text-xs italic">No programs assigned</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right border-b border-gray-100">
                                                <Link
                                                    to={`/admin/scheduling/${win.window_id}`}
                                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
                                                >
                                                    View Details
                                                </Link>
                                            </td>
                                        </tr>
                                    ));
                                })}

                                {(!schedules || schedules.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500 italic">No classes scheduled in this room.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    // GRID VIEW (Copied logic from Scheduling Master Schedule but filtered)
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                        <div className="grid grid-cols-8 min-w-[800px] border-b border-gray-200 bg-gray-50">
                            <div className="p-3 text-xs font-bold text-gray-500 uppercase">Day</div>
                            {/* Times derived from existing schedules or standard slots? */}
                            {/* Simplified Grid: Just listing days rows */}
                            <div className="col-span-7 p-3 text-xs font-bold text-gray-500 uppercase text-center">Timeline</div>
                        </div>
                        {DAYS.map(day => {
                            const daySchedules = schedules?.filter((s: any) => s.day_of_week === day)
                                .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

                            return (
                                <div key={day} className="grid grid-cols-8 border-b border-gray-100 min-h-[80px]">
                                    <div className="p-4 font-bold text-gray-700 border-r border-gray-100 bg-gray-50/50 flex items-center justify-center">
                                        {day.substring(0, 3)}
                                    </div>
                                    <div className="col-span-7 p-2 relative flex items-center gap-2 flex-wrap">
                                        {daySchedules?.map((win: ScheduleWindow) => (
                                            <Link
                                                key={win.window_id}
                                                to={`/admin/scheduling/${win.window_id}`}
                                                className="flex-shrink-0 bg-blue-100 border border-blue-200 text-blue-800 p-2 rounded-lg text-xs hover:shadow-md hover:bg-blue-200 transition-all cursor-pointer min-w-[120px]"
                                            >
                                                <div className="font-bold mb-1">{formatTime(win.start_time)} - {formatTime(win.end_time)}</div>
                                                <div className="truncate opacity-80">
                                                    {(win.programs || win.program_schedule?.map((ps: any) => ps.program))?.map((p: any) => p.program_name).join(', ') || 'Empty Slot'}
                                                </div>
                                            </Link>
                                        ))}
                                        {(!daySchedules || daySchedules.length === 0) && (
                                            <div className="text-gray-300 text-xs italic px-4">No classes</div>
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
