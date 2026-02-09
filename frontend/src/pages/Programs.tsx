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
    });

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading academic programs...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Failed to load programs.</div>;

    const programList = programs || [];

    return (
        <div>
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Academic Programs</h1>
                    <p className="text-gray-500 text-sm">Manage your courses, batches, and fees.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                    <Plus size={18} />
                    <span>New Program</span>
                </button>
            </div>

            {/* GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {programList.map((program: Program) => (
                    <div key={program.program_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <BookOpen size={24} />
                            </div>
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">
                                {program.batch ? program.batch.batch_name : 'No Batch'}
                            </span>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 mb-2">{program.program_name}</h3>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center text-gray-500 text-sm">
                                <Users size={16} className="mr-2" />
                                <span className="font-medium">
                                    {program.student_count && program.student_count > 0
                                        ? `${program.student_count} Students Enrolled`
                                        : 'No Students Enrolled'}
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Monthly Fee</p>
                                <p className="text-lg font-bold text-gray-900">৳{program.monthly_fee}</p>
                            </div>
                            <Link
                                to={`/programs/${program.program_id}`}
                                className="text-blue-600 text-sm font-medium hover:underline"
                            >
                                View Details
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {/* EMPTY STATE */}
            {programList.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500">No programs found. Create your first one!</p>
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
