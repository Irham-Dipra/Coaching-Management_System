import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScheduleRepository } from '../repositories/ScheduleRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { Calendar, Clock, MapPin, Users, Edit, Save, ArrowLeft, Trash2 } from 'lucide-react';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ScheduleDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);

    // FETCH DATA
    const { data: window, isLoading } = useQuery({
        queryKey: ['window', id],
        queryFn: () => ScheduleRepository.getWindowDetails(id!)
    });

    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: ScheduleRepository.getRooms });
    const { data: allPrograms } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms });

    // EDIT FORM STATE
    const [editData, setEditData] = useState<any>(null);

    // Initialize edit data when window loads
    React.useEffect(() => {
        if (window) {
            setEditData({
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
            alert("Schedule Updated!");
        },
        onError: (err) => alert("Failed: " + err)
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
                            {isEditing ? 'Edit Schedule Window' : `${window.day_of_week}, ${window.start_time.substring(0, 5)} - ${window.end_time.substring(0, 5)}`}
                        </h1>
                        <p className="text-gray-500 mt-1 flex items-center gap-2">
                            <MapPin size={16} /> {rooms?.find((r: any) => r.room_id === window.room_id)?.room_name || 'Room TBD'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <>
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
                                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm">
                                    <Save size={16} /> Save Changes
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* EDIT FORM */}
                {isEditing && (
                    <div className="p-6 bg-blue-50/50 border-b grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-200">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Day of Week</label>
                                <select
                                    className="w-full border rounded p-2 bg-white"
                                    value={editData.day_of_week}
                                    onChange={e => setEditData({ ...editData, day_of_week: e.target.value })}
                                >
                                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
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
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Room</label>
                                <select
                                    className="w-full border rounded p-2 bg-white"
                                    value={editData.room_id}
                                    onChange={e => setEditData({ ...editData, room_id: e.target.value })}
                                >
                                    {rooms?.map((r: any) => <option key={r.room_id} value={r.room_id}>{r.room_name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Assigned Programs</label>
                            <div className="bg-white border rounded-lg h-48 overflow-y-auto p-2 space-y-1">
                                {allPrograms?.map((prog: any) => (
                                    <div
                                        key={prog.program_id}
                                        onClick={() => toggleProgram(prog.program_id)}
                                        className={`p-2 rounded cursor-pointer flex justify-between items-center text-sm ${editData.program_ids.includes(prog.program_id) ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-gray-50'}`}
                                    >
                                        <span>{prog.program_name}</span>
                                        {editData.program_ids.includes(prog.program_id) && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                                    </div>
                                ))}
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
        </div>
    );
};

export default ScheduleDetails;
