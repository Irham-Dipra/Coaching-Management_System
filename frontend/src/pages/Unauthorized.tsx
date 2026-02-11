import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Unauthorized: React.FC = () => {
    const { signOut } = useAuth();

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-red-500/20 w-full max-w-md text-center relative z-10 animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <ShieldAlert className="text-red-500" size={40} />
                </div>

                <h1 className="text-3xl font-bold text-white mb-2">Access Restricted</h1>

                <p className="text-slate-400 mb-8 leading-relaxed">
                    You do not have permission to view this page. <br />
                    Please contact an administrator or sign in with a different account.
                </p>

                <button
                    onClick={signOut}
                    className="inline-flex items-center gap-2 bg-slate-700 text-white px-6 py-3 rounded-lg hover:bg-slate-600 hover:text-white border border-slate-600 transition-all shadow-lg shadow-black/20"
                >
                    <LogOut size={18} /> Sign Out
                </button>
            </div>
        </div>
    );
};

export default Unauthorized;
