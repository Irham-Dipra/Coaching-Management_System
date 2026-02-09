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
            status: item.status, // Allow null/undefined to go if we want, but usually we save specifically marked ones.
            // Actually, if we want to save "Not Recorded", we probably just skip it or dont send it?
            // But if user clicks 'Save', they probably intend to save what they see.
            // If they haven't touched it, it's null.
            // If they want to save partial attendance, we filter out nulls? 
            // Or we assume if they save, they want to save 'Present' or 'Absent'. 
            // If it's null, we probably shouldn't save it as a record unless we want to clear it.
            // For now, let's filter out items with no status to avoid overwriting existing data with empty, 
            // OR if we want to support 'unmarking', we might need logic.
            // Simpler: Only send records that have a status.
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
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="text-blue-600" /> Daily Attendance
            </h1>

            {/* CONTROLS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-6 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Program (Batch)</label>
                    <select
                        className="w-full p-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedProgramId}
                        onChange={(e) => setSelectedProgramId(e.target.value)}
                    >
                        <option value="">-- Choose a Program --</option>
                        {programs?.map((p: any) => (
                            <option key={p.program_id} value={p.program_id}>
                                {p.program_name} ({p.batch?.batch_name})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="min-w-[150px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                        type="date"
                        className="w-full p-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>

                <button
                    onClick={handleSave}
                    disabled={!selectedProgramId || attendanceMutation.isPending}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Save size={18} /> {attendanceMutation.isPending ? 'Saving...' : 'Save Attendance'}
                </button>
            </div>

            {selectedProgramId ? (
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    {/* STATS BAR */}
                    <div className="bg-gray-50 border-b p-4 flex gap-6 text-sm">
                        <span className="font-medium text-gray-600">Total: <b className="text-gray-900">{total}</b></span>
                        <span className="font-medium text-green-600">Present: <b>{present}</b></span>
                        <span className="font-medium text-red-600">Absent: <b>{absent}</b></span>
                        {unrecorded > 0 && <span className="font-medium text-amber-600">Not Recorded: <b>{unrecorded}</b></span>}
                    </div>

                    <table className="w-full text-left">
                        <thead className="bg-white text-gray-500 text-xs uppercase font-semibold border-b">
                            <tr>
                                <th className="p-4">Student Name</th>
                                <th className="p-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {attendanceData.map((student: any) => (
                                <tr key={student.enrollment_id} className="hover:bg-gray-50 border-b last:border-0 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${student.status === 'Absent' ? 'bg-red-100 text-red-600' :
                                                student.status === 'Present' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-gray-100 text-gray-500'
                                                }`}>
                                                {student.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{student.name}</p>
                                                <p className="text-xs text-gray-500">Roll: {student.roll_no}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 flex justify-end items-center gap-3">
                                        {!student.status && (
                                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full border border-amber-200 uppercase tracking-wide shadow-sm animate-pulse">
                                                Not Recorded
                                            </span>
                                        )}
                                        {['Present', 'Absent'].map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => handleStatusChange(student.enrollment_id, status)}
                                                className={`px-4 py-1.5 text-sm rounded-full border transition-all ${student.status === status
                                                    ? status === 'Absent' ? 'bg-red-600 text-white border-red-600 font-medium shadow-md scale-105'
                                                        : 'bg-green-600 text-white border-green-600 font-medium shadow-md scale-105'
                                                    : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                            {attendanceData.length === 0 && (
                                <tr><td colSpan={2} className="p-12 text-center text-gray-400">No students found in this program.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-20 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200 text-gray-400">
                    <Users size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Select a program above to load the student list.</p>
                </div>
            )}
        </div>
    );
};

export default Attendance;
