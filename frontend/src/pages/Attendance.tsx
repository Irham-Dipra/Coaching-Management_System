import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { Calendar, Users, Save } from 'lucide-react';

const Attendance: React.FC = () => {
    const [selectedProgramId, setSelectedProgramId] = useState<string>('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const queryClient = useQueryClient();

    // 1. Fetch All Programs for Dropdown
    const { data: programs } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms
    });

    // 2. Fetch Attendance when Program + Date selected
    const { data: fetchedAttendance } = useQuery({
        queryKey: ['attendance', selectedProgramId, date],
        queryFn: () => AttendanceRepository.getDailyAttendance(selectedProgramId, date),
        enabled: !!selectedProgramId
    });

    // Sync state
    useEffect(() => {
        if (fetchedAttendance) {
            setAttendanceData(fetchedAttendance);
        } else if (selectedProgramId) {
            // Reset if no data yet (handled by repo returning empty list usually, but good to be sure)
            setAttendanceData([]);
        }
    }, [fetchedAttendance, selectedProgramId, date]);

    // 3. Mutation to Save
    const attendanceMutation = useMutation({
        mutationFn: (data: any) => AttendanceRepository.submitAttendance(parseInt(selectedProgramId), date, data),
        onSuccess: () => {
            alert("Attendance Saved Successfully!");
            queryClient.invalidateQueries({ queryKey: ['attendance', selectedProgramId] });
        },
        onError: (err) => alert("Failed to save: " + err)
    });

    const handleStatusChange = (enrollmentId: number, status: string) => {
        setAttendanceData(prev => prev.map(item =>
            item.enrollment_id === enrollmentId ? { ...item, status } : item
        ));
    };

    const handleSave = () => {
        if (!selectedProgramId) return;
        const records = attendanceData.map(item => ({
            enrollment_id: item.enrollment_id,
            status: item.status,
            attendance_id: item.attendance_id,
            date: date
        })).filter(r => r.status); // Only save marked records

        attendanceMutation.mutate(records);
    };

    // Calculate Stats
    const total = attendanceData.length;
    const present = attendanceData.filter(a => a.status === 'Present').length;
    const absent = attendanceData.filter(a => a.status === 'Absent').length;
    const unrecorded = total - present - absent;

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center gap-3">
                <Calendar className="text-blue-400" /> Daily Attendance
            </h1>

            {/* CONTROLS */}
            <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-xl shadow-lg border border-slate-700/50 flex flex-wrap gap-6 items-end">
                <div className="flex-1 min-w-[250px]">
                    <label className="block text-sm font-bold text-slate-300 mb-2">Select Program (Batch)</label>
                    <select
                        className="w-full p-3 border border-slate-600 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-400"
                        value={selectedProgramId}
                        onChange={(e) => setSelectedProgramId(e.target.value)}
                    >
                        <option value="" className="bg-slate-800 text-slate-400">-- Choose a Program --</option>
                        {programs?.map((p: any) => (
                            <option key={p.program_id} value={p.program_id} className="bg-slate-800">
                                {p.program_name} ({p.batch?.batch_name})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="min-w-[200px]">
                    <label className="block text-sm font-bold text-slate-300 mb-2">Date</label>
                    <input
                        type="date"
                        className="w-full p-3 border border-slate-600 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>

                <button
                    onClick={handleSave}
                    disabled={!selectedProgramId || attendanceMutation.isPending}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                    <Save size={20} /> {attendanceMutation.isPending ? 'Saving...' : 'Save Attendance'}
                </button>
            </div>

            {selectedProgramId ? (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden shadow-xl">
                    {/* STATS BAR */}
                    <div className="bg-slate-800/80 border-b border-slate-700 p-4 flex gap-8 text-sm overflow-x-auto">
                        <span className="font-medium text-slate-400 flex items-center gap-2">Total: <b className="text-white text-lg">{total}</b></span>
                        <span className="font-medium text-emerald-400 flex items-center gap-2">Present: <b className="text-emerald-300 text-lg">{present}</b></span>
                        <span className="font-medium text-red-400 flex items-center gap-2">Absent: <b className="text-red-300 text-lg">{absent}</b></span>
                        {unrecorded > 0 && <span className="font-medium text-amber-400 flex items-center gap-2">Not Recorded: <b className="text-amber-300 text-lg">{unrecorded}</b></span>}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-bold border-b border-slate-700">
                                <tr>
                                    <th className="p-5">Student Name</th>
                                    <th className="p-5 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {attendanceData.map((student: any) => (
                                    <tr key={student.enrollment_id} className="hover:bg-slate-700/30 transition-colors group">
                                        <td className="p-5">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md transition-colors ${student.status === 'Absent' ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                                                    student.status === 'Present' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                                                        'bg-slate-700 text-slate-400 border border-slate-600'
                                                    }`}>
                                                    {student.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-200 group-hover:text-white transition-colors">{student.name}</p>
                                                    <p className="text-xs text-slate-500 font-mono">Roll: {student.roll_no}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5 flex justify-end items-center gap-3">
                                            {!student.status && (
                                                <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-wide animate-pulse">
                                                    Not Recorded
                                                </span>
                                            )}
                                            {['Present', 'Absent'].map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => handleStatusChange(student.enrollment_id, status)}
                                                    className={`px-5 py-2 text-sm rounded-lg border transition-all font-bold ${student.status === status
                                                        ? status === 'Absent' ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/20 scale-105'
                                                            : 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/20 scale-105'
                                                        : 'text-slate-400 bg-slate-800/50 border-slate-700 hover:bg-slate-700 hover:text-white hover:border-slate-600'
                                                        }`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </td>
                                    </tr>
                                ))}
                                {attendanceData.length === 0 && (
                                    <tr><td colSpan={2} className="p-16 text-center text-slate-500 italic">No students found in this program.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="text-center py-24 bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-700/50 text-slate-500 flex flex-col items-center justify-center">
                    <Users size={64} className="mb-6 opacity-30 text-blue-400" />
                    <p className="text-xl font-medium text-slate-400">Select a program above</p>
                    <p className="text-sm">to load the student list and mark attendance.</p>
                </div>
            )}
        </div>
    );
};

export default Attendance;
