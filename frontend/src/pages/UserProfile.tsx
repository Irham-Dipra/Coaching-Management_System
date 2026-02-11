import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Shield, BadgeCheck, LogOut } from 'lucide-react';

const UserProfile: React.FC = () => {
    const { user, userName, dbUserId, userRole, signOut } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    // Fallback display name logic
    const displayName = userName || user?.user_metadata?.full_name || 'User';

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">My Profile</h1>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 border border-red-500/20 transition font-medium"
                >
                    <LogOut size={18} />
                    Sign Out
                </button>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700 relative">
                    <div className="absolute inset-0 bg-black/10"></div>
                </div>

                <div className="px-8 pb-8">
                    <div className="relative flex justify-between items-end -mt-12 mb-6">
                        <div className="flex items-end gap-6">
                            <div className="w-24 h-24 rounded-full bg-slate-800 p-1 shadow-xl ring-4 ring-slate-900">
                                <div className="w-full h-full rounded-full bg-slate-700 flex items-center justify-center text-slate-400">
                                    <User size={40} />
                                </div>
                            </div>
                            <div className="mb-1">
                                <h2 className="text-3xl font-bold text-white mb-1">{displayName}</h2>
                                <p className="text-slate-400 font-medium">{user?.email}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-200 mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                                <Shield size={18} className="text-blue-400" /> Account Details
                            </h3>
                            <div className="space-y-4">
                                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
                                    <div className="flex items-center gap-2 mt-1 text-slate-200">
                                        <div className="bg-blue-500/20 p-1 rounded text-blue-400">
                                            <Shield size={16} />
                                        </div>
                                        <span className="capitalize font-medium">{userRole}</span>
                                    </div>
                                </div>
                                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                                    <div className="flex items-center gap-2 mt-1 text-slate-200">
                                        <div className="bg-purple-500/20 p-1 rounded text-purple-400">
                                            <Mail size={16} />
                                        </div>
                                        <span>{user?.email}</span>
                                    </div>
                                </div>
                                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">User ID</label>
                                    <div className="flex items-center gap-2 mt-1 text-slate-200">
                                        <div className="bg-emerald-500/20 p-1 rounded text-emerald-400">
                                            <BadgeCheck size={16} />
                                        </div>
                                        <span className="font-mono text-sm tracking-wide text-emerald-400">#{dbUserId || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-200 mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                                <BadgeCheck size={18} className="text-purple-400" /> Academic Info
                            </h3>
                            <div className="bg-slate-900/30 p-6 rounded-xl border border-dashed border-slate-700 text-center">
                                <p className="text-slate-500 text-sm">
                                    {userRole === 'student'
                                        ? "Student academic details will appear here once linked."
                                        : "Administrative profile settings."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
