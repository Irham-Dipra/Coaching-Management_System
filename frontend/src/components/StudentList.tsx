import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { Search, Plus, ChevronRight, Download, Upload } from 'lucide-react';
import CreateStudentModal from './CreateStudentModal';
import ImportStudentModal from './ImportStudentModal';
interface Student {
    student_id: number;
    student_code?: string;
    name: string;
    class: number;
    fathers_name?: string;
    school?: string;
    contact?: string;
    batch_id?: number;
    batch?: { batch_name: string; };
    enrollment?: { program_id: number; roll_no?: string; program?: { program_name: string; }; }[]; // Enrollment Info
}

interface StudentListProps {
    fixedBatchId?: string; // Optional: If provided, locks the list to this batch
    hideHeader?: boolean; // Optional: Hide the top header
}

const StudentList: React.FC<StudentListProps> = ({ fixedBatchId, hideHeader }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [rollSearch, setRollSearch] = useState(''); // New separate search
    const [batchFilter, setBatchFilter] = useState(fixedBatchId || '');
    const [classFilter, setClassFilter] = useState(''); // New
    const [programFilter, setProgramFilter] = useState(''); // New
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false); // New

    // Auto-Action Logic
    const [searchParams, setSearchParams] = useSearchParams();

    React.useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setIsModalOpen(true);
            setSearchParams(params => {
                params.delete('action');
                return params;
            });
        }
    }, [searchParams, setSearchParams]);

    // Fetch Students
    const { data: students, isLoading, error } = useQuery({
        queryKey: ['students'],
        queryFn: StudentRepository.getAllStudents,
    });

    // Fetch Batches
    const { data: batches } = useQuery({
        queryKey: ['batches'],
        queryFn: ProgramRepository.getAllBatches
    });

    // Fetch Programs (New)
    const { data: allPrograms } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms
    });

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading directory...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Failed to load students.</div>;

    const studentList = students || [];

    // Filter Logic
    const filteredStudents = studentList.filter((s: Student) => {
        const term = searchTerm.toLowerCase();
        const rollTerm = rollSearch.toLowerCase();

        // 1. Main Search: Name or ID
        const matchesMain = s.name.toLowerCase().includes(term) ||
            s.student_id.toString().includes(term);

        // 2. Roll Number Search (Separate)
        let matchesRoll = true; // Default true if no roll search term
        if (rollTerm) {
            if (programFilter) {
                // If program selected, check THAT program's roll
                const enrollment = s.enrollment?.find(e => e.program_id.toString() === programFilter);
                matchesRoll = enrollment?.roll_no?.toString().toLowerCase().includes(rollTerm) || false;
            } else {
                // Check ANY program's roll
                matchesRoll = s.enrollment?.some(e => e.roll_no && e.roll_no.toString().toLowerCase().includes(rollTerm)) || false;
            }
        }

        const matchesBatch = batchFilter ? s.batch_id?.toString() === batchFilter : true;
        const matchesClass = classFilter ? s.class?.toString() === classFilter : true;

        // Check if student is enrolled in the selected program
        const matchesProgram = programFilter ?
            s.enrollment?.some(e => e.program_id.toString() === programFilter) : true;

        return matchesMain && matchesRoll && matchesBatch && matchesClass && matchesProgram;
    });

    const handleExport = () => {
        // Simple CSV Export
        const headers = ["ID", "Name", "Father's Name", "Class", "School", "Contact", "Batch"];
        const rows = filteredStudents.map((s: Student) => [
            s.student_id,
            s.name,
            s.fathers_name || '',
            s.class,
            s.school || '',
            s.contact || '',
            s.batch?.batch_name || ''
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((r: any[]) => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "student_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* HEADER & ACTIONS */}
            {!hideHeader && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            Student Directory
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">{filteredStudents.length} Students Found</p>
                    </div>
                </div>
            )}

            {/* ACTIONS ROW (Always Visible or grouped?) - Let's keep actions visible but maybe aligned differently if header hidden */}
            <div className={`flex justify-end gap-3 ${hideHeader ? 'mb-4' : ''}`}>
                <button
                    onClick={handleExport}
                    className="bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-all shadow-lg"
                >
                    <Download size={18} />
                    <span className="hidden md:inline font-medium">Export</span>
                </button>
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5"
                >
                    <Upload size={18} />
                    <span className="hidden md:inline font-bold">Import</span>
                </button>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                >
                    <Plus size={18} />
                    <span className="hidden md:inline font-bold">Add Student</span>
                </button>
            </div>

            {/* FILTERS BAR */}
            <div className="bg-slate-800/50 backdrop-blur-md p-5 rounded-2xl shadow-xl border border-slate-700 flex flex-col md:flex-row gap-4 flex-wrap animate-slide-up">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-3 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search Name or ID..."
                        className="pl-10 w-full rounded-xl border-slate-700 border bg-slate-900/50 p-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Roll No Search */}
                <div className="relative w-[150px]">
                    <input
                        type="text"
                        placeholder="Roll No..."
                        className="w-full rounded-xl border-slate-700 border bg-slate-900/50 p-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600"
                        value={rollSearch}
                        onChange={(e) => setRollSearch(e.target.value)}
                    />
                </div>

                {/* Class Filter */}
                <select
                    className="rounded-xl border-slate-700 border bg-slate-900/50 p-2.5 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                >
                    <option value="" className="bg-slate-900">All Classes</option>
                    {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1} className="bg-slate-900">Class {i + 1}</option>
                    ))}
                </select>

                {/* Batch Filter (Hide if Fixed) */}
                {!fixedBatchId && (
                    <select
                        className="rounded-xl border-slate-700 border bg-slate-900/50 p-2.5 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        value={batchFilter}
                        onChange={(e) => setBatchFilter(e.target.value)}
                    >
                        <option value="" className="bg-slate-900">All Batches</option>
                        {batches?.map((b: any) => (
                            <option key={b.batch_id} value={b.batch_id} className="bg-slate-900">{b.batch_name}</option>
                        ))}
                    </select>
                )}

                {/* Program Filter */}
                <select
                    className="rounded-xl border-slate-700 border bg-slate-900/50 p-2.5 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 max-w-[200px]"
                    value={programFilter}
                    onChange={(e) => setProgramFilter(e.target.value)}
                >
                    <option value="" className="bg-slate-900">All Programs</option>
                    {allPrograms?.map((p: any) => (
                        <option key={p.program_id} value={p.program_id} className="bg-slate-900">{p.program_name}</option>
                    ))}
                </select>
            </div>

            {/* DATA TABLE */}
            <div className="bg-slate-800/30 rounded-2xl shadow-xl border border-slate-700 overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold border-b border-slate-700">
                            <tr>
                                <th className="p-4 border-b border-slate-700/50">ID</th>
                                <th className="p-4 border-b border-slate-700/50">Student Name</th>
                                <th className="p-4 border-b border-slate-700/50">Enrolled Programs (Roll)</th>
                                <th className="p-4 border-b border-slate-700/50">Father's Name</th>
                                <th className="p-4 border-b border-slate-700/50">Class</th>
                                <th className="p-4 border-b border-slate-700/50">School</th>
                                <th className="p-4 border-b border-slate-700/50">Contact</th>
                                <th className="p-4 border-b border-slate-700/50 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map((student: Student) => (
                                    <tr key={student.student_id} className="hover:bg-slate-700/30 transition-colors group">
                                        <td className="p-4 text-slate-500 text-sm">#{student.student_code || student.student_id}</td>
                                        <td className="p-4 font-bold text-slate-200">
                                            <Link to={`/students/${student.student_id}`} className="hover:text-blue-400 transition-colors">
                                                {student.name}
                                            </Link>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1.5">
                                                {student.enrollment?.map((enroll, idx) => (
                                                    <span key={idx} className="text-xs bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 text-slate-300 whitespace-nowrap inline-block w-fit">
                                                        <span className="font-bold text-blue-400">{enroll.roll_no || 'N/A'}</span> • <span className="text-slate-400">{enroll.program?.program_name}</span>
                                                    </span>
                                                ))}
                                                {(!student.enrollment || student.enrollment.length === 0) && <span className="text-slate-600 text-xs italic">Not Enrolled</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">{student.fathers_name || '-'}</td>
                                        <td className="p-4">
                                            <span className="bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md text-xs font-bold border border-blue-500/20">
                                                {student.class}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">{student.school || '-'}</td>
                                        <td className="p-4 text-slate-400 text-sm font-mono">{student.contact || '-'}</td>
                                        <td className="p-4 text-right">
                                            <Link
                                                to={`/students/${student.student_id}`}
                                                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-blue-600 transition-all"
                                            >
                                                <ChevronRight size={18} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-500">
                                        <Search size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="text-lg">No students found matching your filters.</p>
                                        <p className="text-sm opacity-60">Try adjusting your search criteria.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODALS */}
            <CreateStudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
            <ImportStudentModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />
        </div>
    );
};

export default StudentList;