import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StudentRepository } from '../repositories/StudentRepository';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, ReferenceLine
} from 'recharts';
import { TrendingUp, Award, Target, BookOpen, CheckCircle, Calendar } from 'lucide-react';

const KPICard = ({ title, value, subtext, icon: Icon, color }: any) => (
    <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-5 flex flex-col justify-between hover:border-slate-600 transition-all shadow-lg">
        <div className="flex justify-between items-start mb-2">
            <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
                <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
            </div>
        </div>
        <div>
            <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
            <p className="text-sm text-slate-400 font-medium">{title}</p>
            {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        </div>
    </div>
);

const StudentPerformance = ({ studentId }: { studentId: string }) => {
    const { data: analytics, isLoading, error } = useQuery({
        queryKey: ['studentAnalytics', studentId],
        queryFn: () => StudentRepository.getStudentAnalytics(studentId),
        refetchOnWindowFocus: false,
    });

    const [isChartReady, setIsChartReady] = useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => setIsChartReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) return <div className="p-10 text-center text-slate-400 animate-pulse">Loading performance data...</div>;
    if (error) return <div className="p-10 text-center text-red-400">Failed to load performance data</div>;

    if (!analytics || !analytics.exams || analytics.exams.length === 0) {
        return (
            <div className="p-10 text-center text-slate-500">
                <BookOpen size={48} className="mx-auto text-slate-600 mb-3" />
                <p className="font-medium">No exam results found for this student.</p>
                <p className="text-sm mt-1">Results will appear here once exams are graded.</p>
            </div>
        );
    }

    const { summary, exams, attendance_trend } = analytics;

    // Prepare chart data with readable labels
    const chartData = exams.map((e: any) => ({
        name: e.exam_name,
        total: e.metrics.total_score,
        written: e.metrics.written,
        mcq: e.metrics.mcq,
        percentage: e.metrics.percentage,
        max: e.total_marks
    }));

    // Attendance summary
    const attendanceRate = summary.attendance_total > 0
        ? Math.round((summary.attendance_present / summary.attendance_total) * 100)
        : 0;

    return (
        <div className="space-y-6 animate-fade-in w-full">
            {/* Header */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-md">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="text-emerald-400" /> Student Performance Report
                </h2>
                <p className="text-slate-400 text-sm mt-1">Performance across {summary.total_exams} exam{summary.total_exams !== 1 ? 's' : ''}</p>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Avg Percentage"
                    value={`${summary.avg_percentage}%`}
                    subtext="Across all exams"
                    icon={Target}
                    color="bg-blue-500"
                />
                <KPICard
                    title="Highest Score"
                    value={summary.highest_score}
                    subtext="Best performance"
                    icon={Award}
                    color="bg-emerald-500"
                />
                <KPICard
                    title="Lowest Score"
                    value={summary.lowest_score}
                    subtext="Room to improve"
                    icon={TrendingUp}
                    color="bg-amber-500"
                />
                <KPICard
                    title="Attendance"
                    value={`${attendanceRate}%`}
                    subtext={`${summary.attendance_present}/${summary.attendance_total} days`}
                    icon={CheckCircle}
                    color="bg-purple-500"
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Score Trend */}
                <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-lg min-w-0">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-400" />
                        Score Trend
                    </h3>
                    <div className="h-72 w-full min-w-0">
                        {isChartReady && (
                            <ResponsiveContainer width="99%" height="100%" debounce={200}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: '#3b82f6' }} />
                                    <Line type="monotone" dataKey="written" name="Written" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="mcq" name="MCQ" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                        {!isChartReady && <div className="h-full w-full flex items-center justify-center text-slate-500">Loading Chart...</div>}
                    </div>
                </div>

                {/* Percentage per Exam */}
                <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-lg min-w-0">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Target size={20} className="text-emerald-400" />
                        Percentage per Exam
                    </h3>
                    <div className="h-72 w-full min-w-0">
                        {isChartReady && (
                            <ResponsiveContainer width="99%" height="100%" debounce={200}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} domain={[0, 100]} />
                                    <Tooltip
                                        cursor={{ fill: '#334155', opacity: 0.2 }}
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                        formatter={(value: number) => [`${value}%`, 'Percentage']}
                                    />
                                    <ReferenceLine y={summary.avg_percentage} stroke="#f59e0b" strokeDasharray="6 4" label={{ value: `Avg: ${summary.avg_percentage}%`, position: 'right', fill: '#f59e0b', fontSize: 11 }} />
                                    <Bar dataKey="percentage" name="Score %" radius={[4, 4, 0, 0]} barSize={35} fill="#10b981" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                        {!isChartReady && <div className="h-full w-full flex items-center justify-center text-slate-500">Loading Chart...</div>}
                    </div>
                </div>
            </div>

            {/* Exam Results Table */}
            <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <BookOpen size={20} className="text-blue-400" />
                    Detailed Results
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left text-slate-400 font-semibold py-3 px-4">Exam</th>
                                <th className="text-center text-slate-400 font-semibold py-3 px-2">Date</th>
                                <th className="text-center text-slate-400 font-semibold py-3 px-2">Written</th>
                                <th className="text-center text-slate-400 font-semibold py-3 px-2">MCQ</th>
                                <th className="text-center text-slate-400 font-semibold py-3 px-2">Total</th>
                                <th className="text-center text-slate-400 font-semibold py-3 px-2">Max</th>
                                <th className="text-center text-slate-400 font-semibold py-3 px-2">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exams.map((exam: any) => {
                                const pct = exam.metrics.percentage;
                                const pctColor = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-blue-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';
                                return (
                                    <tr key={exam.exam_id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                        <td className="py-3 px-4 text-slate-200 font-medium">{exam.exam_name}</td>
                                        <td className="py-3 px-2 text-center text-slate-400 text-xs">{exam.date || '-'}</td>
                                        <td className="py-3 px-2 text-center text-amber-400 font-mono">{exam.metrics.written}</td>
                                        <td className="py-3 px-2 text-center text-purple-400 font-mono">{exam.metrics.mcq}</td>
                                        <td className="py-3 px-2 text-center text-white font-bold font-mono">{exam.metrics.total_score}</td>
                                        <td className="py-3 px-2 text-center text-slate-500 font-mono">{exam.total_marks}</td>
                                        <td className={`py-3 px-2 text-center font-bold ${pctColor}`}>{pct}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Attendance Trend */}
            {attendance_trend && attendance_trend.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-lg min-w-0">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Calendar size={20} className="text-slate-400" />
                        Attendance Record
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                        {attendance_trend.map((day: any, i: number) => (
                            <div
                                key={i}
                                title={`${day.date}: ${day.status}`}
                                className={`w-4 h-4 rounded-sm ${day.status === 'Present' ? 'bg-emerald-500' : 'bg-red-500/60'}`}
                            />
                        ))}
                    </div>
                    <div className="flex gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Present</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500/60 inline-block" /> Absent</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentPerformance;
