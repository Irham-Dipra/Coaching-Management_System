import React from 'react';
import { User } from 'lucide-react';

interface IDCardProps {
    student: any;
}

const IDCardTemplate: React.FC<IDCardProps> = ({ student }) => {
    return (
        <div className="w-[85.6mm] h-[53.98mm] bg-white border border-slate-200 relative overflow-hidden print:border-slate-400 page-break-inside-avoid shadow-sm print:shadow-none mb-4 mx-auto">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-white z-0 opacity-50"></div>
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600 z-10"></div>
            <div className="absolute bottom-0 left-0 w-full h-2 bg-slate-800 z-10"></div>

            <div className="relative z-20 flex flex-col h-full p-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <User size={20} />
                    </div>
                    <div>
                        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Science Point</h2>
                        <p className="text-[9px] text-slate-500 font-bold uppercase">by Dr. Talha</p>
                    </div>
                </div>

                {/* Content */}
                {/* Content */}
                <div className="flex gap-4 mt-2">
                    {/* Left Column */}
                    <div className="flex-1 space-y-2">
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase">Name</p>
                            <p className="text-sm font-bold text-slate-800 leading-tight">{student.name}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase">ID No</p>
                            <p className="text-xs font-mono font-bold text-blue-600">{student.student_code || student.student_id}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase">Class</p>
                            <p className="text-xs font-medium text-slate-700">{student.class}</p>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="flex-1 space-y-2 text-right">
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase">Father's Name</p>
                            <p className="text-xs font-medium text-slate-800 leading-tight">{student.fathers_name || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase">Institution</p>
                            <p className="text-xs font-medium text-slate-700 leading-tight">{student.school || student.institution || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase">Contact</p>
                            <p className="text-xs font-medium text-slate-700">{student.contact}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IDCardTemplate;
