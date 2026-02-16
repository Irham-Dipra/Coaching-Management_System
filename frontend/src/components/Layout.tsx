import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    GraduationCap,
    BookOpen,
    ClipboardCheck,
    CreditCard,
    Calendar,
    Layers,
    UserPlus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
    const location = useLocation();
    const { user, userName, userRole } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    // Navigation Items Configuration
    const navItems = [
        { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
        { label: 'Batches', path: '/batches', icon: <Layers size={20} /> },
        { type: 'divider', label: 'Academic Hub' },
        { label: 'Programs', path: '/programs', icon: <BookOpen size={20} /> },
        { label: 'Exams', path: '/exams', icon: <ClipboardCheck size={20} /> },
        { type: 'divider', label: 'User Directory' },
        { label: 'Students', path: '/students', icon: <GraduationCap size={20} /> },
        { label: 'Enrollment', path: '/enrollment', icon: <UserPlus size={20} /> },
        { type: 'divider', label: 'Operations' },
        { label: 'Scheduling', path: '/admin/scheduling', icon: <Calendar size={20} /> },
        { label: 'Attendance', path: '/attendance', icon: <ClipboardCheck size={20} /> },
        { label: 'Finance', path: '/finance', icon: <CreditCard size={20} /> },
    ];

    // Fallback display name logic
    const displayName = userName || user?.user_metadata?.full_name || 'User';

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
            {/* MOBILE OVERLAY */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-20 backdrop-blur-sm lg:hidden animate-fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* SIDEBAR */}
            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-30 w-64 
                    bg-slate-900 border-r border-slate-800 
                    transform transition-transform duration-300 ease-in-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    flex flex-col shadow-2xl
                `}
            >
                {/* Brand */}
                <div className="p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                    <Link to="/" className="block group">
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 group-hover:from-blue-300 group-hover:to-purple-300 transition-all">
                            Science Point
                        </h1>
                        <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase mt-1">by Dr. Talha</p>
                    </Link>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <ul className="space-y-1">
                        {navItems.map((item, index) => {
                            if (item.type === 'divider') {
                                return (
                                    <li key={index} className="px-4 py-3 mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        {item.label}
                                    </li>
                                );
                            }

                            const isActive = location.pathname === item.path;
                            return (
                                <li key={index}>
                                    <Link
                                        to={item.path!}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`
                                            flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                                            ${isActive
                                                ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-lg shadow-blue-500/5'
                                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 hover:translate-x-1'
                                            }
                                        `}
                                    >
                                        <span className={`mr-3 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                                            {item.icon}
                                        </span>
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* User Profile Snippet */}
                <div className="p-4 border-t border-slate-800/50 bg-slate-900/30">
                    <Link to="/profile" className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition-colors group">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-[1px]">
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                                <span className="text-blue-400 font-bold text-sm">
                                    {(displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">{displayName}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{userRole || 'Admin'}</p>
                        </div>
                    </Link>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-900 relative">
                {/* Background Gradients */}
                <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl -ml-20 -mb-20"></div>
                </div>

                {/* Mobile Header */}
                <header className="lg:hidden bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-20 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-100">
                        {navItems.find(i => i.path === location.pathname)?.label || 'Overview'}
                    </h2>
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                    >
                        <LayoutDashboard size={20} />
                    </button>
                </header>

                <div className="relative p-4 lg:p-8 max-w-7xl mx-auto min-h-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
