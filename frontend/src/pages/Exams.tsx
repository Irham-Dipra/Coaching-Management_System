import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExamRepository } from '../repositories/ExamRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { Search, Filter, FileText, Calendar } from 'lucide-react';

import CreateExamModal from '../components/CreateExamModal';
import { Plus } from 'lucide-react';

const Exams: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProgram, setSelectedProgram] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const { data: exams, isLoading: isExamsLoading } = useQuery({
        queryKey: ['all-exams'],
        queryFn: ExamRepository.getAllExams
    });

    const { data: programs } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms
    });

    if (isExamsLoading) return <div className="p-8">Loading exams...</div>;

    // Filter Logic
    const filteredExams = exams?.filter((exam: any) => {
        const matchesSearch = exam.exam_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            exam.program?.program_name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesProgram = selectedProgram ? exam.program_id === parseInt(selectedProgram) : true;

        return matchesSearch && matchesProgram;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Exam Directory</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                    >
                        <Plus size={18} /> Schedule Exam
                    </button>
                </div>
            </div>

            {/* SEARCH BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by Exam Name..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 border rounded-lg px-3 bg-white">
                    <Filter size={20} className="text-gray-400" />
                    <select
                        className="p-2 bg-transparent outline-none text-gray-700 min-w-[200px]"
                        value={selectedProgram}
                        onChange={(e) => setSelectedProgram(e.target.value)}
                    >
                        <option value="">All Programs</option>
                        {programs?.map((p: any) => (
                            <option key={p.program_id} value={p.program_id}>
                                {p.program_name} ({p.batch?.batch_name})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* EXAM LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExams?.map((exam: any) => (
                    <Link
                        to={`/exams/${exam.exam_id}`}
                        key={exam.exam_id}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${exam.exam_type === 'Term' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {exam.exam_type}
                            </span>
                            <span className="text-gray-400 text-xs font-mono">#{exam.exam_id}</span>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {exam.exam_name}
                        </h3>

                        <div className="mt-4 space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <FileText size={16} className="text-gray-400" />
                                <span>{exam.program?.program_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-gray-400" />
                                <span>{exam.exam_date || 'No Date Set'}</span>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold uppercase">{exam.program?.batch?.batch_name}</span>
                            <span className="text-sm font-bold text-gray-900">Marks: {exam.total_marks}</span>
                        </div>
                    </Link>
                ))}

                {filteredExams?.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        No exams found matching your search.
                    </div>
                )}
            </div>

            {/* Create Modal Reused */}
            <CreateExamModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
            />
        </div>
    );
};

export default Exams;
