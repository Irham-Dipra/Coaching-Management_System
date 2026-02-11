import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, CheckCircle, KeyRound, ArrowRight } from 'lucide-react';

const Signup: React.FC = () => {
    // Form States
    const [step, setStep] = useState<1 | 2>(1); // 1: Details, 2: OTP
    const [role, setRole] = useState('Student');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');

    // UI States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Step 1: Request Signup (Send OTP)
    const handleInitialSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Check if user already exists (optional, handled by Supabase but good UX to catch early)
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role
                    },
                },
            });

            if (error) throw error;

            // If successful, move to OTP step
            setStep(2);
        } catch (err: any) {
            setError(err.message || 'Failed to initiate signup');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'signup'
            });

            if (error) throw error;
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Invalid or expired OTP');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Background Decorations */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/20 rounded-full blur-[100px]"></div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md text-center relative z-10 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <CheckCircle className="text-emerald-400" size={40} />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">Registration Successful!</h2>

                    {role === 'Student' ? (
                        <p className="text-slate-300 mb-8 leading-relaxed">
                            Welcome, <strong className="text-white">{fullName}</strong>! Your student account has been created.
                            You can now log in to access your dashboard.
                        </p>
                    ) : (
                        <p className="text-slate-300 mb-8 leading-relaxed">
                            Your request to join as <strong className="text-white">{role}</strong> has been submitted.
                            <br /><br />
                            <span className="bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold uppercase border border-yellow-500/20 tracking-wider">Pending Approval</span>
                            <br /><br />
                            For security, an administrator must manually approve your account before you can log in.
                        </p>
                    )}

                    <Link to="/login" className="inline-block w-full bg-blue-600 text-white px-6 py-3.5 rounded-lg font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-900/20">
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[100px]"></div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-300">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
                    <p className="text-slate-400">
                        {step === 1 ? 'Step 1: Enter Details' : 'Step 2: Verify Email'}
                    </p>
                    {/* Progress Bar */}
                    <div className="flex justify-center gap-2 mt-4">
                        <div className={`h-1.5 w-16 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                        <div className={`h-1.5 w-16 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6 text-sm border border-red-500/20 flex items-center gap-2">
                        <span>•</span> {error}
                    </div>
                )}

                {step === 1 ? (
                    <form onSubmit={handleInitialSignup} className="space-y-5">
                        {/* Role Selection */}
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2 ml-1">I am a...</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['Student', 'Teacher'].map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRole(r)}
                                        className={`p-3 rounded-xl border text-sm font-bold transition-all ${role === r
                                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20'
                                            : 'bg-slate-900/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                                            }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1.5 ml-1">Full Name</label>
                            <div className="relative group">
                                <User className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-10 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-1.5 ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-10 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                    placeholder="you@example.com"
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
                                    minLength={6}
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
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3.5 rounded-lg font-bold hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed mt-4"
                        >
                            {loading ? 'Sending OTP...' : <>Next Step <ArrowRight size={18} /></>}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg text-sm text-blue-300 mb-4 flex items-start gap-3">
                            <div className="bg-blue-500/20 p-1.5 rounded-full mt-0.5">
                                <Mail size={16} />
                            </div>
                            <span>
                                We sent a verification code to <strong className="text-white">{email}</strong>. Please enter the 6-digit code below.
                            </span>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2 ml-1">Verification Code (OTP)</label>
                            <div className="relative group">
                                <KeyRound className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-10 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all font-mono tracking-[0.5em] text-lg text-center"
                                    placeholder="123456"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    maxLength={6}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white py-3.5 rounded-lg font-bold hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 mt-2"
                        >
                            {loading ? 'Verifying...' : 'Verify & Create Account'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="w-full text-slate-500 text-sm hover:text-white transition-colors"
                        >
                            Change Email / Back
                        </button>
                    </form>
                )}

                <div className="mt-8 text-center text-sm text-slate-400 pt-6 border-t border-slate-700/50">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-400 font-bold hover:text-blue-300 hover:underline transition-colors">
                        Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Signup;
