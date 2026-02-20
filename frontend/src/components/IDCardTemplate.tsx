import React from 'react';
import { User } from 'lucide-react';

interface IDCardProps {
    student: any;
}

const IDCardTemplate: React.FC<IDCardProps> = ({ student }) => {
    return (
        <div className="w-[85.6mm] h-[53.98mm] bg-white border border-black relative overflow-hidden page-break-inside-avoid mb-4 mx-auto">
            {/* Background Pattern - Removed Gradient */}
            {/* <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-white z-0 opacity-50"></div> */}

            {/* Bars Removed */}

            <div className="relative z-20 flex flex-col h-full p-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-white border border-black rounded-full flex items-center justify-center text-black">
                        <User size={20} />
                    </div>
                    <div>
                        <h2 className="text-xs font-bold text-black uppercase tracking-wider">Coaching Mgmt System</h2>
                    </div>
                </div>

                {/* Content */}
                <div className="flex gap-4 mt-2">
                    {/* Left Column */}
                    <div className="flex-1 space-y-2">
                        <div>
                            <p className="text-[9px] text-black uppercase font-medium">Name</p>
                            <p className="text-sm font-bold text-black leading-tight">{student.name}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-black uppercase font-medium">ID No</p>
                            <p className="text-xs font-mono font-bold text-black">{student.student_code || student.student_id}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-black uppercase font-medium">Class</p>
                            <p className="text-xs font-bold text-black">{student.class}</p>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="flex-1 space-y-2 text-right">
                        <div>
                            <p className="text-[9px] text-black uppercase font-medium">Father's Name</p>
                            <p className="text-xs font-bold text-black leading-tight">{student.fathers_name || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-black uppercase font-medium">Institution</p>
                            <p className="text-xs font-bold text-black leading-tight">{student.school || student.institution || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-black uppercase font-medium">Contact</p>
                            <p className="text-xs font-bold text-black">{student.contact}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IDCardTemplate;
