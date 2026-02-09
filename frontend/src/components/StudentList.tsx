import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { Search, Filter, Plus, ChevronRight, Download, Upload } from 'lucide-react';
import CreateStudentModal from './CreateStudentModal';
import ImportStudentModal from './ImportStudentModal';
interface Student {
    student_id: number;
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
}

const StudentList: React.FC<StudentListProps> = ({ fixedBatchId }) => {
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
            // Clear param to prevent reopening on refresh? 
            // Or keep it? Standard UX: usually consume it.
            // But setSearchParams might re-trigger render.
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Student Directory</h1>
                    <p className="text-gray-500 text-sm">{filteredStudents.length} Students Found</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                        <Download size={18} />
                        <span className="hidden md:inline">Export</span>
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
                    >
                        <Upload size={18} />
                        <span className="hidden md:inline">Import</span>
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={18} />
                        <span className="hidden md:inline">Add Student</span>
                    </button>
                </div>
            </div>

            {/* FILTERS BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search Name or ID..."
                        className="pl-10 w-full rounded-lg border-gray-300 border p-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Roll No Search */}
                <div className="relative w-[150px]">
                    <input
                        type="text"
                        placeholder="Roll No..."
                        className="w-full rounded-lg border-gray-300 border p-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={rollSearch}
                        onChange={(e) => setRollSearch(e.target.value)}
                    />
                </div>

                {/* Class Filter */}
                <select
                    className="rounded-lg border-gray-300 border p-2 text-gray-700 bg-white"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                >
                    <option value="">All Classes</option>
                    {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>Class {i + 1}</option>
                    ))}
                </select>

                {/* Batch Filter (Hide if Fixed) */}
                {!fixedBatchId && (
                    <select
                        className="rounded-lg border-gray-300 border p-2 text-gray-700 bg-white"
                        value={batchFilter}
                        onChange={(e) => setBatchFilter(e.target.value)}
                    >
                        <option value="">All Batches</option>
                        {batches?.map((b: any) => (
                            <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>
                        ))}
                    </select>
                )}

                {/* Program Filter */}
                <select
                    className="rounded-lg border-gray-300 border p-2 text-gray-700 bg-white max-w-[200px]"
                    value={programFilter}
                    onChange={(e) => setProgramFilter(e.target.value)}
                >
                    <option value="">All Programs</option>
                    {allPrograms?.map((p: any) => (
                        <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
                    ))}
                </select>
            </div>

            {/* DATA TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                        <tr>
                            <th className="p-4 border-b">ID</th>
                            <th className="p-4 border-b">Student Name</th>
                            <th className="p-4 border-b">Enrolled Programs (Roll)</th>
                            <th className="p-4 border-b">Father's Name</th>
                            {/* <th className="p-4 border-b">Roll No</th> REMOVED */}
                            <th className="p-4 border-b">Class</th>
                            <th className="p-4 border-b">School</th>
                            <th className="p-4 border-b">Contact</th>
                            <th className="p-4 border-b text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredStudents.length > 0 ? (
                            filteredStudents.map((student: Student) => (
                                <tr key={student.student_id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-4 text-gray-500 text-sm">#{student.student_id}</td>
                                    <td className="p-4 font-medium text-gray-900">{student.name}</td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            {student.enrollment?.map((enroll, idx) => (
                                                <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 text-gray-700 whitespace-nowrap">
                                                    <span className="font-bold">{enroll.roll_no || 'N/A'}</span> - {enroll.program?.program_name}
                                                </span>
                                            ))}
                                            {(!student.enrollment || student.enrollment.length === 0) && <span className="text-gray-400 text-xs italic">Not Enrolled</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-600 text-sm">{student.fathers_name || '-'}</td>
                                    {/* <td className="p-4 text-gray-600 font-mono text-sm">{student.roll_no}</td> REMOVED */}
                                    <td className="p-4">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">
                                            Class {student.class}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600 text-sm">{student.school || '-'}</td>
                                    <td className="p-4 text-gray-600 text-sm">{student.contact || '-'}</td>
                                    <td className="p-4 text-right">
                                        <Link
                                            to={`/students/${student.student_id}`}
                                            className="inline-block text-gray-400 hover:text-blue-600 transition-colors p-2 rounded-full hover:bg-blue-50"
                                        >
                                            <ChevronRight size={20} />
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                    No students found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
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