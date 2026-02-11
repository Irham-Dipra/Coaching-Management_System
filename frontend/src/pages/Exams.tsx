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

    if (isExamsLoading) return <div className="p-8 text-slate-400">Loading exams...</div>;

    // Filter Logic
    const filteredExams = exams?.filter((exam: any) => {
        // Extract program names from the nested structure for searching
        const programNames = exam.program_exam?.map((pe: any) => pe.program?.program_name).join(' ').toLowerCase() || '';

        const matchesSearch = exam.exam_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            programNames.includes(searchQuery.toLowerCase());

        // Check if any of the linked programs match the selection
        const matchesProgram = selectedProgram
            ? exam.program_exam?.some((pe: any) => pe.program?.program_id === parseInt(selectedProgram))
            : true;

        return matchesSearch && matchesProgram;
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Exam Directory</h1>
                    <p className="text-slate-400 mt-1">Manage schedules, marks, and results</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-500 hover:scale-105 shadow-lg shadow-blue-500/20 flex items-center gap-2 font-bold transition-all"
                    >
                        <Plus size={20} /> Schedule Exam
                    </button>
                </div>
            </div>

            {/* SEARCH BAR */}
            <div className="bg-slate-800/50 backdrop-blur-md p-4 rounded-xl shadow-lg border border-slate-700/50 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by Exam Name..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none text-slate-200 placeholder-slate-500 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 border border-slate-700/50 rounded-lg px-3 bg-slate-900/50">
                    <Filter size={20} className="text-slate-400" />
                    <select
                        className="p-3 bg-transparent outline-none text-slate-300 min-w-[200px]"
                        value={selectedProgram}
                        onChange={(e) => setSelectedProgram(e.target.value)}
                    >
                        <option value="" className="bg-slate-900">All Programs</option>
                        {programs?.map((p: any) => (
                            <option key={p.program_id} value={p.program_id} className="bg-slate-900">
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
                        className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-slate-700/50 hover:border-blue-500/50 hover:shadow-blue-500/10 hover:-translate-y-1 transition-all group flex flex-col h-full"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${exam.exam_type === 'Term'
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}>
                                {exam.exam_type}
                            </span>
                            <span className="text-slate-500 text-xs font-mono">#{exam.exam_id}</span>
                        </div>

                        <h3 className="text-xl font-bold text-slate-100 group-hover:text-blue-400 transition-colors mb-2">
                            {exam.exam_name}
                        </h3>

                        <div className="space-y-3 flex-1">
                            {/* Programs Tags */}
                            <div className="flex flex-wrap gap-1.5">
                                <FileText size={14} className="text-slate-500 shrink-0 mt-1" />
                                {exam.program_exam?.map((pe: any) => (
                                    <span key={pe.program?.program_id} className="bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded text-xs border border-slate-600/50">
                                        {pe.program?.program_name}
                                    </span>
                                ))}
                                {(!exam.program_exam || exam.program_exam.length === 0) && <span className="text-slate-500 italic text-xs">No Program Linked</span>}
                            </div>

                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Calendar size={14} />
                                <span>{exam.exam_date || 'No Date Set'}</span>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-700/50 flex justify-between items-center text-sm">
                            <span className="text-slate-400 font-medium">Total Marks</span>
                            <span className="font-bold text-white bg-slate-700/50 px-3 py-1 rounded-lg border border-slate-600/30">
                                {exam.total_marks}
                            </span>
                        </div>
                    </Link>
                ))}

                {filteredExams?.length === 0 && (
                    <div className="col-span-full text-center py-20 bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-700/50 text-slate-500">
                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No exams found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
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
