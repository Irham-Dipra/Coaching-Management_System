import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend
} from 'recharts';
import { TrendingUp, Users, Award, Filter, CheckSquare, Square, ChevronDown } from 'lucide-react';

interface ExamMetric {
    exam_id: number;
    exam_name: string;
    date: string;
    total_marks: number;
    metrics: {
        avg_total: number;
        avg_written: number;
        avg_mcq: number;
        highest: number;
        lowest: number;
        student_count: number;
    };
    distribution: { name: string; value: number }[];
}

const KPICard = ({ title, value, subtext, icon: Icon, color }: any) => (
    <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-5 flex flex-col justify-between hover:border-slate-600 transition-all shadow-lg">
        <div className="flex justify-between items-start mb-2">
            <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
                <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
            </div>
        </div>
        <div>
            <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
            <p className="text-sm text-slate-400 font-medium">{title}</p>
            {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        </div>
    </div>
);

const BatchPerformance = ({ batchId }: { batchId: string }) => {
    const { data: analytics, isLoading, error } = useQuery({
        queryKey: ['batchAnalytics', batchId],
        queryFn: () => ProgramRepository.getBatchAnalytics(batchId),
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const [isChartReady, setIsChartReady] = useState(false);
    const [selectedExamIds, setSelectedExamIds] = useState<number[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Initialize selection when data loads
    React.useEffect(() => {
        if (analytics && analytics.exams && selectedExamIds.length === 0) {
            setSelectedExamIds(analytics.exams.map((e: any) => e.exam_id));
        }
    }, [analytics]);

    // Delay chart rendering to prevent width(-1) error during tab switch animations
    React.useEffect(() => {
        const timer = setTimeout(() => setIsChartReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const filteredExams = useMemo(() => {
        if (!analytics || !analytics.exams) return [];
        return analytics.exams.filter((e: ExamMetric) => selectedExamIds.includes(e.exam_id));
    }, [analytics, selectedExamIds]);

    const aggregatedStats = useMemo(() => {
        if (filteredExams.length === 0) return null;

        let totalSum = 0;
        let writtenSum = 0;
        let mcqSum = 0;
        let count = 0;
        let highest = 0;

        const dist: Record<string, number> = { "0-40%": 0, "41-60%": 0, "61-80%": 0, "81-100%": 0 };

        filteredExams.forEach((e: ExamMetric) => {
            totalSum += e.metrics.avg_total;
            writtenSum += e.metrics.avg_written;
            mcqSum += e.metrics.avg_mcq;
            count++;
            if (e.metrics.highest > highest) highest = e.metrics.highest;

            e.distribution.forEach((d: { name: string; value: number }) => {
                if (dist[d.name] !== undefined) dist[d.name] += d.value;
            });
        });

        return {
            avg_total: count ? (totalSum / count).toFixed(1) : 0,
            avg_written: count ? (writtenSum / count).toFixed(1) : 0,
            avg_mcq: count ? (mcqSum / count).toFixed(1) : 0,
            highest,
            distribution: [
                { name: "0-40%", value: dist["0-40%"] },
                { name: "41-60%", value: dist["41-60%"] },
                { name: "61-80%", value: dist["61-80%"] },
                { name: "81-100%", value: dist["81-100%"] }
            ]
        };
    }, [filteredExams]);

    if (isLoading) return <div className="p-10 text-center text-slate-400 animate-pulse">Loading batch analytics...</div>;
    if (error) return <div className="p-10 text-center text-red-400">Failed to load batch analytics</div>;

    if (!analytics || !analytics.exams || analytics.exams.length === 0) {
        return <div className="p-10 text-center text-slate-500">No analytics data available for this batch. Link exams to programs in this batch to see performance data.</div>;
    }

    const toggleExam = (id: number) => {
        setSelectedExamIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedExamIds.length === analytics.exams.length) {
            setSelectedExamIds([]);
        } else {
            setSelectedExamIds(analytics.exams.map((e: any) => e.exam_id));
        }
    };

    return (
        <div className="space-y-6 animate-fade-in relative w-full">

            {/* FILTER HEADER */}
            <div className="relative z-20 flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-md">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="text-emerald-400" /> Batch Performance Report
                </h2>

                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg border border-slate-600 transition-colors"
                    >
                        <Filter size={16} /> Filter Exams ({selectedExamIds.length}) <ChevronDown size={14} />
                    </button>

                    {isFilterOpen && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            <div
                                className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded-lg cursor-pointer text-sm font-bold text-white border-b border-slate-700/50 mb-1"
                                onClick={toggleAll}
                            >
                                {selectedExamIds.length === analytics.exams.length ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} className="text-slate-500" />}
                                Select All
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {analytics.exams.map((e: ExamMetric) => (
                                    <div
                                        key={e.exam_id}
                                        onClick={() => toggleExam(e.exam_id)}
                                        className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded-lg cursor-pointer text-sm text-slate-300"
                                    >
                                        {selectedExamIds.includes(e.exam_id) ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} className="text-slate-500" />}
                                        <span className="truncate">{e.exam_name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Grid */}
            {aggregatedStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                        title="Avg Written"
                        value={aggregatedStats.avg_written}
                        subtext="Across selected"
                        icon={TrendingUp}
                        color="bg-amber-500"
                    />
                    <KPICard
                        title="Avg MCQ"
                        value={aggregatedStats.avg_mcq}
                        subtext="Across selected"
                        icon={CheckSquare}
                        color="bg-purple-500"
                    />
                    <KPICard
                        title="Avg Total"
                        value={aggregatedStats.avg_total}
                        subtext="Combined Average"
                        icon={Award}
                        color="bg-blue-500"
                    />
                    <KPICard
                        title="Highest Score"
                        value={aggregatedStats.highest}
                        subtext="Best performance"
                        icon={Award}
                        color="bg-emerald-500"
                    />
                </div>
            )}

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Exam trend (Total, Written, MCQ) */}
                <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-lg min-w-0">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-400" />
                        Performance Trend
                    </h3>
                    <div className="h-72 w-full min-w-0">
                        {isChartReady && (
                            <ResponsiveContainer width="99%" height="100%" debounce={200}>
                                <LineChart data={filteredExams}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                    <XAxis dataKey="exam_name" stroke="#94a3b8" fontSize={10} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="metrics.avg_total" name="Total Avg" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="metrics.avg_written" name="Written Avg" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="metrics.avg_mcq" name="MCQ Avg" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                        {!isChartReady && <div className="h-full w-full flex items-center justify-center text-slate-500">Loading Chart...</div>}
                    </div>
                </div>

                {/* Score Distribution (Aggregated) */}
                <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-lg min-w-0">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Users size={20} className="text-emerald-400" />
                        Score Distribution (Selected)
                    </h3>
                    <div className="h-72 w-full min-w-0">
                        {isChartReady && (
                            <ResponsiveContainer width="99%" height="100%" debounce={200}>
                                <BarChart data={aggregatedStats?.distribution || []} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.5} />
                                    <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} width={60} />
                                    <Tooltip
                                        cursor={{ fill: '#334155', opacity: 0.2 }}
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    />
                                    <Bar dataKey="value" name="Students" radius={[0, 4, 4, 0]} barSize={30} fill="#10b981" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                        {!isChartReady && <div className="h-full w-full flex items-center justify-center text-slate-500">Loading Chart...</div>}
                    </div>
                </div>

            </div>

            {/* Attendance Trend */}
            <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-lg min-w-0">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Users size={20} className="text-slate-400" />
                    Attendance Trend
                </h3>
                <div className="h-48 w-full min-w-0">
                    {isChartReady && (
                        <ResponsiveContainer width="99%" height="100%" debounce={200}>
                            <BarChart data={analytics.attendance_trend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} domain={[0, 100]} />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                />
                                <Bar dataKey="percentage" fill="#64748b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                    {!isChartReady && <div className="h-full w-full flex items-center justify-center text-slate-500">Loading Chart...</div>}
                </div>
            </div>

        </div>
    );
};

export default BatchPerformance;
