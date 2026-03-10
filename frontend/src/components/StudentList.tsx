import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { Search, Plus, ChevronRight, ChevronLeft, Upload, Printer, SquareCheck, Square, X, Users } from 'lucide-react';
import CreateStudentModal from './CreateStudentModal';
import ImportStudentModal from './ImportStudentModal';
import IDCardTemplate from './IDCardTemplate';

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
    enrollment?: { program_id: number; roll_no?: string; program?: { program_name: string; }; status?: string }[];
}

interface StudentListProps {
    fixedBatchId?: string;
    hideHeader?: boolean;
}

const StudentList: React.FC<StudentListProps> = ({ fixedBatchId, hideHeader }) => {
    // --- STATE: PAGINATION & FILTERS ---
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [searchTerm, setSearchTerm] = useState('');
    const [rollSearch, setRollSearch] = useState('');
    const [batchFilter, setBatchFilter] = useState(fixedBatchId || '');
    const [classFilter, setClassFilter] = useState('');
    const [programFilter, setProgramFilter] = useState('');
    const [sortBy, setSortBy] = useState<string>('student_code');
    const [sortDesc, setSortDesc] = useState<boolean>(false);

    // --- STATE: SELECTION (Persistent across pages) ---
    const [selectedStudents, setSelectedStudents] = useState<Map<number, Student>>(new Map());

    // --- STATE: MODALS & ACTIONS ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // --- STATE: PRINTING ---
    const printRef = useRef<HTMLDivElement>(null);
    const [singlePrintId, setSinglePrintId] = useState<number | null>(null);
    const [startPrint, setStartPrint] = useState(false);

    // --- AUTO-ACTION ---
    const [searchParams, setSearchParams] = useSearchParams();
    React.useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setIsModalOpen(true);
            setSearchParams(params => { params.delete('action'); return params; });
        }
    }, [searchParams, setSearchParams]);

    // --- FETCH DATA (PAGINATED) ---
    const { data: studentData, isLoading, error } = useQuery({
        queryKey: ['students', page, pageSize, searchTerm, rollSearch, classFilter, batchFilter, programFilter, sortBy, sortDesc],
        queryFn: () => StudentRepository.getStudentsPaginated(page, pageSize, searchTerm, rollSearch, {
            class: classFilter,
            batch_id: batchFilter,
            program_id: programFilter
        }, sortBy, sortDesc),
        placeholderData: keepPreviousData,
        staleTime: 30_000, // Consider data fresh for 30s — prevents redundant re-fetches on navigation
    });

    // Fetch Metadata
    const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: ProgramRepository.getAllBatches, staleTime: 5 * 60_000 });
    const { data: allPrograms } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms, staleTime: 5 * 60_000 });

    const students: Student[] = studentData?.data || [];
    const totalCount = studentData?.total_count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // --- PREFETCH NEXT PAGE ---
    const queryClient = useQueryClient();
    React.useEffect(() => {
        if (totalPages > page) {
            queryClient.prefetchQuery({
                queryKey: ['students', page + 1, pageSize, searchTerm, rollSearch, classFilter, batchFilter, programFilter, sortBy, sortDesc],
                queryFn: () => StudentRepository.getStudentsPaginated(page + 1, pageSize, searchTerm, rollSearch, {
                    class: classFilter,
                    batch_id: batchFilter,
                    program_id: programFilter
                }, sortBy, sortDesc),
                staleTime: 30_000,
            });
        }
    }, [page, pageSize, searchTerm, rollSearch, classFilter, batchFilter, programFilter, sortBy, sortDesc, totalPages, queryClient]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortDesc(!sortDesc);
        } else {
            setSortBy(field);
            setSortDesc(false);
        }
        setPage(1);
    };

    // --- SELECTION LOGIC ---
    const toggleStudent = (student: Student) => {
        setSelectedStudents(prev => {
            const newMap = new Map(prev);
            if (newMap.has(student.student_id)) {
                newMap.delete(student.student_id);
            } else {
                newMap.set(student.student_id, student);
            }
            return newMap;
        });
    };

    const toggleAllPage = () => {
        const allSelected = students.every(s => selectedStudents.has(s.student_id));
        setSelectedStudents(prev => {
            const newMap = new Map(prev);
            if (allSelected) {
                // Deselect current page
                students.forEach(s => newMap.delete(s.student_id));
            } else {
                // Select current page
                students.forEach(s => newMap.set(s.student_id, s));
            }
            return newMap;
        });
    };

    const clearSelection = () => setSelectedStudents(new Map());

    const isAllPageSelected = students.length > 0 && students.every(s => selectedStudents.has(s.student_id));

    // --- PRINT LOGIC ---
    // Calculate what to print FIRST to ensure it's ready
    const studentsToPrint = useMemo(() => {
        if (singlePrintId) {
            let s = students.find(s => s.student_id === singlePrintId);
            if (!s) s = selectedStudents.get(singlePrintId);
            return s ? [s] : [];
        }
        return Array.from(selectedStudents.values());
    }, [singlePrintId, selectedStudents, students]);

    const handlePrintRequest = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'Student_ID_Cards',
        pageStyle: `
            @page { size: A4; margin: 0; }
            @media print { 
                body { -webkit-print-color-adjust: exact; }
            }
        `,
        onAfterPrint: () => {
            setSinglePrintId(null);
            setStartPrint(false);
        }
    });

    // Trigger Print Effect
    React.useEffect(() => {
        if (startPrint && studentsToPrint.length > 0) {
            handlePrintRequest();
        }
    }, [startPrint, studentsToPrint, handlePrintRequest]);

    const triggerPrint = (singleId?: number) => {
        if (singleId) {
            setSinglePrintId(singleId);
        } else {
            setSinglePrintId(null);
        }
        setStartPrint(true);
    };

    if (error) return <div className="p-8 text-center text-red-500">Failed to load students.</div>;

    return (
        <div className="space-y-6">
            {/* HIDDEN PRINT COMPONENT */}
            <div className="fixed left-[-9999px] top-0 w-[210mm] overflow-hidden print:static print:w-auto print:overflow-visible">
                <div ref={printRef} className="bg-white text-black p-8">
                    {/* Grid Logic: 2 Cols = 8 cards per page usually (4 rows) */}
                    <div className="grid grid-cols-2 gap-4">
                        {studentsToPrint.map(student => (
                            <div key={student.student_id} className="break-inside-avoid">
                                <IDCardTemplate student={student} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>



            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                {/* LEFT SIDE: Title OR Selection Status */}
                <div className="flex items-center gap-4 min-h-[40px]">
                    {selectedStudents.size > 0 ? (
                        <div className="flex items-center gap-3 transition-all animate-fade-in">
                            <span className="text-slate-300 font-medium bg-blue-900/40 px-3 py-1.5 rounded-lg border border-blue-500/30">
                                {selectedStudents.size} Selected
                            </span>
                            <button onClick={clearSelection} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm">
                                <X size={14} /> Clear
                            </button>
                            <div className="h-6 w-px bg-slate-700 mx-2"></div>
                            <button
                                onClick={() => triggerPrint()}
                                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg flex items-center gap-2 hover:bg-blue-500 shadow-md transition-all text-sm font-bold"
                            >
                                <Printer size={16} />
                                Print ID Cards
                            </button>
                        </div>
                    ) : (
                        !hideHeader && (
                            <div className="animate-fade-in flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                                        Student Directory
                                    </h1>
                                    <p className="text-slate-400 text-sm mt-0.5">
                                        Manage students &bull; {totalCount} total found
                                    </p>
                                </div>
                            </div>
                        )
                    )}
                </div>

                {/* Right Actions */}
                <div className={`flex justify-end gap-3 ml-auto ${hideHeader ? 'mb-4' : ''}`}>
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
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    />
                </div>

                {/* Roll No Search */}
                <div className="relative w-[150px]">
                    <input
                        type="text"
                        placeholder="Roll No..."
                        className="w-full rounded-xl border-slate-700 border bg-slate-900/50 p-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600"
                        value={rollSearch}
                        onChange={(e) => { setRollSearch(e.target.value); setPage(1); }}
                    />
                </div>

                {/* Class Filter */}
                <select
                    className="rounded-xl border-slate-700 border bg-slate-900/50 p-2.5 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    value={classFilter}
                    onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
                >
                    <option value="" className="bg-slate-900">All Classes</option>
                    {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1} className="bg-slate-900">Class {i + 1}</option>
                    ))}
                </select>

                {/* Batch Filter */}
                {!fixedBatchId && (
                    <select
                        className="rounded-xl border-slate-700 border bg-slate-900/50 p-2.5 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        value={batchFilter}
                        onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}
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
                    onChange={(e) => { setProgramFilter(e.target.value); setPage(1); }}
                >
                    <option value="" className="bg-slate-900">All Programs</option>
                    {allPrograms?.map((p: any) => (
                        <option key={p.program_id} value={p.program_id} className="bg-slate-900">{p.program_name}</option>
                    ))}
                </select>
            </div>

            {/* DATA TABLE */}
            <div className="rounded-2xl border border-slate-700/80 overflow-hidden relative mb-4">
                {/* PAGINATION CONTROLS (TOP) */}
                {totalCount > 0 && (
                    <div className="p-4 border-b border-slate-700/80 bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-slate-400">
                            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} entries
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                value={pageSize}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                            >
                                <option value={20}>20 per page</option>
                                <option value={50}>50 per page</option>
                                <option value={100}>100 per page</option>
                            </select>

                            <div className="flex bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="px-4 py-2 text-sm font-medium text-slate-300 border-x border-slate-700">
                                    Page {page} of {totalPages}
                                </div>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                        <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold">
                            <span className="w-4 h-4 border-2 border-blue-400/50 border-t-blue-400 rounded-full animate-spin"></span>
                            Loading...
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-700">
                                <th className="px-4 py-3 w-[50px]">
                                    <button onClick={toggleAllPage} className="text-slate-500 hover:text-white transition-colors">
                                        {isAllPageSelected ? <SquareCheck size={16} className="text-blue-400" /> : <Square size={16} />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-300 transition-colors select-none" onClick={() => handleSort('student_code')}>
                                    <div className="flex items-center gap-1">
                                        ID {sortBy === 'student_code' && <span className="text-blue-400">{sortDesc ? '↓' : '↑'}</span>}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Student</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Programs</th>
                                {!fixedBatchId && <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Father</th>}
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Class</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">School</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Contact</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.length > 0 ? (
                                students.map((student: Student) => {
                                    const isSelected = selectedStudents.has(student.student_id);
                                    return (
                                        <tr
                                            key={student.student_id}
                                            className={`border-b border-slate-800 transition-colors group ${isSelected
                                                ? 'bg-blue-500/8'
                                                : 'hover:bg-slate-800/60'
                                                }`}
                                        >
                                            <td className="px-4 py-3">
                                                <button onClick={() => toggleStudent(student)} className="text-slate-600 hover:text-slate-300 transition-colors">
                                                    {isSelected ? <SquareCheck size={16} className="text-blue-400" /> : <Square size={16} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded-md">
                                                    #{student.student_code || student.student_id}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link to={`/students/${student.student_id}`} className="font-semibold text-slate-100 hover:text-blue-400 transition-colors text-sm">
                                                    {student.name}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    {student.enrollment?.map((enroll, idx) => (
                                                        <span key={idx} className="text-xs bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 text-slate-300 whitespace-nowrap w-fit">
                                                            <span className="font-bold text-blue-400 mr-1">{enroll.roll_no || '—'}</span>
                                                            <span className="text-slate-400">{enroll.program?.program_name}</span>
                                                        </span>
                                                    ))}
                                                    {(!student.enrollment || student.enrollment.length === 0) && (
                                                        <span className="text-slate-600 text-xs italic">Not enrolled</span>
                                                    )}
                                                </div>
                                            </td>
                                            {!fixedBatchId && <td className="px-4 py-3 text-slate-400 text-sm">{student.fathers_name || <span className="text-slate-600">—</span>}</td>}
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                                                    {student.class}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-sm max-w-[140px] truncate">{student.school || <span className="text-slate-600">—</span>}</td>
                                            <td className="px-4 py-3 text-slate-400 text-sm font-mono">{student.contact ? String(student.contact).replace(/\.0$/, '') : <span className="text-slate-600">—</span>}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => triggerPrint(student.student_id)}
                                                        title="Print ID Card"
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700/50"
                                                    >
                                                        <Printer size={14} />
                                                    </button>
                                                    <Link
                                                        to={`/students/${student.student_id}`}
                                                        className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white transition-all border border-blue-500/20"
                                                    >
                                                        <ChevronRight size={14} />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-500">
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
                batchId={fixedBatchId}
            />
        </div>
    );
};

export default StudentList;
