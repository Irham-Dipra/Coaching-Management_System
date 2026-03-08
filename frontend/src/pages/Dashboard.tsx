import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PaymentRepository } from '../repositories/PaymentRepository';
import {
    Users,
    BookOpen,
    Banknote,
    AlertCircle,
    Plus,
    CreditCard,
    TrendingUp,
    Activity,
    Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCardSkeleton: React.FC = () => (
    <div className="relative overflow-hidden rounded-2xl p-6 border border-slate-700 bg-slate-800/50 animate-pulse">
        <div className="flex justify-between items-start">
            <div>
                <div className="h-3 w-24 bg-slate-700 rounded mb-3" />
                <div className="h-6 w-16 bg-slate-700 rounded" />
            </div>
            <div className="w-10 h-10 bg-slate-700 rounded-lg" />
        </div>
    </div>
);

const DueCardLoading: React.FC<{ title: string; icon: React.ReactNode; bg: string; border: string; to: string }> = ({ title, icon, bg, border, to }) => (
    <Link to={to} className={`relative overflow-hidden rounded-2xl p-6 border backdrop-blur-md bg-gradient-to-br ${bg} ${border} shadow-lg block`}>
        <div className="flex justify-between items-start">
            <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">{title}</p>
                <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                    <span className="text-slate-400 text-sm">Calculating…</span>
                </div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg border border-white/10">{icon}</div>
        </div>
    </Link>
);

const Dashboard: React.FC = () => {
    // Fast stats — loads in ~300ms
    const { data: quick, isLoading: quickLoading } = useQuery({
        queryKey: ['finance-stats-quick'],
        queryFn: PaymentRepository.getFinanceStatsQuick,
    });

    // Heavy due stats — loads in 2-5s, shown with per-card spinner
    const { data: dues, isLoading: duesLoading } = useQuery({
        queryKey: ['finance-stats-dues'],
        queryFn: PaymentRepository.getFinanceStatsDues,
    });

    // Recent Activity — loads independently
    const { data: recentPayments, isLoading: historyLoading } = useQuery({
        queryKey: ['recent-payments'],
        queryFn: () => PaymentRepository.getRecentPayments(1, 10)
    });

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6 space-y-8 font-sans">
            {/* Header */}
            <div className="flex justify-between items-center animate-fade-in">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Admin Dashboard
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Overview of your coaching center performance</p>
                </div>
                <div className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    Last updated: {new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* Stats Grid — progressive: fast cards first, due cards with spinner */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Total Students */}
                {quickLoading ? <StatCardSkeleton /> : (
                    <Link to="/students"
                        className="relative overflow-hidden rounded-2xl p-6 border backdrop-blur-md bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up text-left block"
                        style={{ animationDelay: '0ms' }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Total Students</p>
                                <h3 className="text-2xl font-bold text-blue-100">{quick?.total_students ?? 0}</h3>
                            </div>
                            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                <Users size={24} className="text-blue-400" />
                            </div>
                        </div>
                    </Link>
                )}

                {/* Active Programs */}
                {quickLoading ? <StatCardSkeleton /> : (
                    <Link to="/programs"
                        className="relative overflow-hidden rounded-2xl p-6 border backdrop-blur-md bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up text-left block"
                        style={{ animationDelay: '100ms' }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Active Programs</p>
                                <h3 className="text-2xl font-bold text-purple-100">{quick?.total_programs ?? 0}</h3>
                            </div>
                            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                <BookOpen size={24} className="text-purple-400" />
                            </div>
                        </div>
                    </Link>
                )}

                {/* Revenue This Month */}
                {quickLoading ? <StatCardSkeleton /> : (
                    <Link to="/admin/finance/breakdown/due_monthly"
                        className="relative overflow-hidden rounded-2xl p-6 border backdrop-blur-md bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-500/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up text-left block"
                        style={{ animationDelay: '200ms' }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Revenue This Month</p>
                                <h3 className="text-2xl font-bold text-emerald-100">
                                    ৳{quick?.revenue_this_month?.toLocaleString() ?? 0}
                                </h3>
                            </div>
                            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                <Banknote size={24} className="text-emerald-400" />
                            </div>
                        </div>
                    </Link>
                )}

                {/* Total Due — shows spinner while heavy calc runs */}
                {duesLoading ? (
                    <DueCardLoading
                        title="Total Due Overall"
                        icon={<AlertCircle size={24} className="text-rose-400" />}
                        bg="from-rose-500/10 to-rose-600/10"
                        border="border-rose-500/20"
                        to="/admin/finance/breakdown/due_overall"
                    />
                ) : (
                    <Link to="/admin/finance/breakdown/due_overall"
                        className="relative overflow-hidden rounded-2xl p-6 border backdrop-blur-md bg-gradient-to-br from-rose-500/10 to-rose-600/10 border-rose-500/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up text-left block"
                        style={{ animationDelay: '300ms' }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Total Due Overall</p>
                                <h3 className="text-2xl font-bold text-rose-100">
                                    ৳{dues?.total_due?.toLocaleString() ?? 0}
                                </h3>
                            </div>
                            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                <AlertCircle size={24} className="text-rose-400" />
                            </div>
                        </div>
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
                    </Link>
                )}
            </div>

            {/* Layout Grid: Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 1. Recent Activity Feed */}
                <div className="lg:col-span-2 space-y-4 animate-slide-up" style={{ animationDelay: '400ms' }}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Activity size={20} className="text-blue-400" />
                            Recent Activity
                        </h2>
                        <Link to="/finance" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">View All Reports &rarr;</Link>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl backdrop-blur-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="p-4 font-semibold">Student</th>
                                    <th className="p-4 font-semibold">Amount</th>
                                    <th className="p-4 font-semibold">Purpose</th>
                                    <th className="p-4 font-semibold">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {historyLoading && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500">
                                            <Loader2 size={18} className="animate-spin inline mr-2" />Loading activity…
                                        </td>
                                    </tr>
                                )}
                                {recentPayments?.data?.slice(0, 5).map((pay: any) => (
                                    <tr key={pay.sort_id || pay.payment_ids?.[0] || Math.random()} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4 font-medium text-slate-200">{pay.student_name || 'Unknown Student'}</td>
                                        <td className="p-4 text-emerald-400 font-bold">
                                            +৳{pay.total_amount?.toLocaleString() || pay.amount?.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-slate-400">
                                            {pay.program_name} <span className="text-xs text-slate-500">({pay.date_display})</span>
                                        </td>
                                        <td className="p-4 text-slate-500">{new Date(pay.payment_date).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                {!historyLoading && !recentPayments?.data?.length && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500 italic">No recent activity found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. Quick Actions */}
                <div className="space-y-4 animate-slide-up" style={{ animationDelay: '500ms' }}>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <TrendingUp size={20} className="text-purple-400" />
                        Quick Actions
                    </h2>

                    <div className="grid grid-cols-1 gap-3">
                        <Link to="/students?action=new" className="group p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-blue-600/20 hover:border-blue-500/50 transition-all duration-300 flex items-center gap-4">
                            <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400 group-hover:text-blue-300 group-hover:scale-110 transition-transform">
                                <Plus size={20} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-200 group-hover:text-white">New Student</h4>
                                <p className="text-xs text-slate-400 group-hover:text-slate-300">Register a new student</p>
                            </div>
                        </Link>

                        <Link to="/finance?action=payment" className="group p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-emerald-600/20 hover:border-emerald-500/50 transition-all duration-300 flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-400 group-hover:text-emerald-300 group-hover:scale-110 transition-transform">
                                <CreditCard size={20} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-200 group-hover:text-white">Record Payment</h4>
                                <p className="text-xs text-slate-400 group-hover:text-slate-300">Add fee collection</p>
                            </div>
                        </Link>
                    </div>

                    <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-1">System Healthy</h3>
                            <p className="text-indigo-100 text-sm mb-3">All services are running smoothly.</p>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
