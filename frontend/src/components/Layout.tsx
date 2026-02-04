import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    GraduationCap,
    Users,
    BookOpen,
    ClipboardCheck,
    CreditCard,
    Settings,
    Calendar
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
    const location = useLocation();
    const { user, userName, userRole } = useAuth();

    // Navigation Items Configuration
    const navItems = [
        { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
        { type: 'divider', label: 'Academic Hub' },
        { label: 'Programs', path: '/programs', icon: <BookOpen size={20} /> },
        { label: 'Exams', path: '/exams', icon: <ClipboardCheck size={20} /> },
        { type: 'divider', label: 'User Directory' },
        { label: 'Students', path: '/students', icon: <GraduationCap size={20} /> },
        { label: 'Teachers', path: '/teachers', icon: <Users size={20} /> },
        { type: 'divider', label: 'Operations' },
        { label: 'Scheduling', path: '/admin/scheduling', icon: <Calendar size={20} /> },
        { label: 'Attendance', path: '/attendance', icon: <ClipboardCheck size={20} /> },
        { label: 'Finance', path: '/finance', icon: <CreditCard size={20} /> },
        { type: 'divider', label: 'System' },
        { label: 'Settings', path: '/settings', icon: <Settings size={20} /> },
    ];

    // Fallback display name logic
    const displayName = userName || user?.user_metadata?.full_name || 'User';

    return (
        <div className="flex h-screen bg-gray-100">
            {/* SIDEBAR */}
            <aside className="w-64 bg-white shadow-md flex flex-col">
                <div className="p-6 border-b">
                    <Link to="/" className="block">
                        <h1 className="text-xl font-bold text-blue-600 leading-tight">Science Point</h1>
                        <p className="text-sm font-semibold text-gray-600">by Dr. Talha</p>
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">Admin Console</p>
                </div>

                <nav className="flex-1 overflow-y-auto py-4">
                    <ul>
                        {navItems.map((item, index) => {
                            if (item.type === 'divider') {
                                return (
                                    <li key={index} className="px-6 py-2 mt-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        {item.label}
                                    </li>
                                );
                            }

                            const isActive = location.pathname === item.path;
                            return (
                                <li key={index}>
                                    <Link
                                        to={item.path!}
                                        className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${isActive
                                            ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <span className="mr-3">{item.icon}</span>
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <Link to="/profile" className="p-4 border-t hover:bg-gray-50 transition cursor-pointer block">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase">
                            {(displayName?.[0] || user?.email?.[0] || 'U')}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{displayName}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                            <p className="text-[10px] text-gray-400 uppercase mt-0.5">{userRole}</p>
                        </div>
                    </div>
                </Link>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 overflow-auto">
                <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {navItems.find(i => i.path === location.pathname)?.label || 'Overview'}
                    </h2>
                    <div className="flex gap-2">
                        {/* Header Actions (Search, Notifs) go here */}
                    </div>
                </header>

                <div className="p-6">
                    {/* This is where the page content will appear */}
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
