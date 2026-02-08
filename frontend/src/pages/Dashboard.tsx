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
    Calendar,
    TrendingUp,
    Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
    // 1. Fetch Stats
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['finance-stats'],
        queryFn: PaymentRepository.getFinanceStats,
        refetchInterval: 60000 // Refresh every minute
    });

    // 2. Fetch Recent Activity
    const { data: recentPayments, isLoading: historyLoading } = useQuery({
        queryKey: ['recent-payments'],
        queryFn: PaymentRepository.getRecentPayments
    });

    // Loading Skeleton
    if (statsLoading || historyLoading) {
        return (
            <div className="p-6 space-y-6 animate-pulse">
                <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
                    ))}
                </div>
                <div className="h-64 bg-gray-200 rounded-xl"></div>
            </div>
        );
    }

    // Prepare Data
    const statCards = [
        {
            title: "Total Students",
            value: stats?.total_students || 0,
            icon: <Users size={24} className="text-blue-400" />,
            bg: "from-blue-500/10 to-blue-600/10",
            border: "border-blue-500/20",
            text: "text-blue-100" // Light text for dark theme
        },
        {
            title: "Active Programs",
            value: stats?.total_programs || 0,
            icon: <BookOpen size={24} className="text-purple-400" />,
            bg: "from-purple-500/10 to-purple-600/10",
            border: "border-purple-500/20",
            text: "text-purple-100"
        },
        {
            title: "Revenue This Month",
            value: `৳${stats?.revenue_this_month?.toLocaleString() || 0}`,
            icon: <Banknote size={24} className="text-emerald-400" />,
            bg: "from-emerald-500/10 to-emerald-600/10",
            border: "border-emerald-500/20",
            text: "text-emerald-100"
        },
        {
            title: "Total Due Overall",
            value: `৳${stats?.total_due?.toLocaleString() || 0}`,
            icon: <AlertCircle size={24} className="text-rose-400" />,
            bg: "from-rose-500/10 to-rose-600/10",
            border: "border-rose-500/20",
            text: "text-rose-100"
        }
    ];

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

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Link
                    to="/students"
                    className={`relative overflow-hidden rounded-2xl p-6 border backdrop-blur-md bg-gradient-to-br ${statCards[0].bg} ${statCards[0].border} shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up text-left block`}
                    style={{ animationDelay: '0ms' }}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">{statCards[0].title}</p>
                            <h3 className={`text-2xl font-bold ${statCards[0].text}`}>{statCards[0].value}</h3>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg border border-white/10">{statCards[0].icon}</div>
                    </div>
                </Link>

                <Link
                    to="/programs"
                    className={`relative overflow-hidden rounded-2xl p-6 border backdrop-blur-md bg-gradient-to-br ${statCards[1].bg} ${statCards[1].border} shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up text-left block`}
                    style={{ animationDelay: '100ms' }}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">{statCards[1].title}</p>
                            <h3 className={`text-2xl font-bold ${statCards[1].text}`}>{statCards[1].value}</h3>
                        </div>
                        <div className="p-2 bg-white/5 rounded-lg border border-white/10">{statCards[1].icon}</div>
                    </div>
                </Link>

                {statCards.slice(2).map((card, index) => (
                    <div
                        key={index + 2}
                        className={`relative overflow-hidden rounded-2xl p-6 border backdrop-blur-md bg-gradient-to-br ${card.bg} ${card.border} shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-slide-up`}
                        style={{ animationDelay: `${(index + 2) * 100}ms` }}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">{card.title}</p>
                                <h3 className={`text-2xl font-bold ${card.text}`}>{card.value}</h3>
                            </div>
                            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                {card.icon}
                            </div>
                        </div>
                        {/* Decorative Circle */}
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
                    </div>
                ))}
            </div>

            {/* Layout Grid: Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 1. Recent Activity Feed (Takes 2 columns) */}
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
                                {recentPayments?.slice(0, 5).map((pay: any) => (
                                    <tr key={pay.sort_id || pay.payment_ids?.[0] || Math.random()} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4 font-medium text-slate-200">
                                            {pay.student_name || 'Unknown Student'}
                                        </td>
                                        <td className="p-4 text-emerald-400 font-bold">
                                            +৳{pay.total_amount?.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-slate-400">
                                            {pay.program_name} <span className="text-xs text-slate-500">({pay.date_display})</span>
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {new Date(pay.payment_date).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                                {!recentPayments?.length && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500 italic">No recent activity found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. Quick Actions Sidebar (Takes 1 column) */}
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

                    {/* Mini Promo / Status */}
                    <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-1">System Healthy</h3>
                            <p className="text-indigo-100 text-sm mb-3">All services are running smoothly.</p>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
