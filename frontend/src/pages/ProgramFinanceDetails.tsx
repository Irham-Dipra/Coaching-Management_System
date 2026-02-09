import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Filter, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { ProgramRepository } from '../repositories/ProgramRepository';

const ProgramFinanceDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Default to current month/year
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [filterStatus, setFilterStatus] = useState<string>('All'); // All, Paid, Unpaid, Partial

    const API_BASE_URL = "http://localhost:8000";

    // 1. Fetch Program Info
    const { data: program } = useQuery({
        queryKey: ['program', id],
        queryFn: () => ProgramRepository.getProgramById(id!),
        enabled: !!id
    });

    // 2. Fetch Payment Status
    const { data: students, isLoading } = useQuery({
        queryKey: ['program_finance', id, month, year],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/programs/${id}/payment-status?month=${month}&year=${year}`);
            if (!res.ok) throw new Error("Failed to load data");
            return res.json();
        },
        enabled: !!id
    });

    // Filter Logic
    const filteredStudents = React.useMemo(() => {
        if (!students) return [];
        if (filterStatus === 'All') return students;
        return students.filter((s: any) => s.status === filterStatus);
    }, [students, filterStatus]);

    // Stats
    const stats = React.useMemo(() => {
        if (!students) return { total: 0, paid: 0, unpaid: 0, partial: 0, collected: 0, due: 0 };
        return students.reduce((acc: any, curr: any) => {
            acc.total++;
            if (curr.status === 'Paid') acc.paid++;
            else if (curr.status === 'Unpaid') acc.unpaid++;
            else acc.partial++;

            acc.collected += (curr.paid_amount || 0);
            acc.due += (curr.due_amount || 0);
            return acc;
        }, { total: 0, paid: 0, unpaid: 0, partial: 0, collected: 0, due: 0 });
    }, [students]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* HEADER */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="text-blue-600" />
                        {program?.program_name || 'Program'} Finance
                    </h1>
                    <p className="text-sm text-gray-500">
                        Payment status for {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}
                    </p>
                </div>

                {/* CONTROLS */}
                <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="border-none bg-gray-50 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="border-none bg-gray-50 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value={2024}>2024</option>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                    </select>
                </div>
            </div>

            {/* STATS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase font-bold">Total Students</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs text-green-600 uppercase font-bold">Collected</p>
                    <p className="text-2xl font-bold text-green-700">৳{stats.collected.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs text-red-500 uppercase font-bold">Due Amount</p>
                    <p className="text-2xl font-bold text-red-600">৳{stats.due.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center gap-1">
                    <div className="flex justify-between text-xs"><span className="text-green-600 font-bold">Paid: {stats.paid}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-amber-600 font-bold">Partial: {stats.partial}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-red-600 font-bold">Unpaid: {stats.unpaid}</span></div>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-700">Student List</h3>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-white border text-sm rounded-lg px-2 py-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                            <option value="All">All Status</option>
                            <option value="Paid">Paid</option>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Partial">Partial</option>
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-gray-500">Loading student data...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b">
                                <tr>
                                    <th className="p-4">Student</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-right">Fee</th>
                                    <th className="p-4 text-right">Paid</th>
                                    <th className="p-4 text-right">Due</th>
                                    <th className="p-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredStudents.map((s: any) => (
                                    <tr key={s.enrollment_id} className="hover:bg-gray-50">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900">{s.name}</div>
                                            <div className="text-xs text-gray-500">Roll: {s.roll_no || '-'}</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-200' :
                                                    s.status === 'Unpaid' ? 'bg-red-100 text-red-800 border-red-200' :
                                                        'bg-amber-100 text-amber-800 border-amber-200'
                                                }`}>
                                                {s.status === 'Paid' && <CheckCircle size={12} />}
                                                {s.status === 'Unpaid' && <XCircle size={12} />}
                                                {s.status === 'Partial' && <AlertTriangle size={12} />}
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono text-gray-600">৳{(s.monthly_fee || 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-green-600 font-medium">৳{(s.paid_amount || 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-red-600 font-bold">
                                            {s.due_amount > 0 ? `৳${s.due_amount.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {/* Action to take payment? Link to student profile? */}
                                            <button className="text-blue-600 hover:underline text-xs" onClick={() => navigate(`/admin/students/${s.student_id}`)}>
                                                View Profile
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-gray-400 italic">No students found matching filters.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgramFinanceDetails;
