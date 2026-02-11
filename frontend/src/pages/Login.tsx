import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: { session }, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (session) {
                // Fetch profile from public.users using auth_id
                const { data: profile, error: profileError } = await supabase
                    .from('users')
                    .select('role_id')
                    .eq('auth_id', session.user.id)
                    .single();

                if (profileError || !profile) {
                    // No profile found — sign them out
                    await supabase.auth.signOut();
                    setError('Access Denied: No administrator profile found for this account.');
                    return;
                }

                if (profile.role_id !== 1) {
                    // Not an admin — sign them out
                    await supabase.auth.signOut();
                    setError('Access Denied: This system is restricted to authorized administrators only.');
                    return;
                }

                // Admin verified — proceed to dashboard
                navigate('/');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[100px]"></div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-300">
                {/* Branding */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                        <ShieldCheck className="text-blue-400" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-1">Science Point</h1>
                    <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">by Dr. Talha</p>
                    <p className="text-slate-400 mt-3 text-sm">Administrator Login</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6 text-sm border border-red-500/20 flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-1.5 ml-1">Email Address</label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                            <input
                                type="email"
                                required
                                className="w-full pl-10 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                placeholder="admin@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-1.5 ml-1">Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                            <input
                                type="password"
                                required
                                className="w-full pl-10 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3.5 rounded-lg font-bold hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? 'Authenticating...' : <><LogIn size={20} /> Sign In</>}
                    </button>
                </form>

                <div className="mt-8 text-center text-xs text-slate-600 pt-6 border-t border-slate-700/50">
                    Restricted to authorized administrators only.
                </div>
            </div>
        </div>
    );
};

export default Login;
