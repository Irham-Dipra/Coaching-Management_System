import React from 'react';
import {
    Plus,
    CreditCard,
    Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
    return (
        <div className="min-h-[calc(100vh-80px)] bg-slate-900 text-white p-6 md:p-10 flex flex-col items-center justify-center font-sans">
            {/* Header */}
            <div className="text-center mb-12 animate-fade-in -mt-16">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
                    What would you like to do today?
                </h1>
            </div>

            {/* Quick Actions */}
            <div className="w-full max-w-5xl animate-slide-up">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* New Student Action */}
                    <Link to="/students?action=new" className="group p-8 bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-3xl hover:bg-blue-600/10 hover:border-blue-500/50 transition-all duration-300 flex flex-col items-center text-center gap-5 shadow-xl hover:shadow-blue-500/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="p-5 bg-blue-500/20 rounded-2xl text-blue-400 group-hover:text-blue-300 group-hover:scale-110 group-hover:-rotate-3 transition-all">
                            <Plus size={36} strokeWidth={2.5} />
                        </div>
                        <div className="relative z-10">
                            <h4 className="font-bold text-xl text-slate-200 group-hover:text-white mb-2">New Student</h4>
                            <p className="text-sm text-slate-400 group-hover:text-slate-300">Quickly register a new student to a program.</p>
                        </div>
                    </Link>

                    {/* Record Single Payment Action */}
                    <Link to="/finance?action=payment" className="group p-8 bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-3xl hover:bg-emerald-600/10 hover:border-emerald-500/50 transition-all duration-300 flex flex-col items-center text-center gap-5 shadow-xl hover:shadow-emerald-500/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="p-5 bg-emerald-500/20 rounded-2xl text-emerald-400 group-hover:text-emerald-300 group-hover:scale-110 group-hover:-rotate-3 transition-all">
                            <CreditCard size={36} strokeWidth={2.5} />
                        </div>
                        <div className="relative z-10">
                            <h4 className="font-bold text-xl text-slate-200 group-hover:text-white mb-2">Record Single Payment</h4>
                            <p className="text-sm text-slate-400 group-hover:text-slate-300">Add an individual fee collection receipt.</p>
                        </div>
                    </Link>

                    {/* Record Batch Payment Action */}
                    <Link to="/finance?action=batch_payment" className="group p-8 bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-3xl hover:bg-indigo-600/10 hover:border-indigo-500/50 transition-all duration-300 flex flex-col items-center text-center gap-5 shadow-xl hover:shadow-indigo-500/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="p-5 bg-indigo-500/20 rounded-2xl text-indigo-400 group-hover:text-indigo-300 group-hover:scale-110 group-hover:-rotate-3 transition-all">
                            <Layers size={36} strokeWidth={2.5} />
                        </div>
                        <div className="relative z-10">
                            <h4 className="font-bold text-xl text-slate-200 group-hover:text-white mb-2">Record Batch Payment</h4>
                            <p className="text-sm text-slate-400 group-hover:text-slate-300">Fast fee collection for a whole class or batch.</p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
