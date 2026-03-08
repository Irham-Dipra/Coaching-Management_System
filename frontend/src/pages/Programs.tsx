import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import CreateProgramModal from '../components/CreateProgramModal';
import { Plus, Users, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Program {
    program_id: number;
    program_name: string;
    monthly_fee: number;
    start_date: string;
    end_date: string;
    batch: {
        batch_name: string;
    };
    student_count?: number; // Added from Backend
}

const Programs: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 1. Fetch Programs
    const { data: programs, isLoading, error } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });

    if (isLoading) {
        return (
            <div>
                {/* Skeleton Header */}
                <div className="flex justify-between items-center mb-6 animate-fade-in">
                    <div>
                        <div className="h-8 w-48 bg-slate-800 rounded-lg animate-pulse mb-2"></div>
                        <div className="h-4 w-64 bg-slate-800 rounded-lg animate-pulse"></div>
                    </div>
                    <div className="h-10 w-32 bg-slate-800 rounded-xl animate-pulse"></div>
                </div>

                {/* Skeleton Grid Layer */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-slate-800/20 p-6 rounded-2xl border border-slate-700/30 animate-pulse h-56 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-slate-700/50 rounded-xl"></div>
                                <div className="h-6 w-20 bg-slate-700/50 rounded-full"></div>
                            </div>
                            <div className="h-6 w-3/4 bg-slate-700/50 rounded mb-4"></div>
                            <div className="h-4 w-1/2 bg-slate-700/50 rounded mb-6"></div>
                            <div className="flex justify-between items-center border-t border-slate-700/50 pt-4">
                                <div className="h-8 w-16 bg-slate-700/50 rounded"></div>
                                <div className="h-8 w-24 bg-slate-700/50 rounded-lg"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    if (error) return <div className="p-8 text-center text-red-400">Failed to load programs.</div>;

    const programList = programs || [];

    return (
        <div>
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6 animate-fade-in">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Academic Programs
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Manage your courses, batches, and fees.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                >
                    <Plus size={18} />
                    <span>New Program</span>
                </button>
            </div>

            {/* GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {programList.map((program: Program, index: number) => (
                    <div
                        key={program.program_id}
                        className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 p-6 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-1 group animate-slide-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                                <BookOpen size={24} />
                            </div>
                            <span className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full text-xs font-medium border border-slate-600">
                                {program.batch ? program.batch.batch_name : 'No Batch'}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{program.program_name}</h3>

                        <div className="space-y-3 mb-6">
                            <div className="flex items-center text-slate-400 text-sm">
                                <Users size={16} className="mr-2 text-slate-500" />
                                <span className="font-medium">
                                    {program.student_count && program.student_count > 0
                                        ? `${program.student_count} Students Enrolled`
                                        : 'No Students Enrolled'}
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Monthly Fee</p>
                                <p className="text-lg font-bold text-emerald-400">৳{program.monthly_fee}</p>
                            </div>
                            <Link
                                to={`/programs/${program.program_id}`}
                                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors"
                            >
                                View Details
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {/* EMPTY STATE */}
            {programList.length === 0 && (
                <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                    <BookOpen size={48} className="mx-auto text-slate-600 mb-4" />
                    <p className="text-slate-400 text-lg">No programs found.</p>
                    <p className="text-slate-500 text-sm">Create your first program to get started.</p>
                </div>
            )}

            {/* MODAL */}
            <CreateProgramModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
};

export default Programs;
