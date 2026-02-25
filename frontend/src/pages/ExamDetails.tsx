import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExamRepository } from '../repositories/ExamRepository';
import { FileText, Trophy, AlignLeft, Download, Upload, Edit, Save, X, ArrowLeft, Trash } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import UploadResultsModal from '../components/UploadResultsModal';
import CreateExamModal from '../components/CreateExamModal';

const ExamDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingRows, setEditingRows] = useState<Record<number, boolean>>({}); // Track which rows are actively being edited
    const [viewDoc, setViewDoc] = useState<{ url: string, title: string } | null>(null);
    const [editedMarks, setEditedMarks] = useState<any>({});
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Queries
    const { data: exam, isError: isExamError } = useQuery({
        queryKey: ['exam', id],
        queryFn: () => ExamRepository.getExamById(id!),
        enabled: !!id
    });

    const { data: analytics } = useQuery({
        queryKey: ['analytics', id],
        queryFn: () => ExamRepository.getAnalytics(id!),
        enabled: !!id
    });

    const { data: meritList } = useQuery({
        queryKey: ['merit', id],
        queryFn: () => ExamRepository.getMeritList(id!),
        enabled: !!id
    });

    const { data: candidates } = useQuery({
        queryKey: ['candidates', id],
        queryFn: () => ExamRepository.getCandidates(id!),
        enabled: !!id
    });

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'student_code', direction: 'asc' });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedCandidates = React.useMemo(() => {
        if (!candidates) return [];

        // Candidates are already grouped by Student from Backend
        const merged = candidates.map((g: any) => {
            // Apply edits from state if available
            const studentId = g.student?.student_id;
            const localEdit = editedMarks[studentId];

            const finalEditData = localEdit || {
                written: g.written_marks || 0,
                mcq: g.mcq_marks || 0
            };

            return {
                ...g,
                result_written: g.written_marks ?? 'Not Recorded',
                result_mcq: g.mcq_marks ?? 'Not Recorded',
                result_total: g.total_score ?? 'Not Recorded',

                // Sorting Values
                sort_written: isEditing ? (Number(finalEditData.written) || 0) : (g.written_marks || 0),
                sort_mcq: isEditing ? (Number(finalEditData.mcq) || 0) : (g.mcq_marks || 0),
                sort_total: isEditing ? ((Number(finalEditData.written) || 0) + (Number(finalEditData.mcq) || 0)) : (g.total_score || 0),
                sort_student_code: g.student?.student_code || String(studentId || ''),
                sort_program_id: g.enrollments && g.enrollments.length > 0 ? g.enrollments[0].program_id : 0,

                editData: finalEditData,
                enrollments: g.enrollments // Already provided by backend
            };
        });

        // 2. Sort
        return merged.sort((a: any, b: any) => {
            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'student_code') {
                aValue = a.sort_student_code;
                bValue = b.sort_student_code;
            } else if (sortConfig.key === 'written') {
                aValue = a.sort_written;
                bValue = b.sort_written;
            } else if (sortConfig.key === 'mcq') {
                aValue = a.sort_mcq;
                bValue = b.sort_mcq;
            } else if (sortConfig.key === 'total') {
                aValue = a.sort_total;
                bValue = b.sort_total;
            } else if (sortConfig.key === 'program') {
                aValue = a.sort_program_id;
                bValue = b.sort_program_id;
            }

            if (sortConfig.key === 'student_code') {
                return sortConfig.direction === 'asc'
                    ? String(aValue).localeCompare(String(bValue), undefined, { numeric: true })
                    : String(bValue).localeCompare(String(aValue), undefined, { numeric: true });
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;

            // If primary sorting values are equal and we are sorting by program, sort by student code (ALWAYS ascending)
            if (sortConfig.key === 'program') {
                return String(a.sort_student_code).localeCompare(String(b.sort_student_code), undefined, { numeric: true });
            }

            return 0;
        });

    }, [candidates, meritList, sortConfig, editedMarks, isEditing]);

    // Effect: Initialize marks
    useEffect(() => {
        if (isEditing && candidates) {
            const initialMarks: any = {};
            candidates.forEach((c: any) => {
                const sId = c?.student?.student_id;
                if (sId) {
                    // Check existing merit from meritList OR candidate data itself
                    const fromMerit = meritList?.find((r: any) => r.student?.student_id === sId);

                    const written = fromMerit?.written_marks ?? c.written_marks ?? '';
                    const mcq = fromMerit?.mcq_marks ?? c.mcq_marks ?? '';

                    initialMarks[sId] = {
                        student_id: sId,
                        written: written,
                        mcq: mcq
                    };
                }
            });
            setEditedMarks(initialMarks);
        }
    }, [isEditing, candidates, meritList]);

    const bulkUpdateMutation = useMutation({
        mutationFn: (data: any) => ExamRepository.submitBulkResults(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analytics', id] });
            queryClient.invalidateQueries({ queryKey: ['merit', id] });
            queryClient.invalidateQueries({ queryKey: ['candidates', id] });
            setIsEditing(false);
            setEditingRows({}); // Reset editing rows
            setEditedMarks({});
            alert("Marks updated successfully!");
        },
        onError: (err) => alert("Failed to update marks: " + err)
    });

    const clearMarkMutation = useMutation({
        mutationFn: (studentId: number) => ExamRepository.submitBulkResults({
            exam_id: parseInt(id!),
            results: [{ student_id: studentId, written_marks: null, mcq_marks: null }]
        }),
        onSuccess: (_, studentId) => {
            queryClient.invalidateQueries({ queryKey: ['analytics', id] });
            queryClient.invalidateQueries({ queryKey: ['merit', id] });
            queryClient.invalidateQueries({ queryKey: ['candidates', id] });
            setEditedMarks((prev: any) => {
                const next = { ...prev };
                delete next[studentId];
                return next;
            });
            setEditingRows(prev => {
                const next = { ...prev };
                delete next[studentId];
                return next;
            });
        },
        onError: (err) => alert("Failed to clear marks: " + err)
    });

    const deleteExamMutation = useMutation({
        mutationFn: () => ExamRepository.deleteExam(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            alert("Exam and all related records have been deleted.");
            navigate('/exams');
        },
        onError: (err) => alert("Failed to delete exam: " + err)
    });

    const getEmbedLink = (url: string) => {
        if (!url) return '';
        // Convert Google Drive view link to preview link
        if (url.includes('drive.google.com') && url.includes('/view')) {
            return url.replace(/\/view.*/, '/preview');
        }
        return url;
    };

    if (isExamError) return <div className="p-8 text-red-500">Error loading exam details.</div>;
    if (!exam) return <div className="p-8">Loading exam...</div>;

    // Parsers
    const handleMarkChange = (studentId: number, field: 'written' | 'mcq', value: string) => {
        // Prevent negative numbers if needed, though type=number handles some.
        // Also allow empty string.
        setEditedMarks((prev: any) => ({
            ...prev,
            [studentId]: {
                ...prev[studentId] || { student_id: studentId },
                // Store raw string if empty, otherwise number. 
                [field]: value === '' ? '' : Number(value)
            }
        }));
    };

    const handleSaveManual = () => {
        // Only save marks for rows that were explicitly edited
        const editedStudentIds = Object.keys(editingRows).filter(id => editingRows[Number(id)]);

        if (editedStudentIds.length === 0) {
            alert("No changes to save. Please edit at least one student's marks.");
            return;
        }

        const resultsArray = editedStudentIds.map(idStr => {
            const studentId = Number(idStr);
            const m = editedMarks[studentId] || { student_id: studentId, written: '', mcq: '' };

            let w = m.written === '' ? null : Number(m.written);
            let mcq = m.mcq === '' ? null : Number(m.mcq);

            // If one mark is provided but the other is missing, default the missing one to 0
            if (w !== null && mcq === null) mcq = 0;
            if (mcq !== null && w === null) w = 0;

            return {
                student_id: m.student_id,
                written_marks: w,
                mcq_marks: mcq
            };
        });

        bulkUpdateMutation.mutate({
            exam_id: parseInt(id!),
            results: resultsArray
        });
    };

    // --- EXPORT FUNCTIONS ---

    // 1. Download Excel Template for Re-upload
    const exportResultTemplate = (sortBy: 'student_code' | 'program' = 'student_code') => {
        if (!candidates || candidates.length === 0) {
            alert("No students found to generate an Excel template.");
            return;
        }

        // Create a wrapper array to avoid mutating object keys (which breaks xlsx headers)
        const wrappers = candidates.map((c: any) => ({
            _program_id: c.enrollments && c.enrollments.length > 0 ? c.enrollments[0].program_id : 0,
            _student_code: String(c.student?.student_code || c.student?.student_id || ''),
            data: {
                "Student Code": String(c.student?.student_code || c.student?.student_id || ''),
                "Student Name": String(c.student?.name || ''),
                "Program Name": String(c.program?.program_name || (c.enrollments && c.enrollments.map((e: any) => e.program_name).join(', ')) || ''),
                "Written": c.written_marks !== undefined && c.written_marks !== null ? Number(c.written_marks) : null,
                "MCQ": c.mcq_marks !== undefined && c.mcq_marks !== null ? Number(c.mcq_marks) : null
            }
        }));

        if (sortBy === 'program') {
            wrappers.sort((a: any, b: any) => {
                if (a._program_id < b._program_id) return -1;
                if (a._program_id > b._program_id) return 1;
                return a._student_code.localeCompare(b._student_code, undefined, { numeric: true });
            });
        } else {
            wrappers.sort((a: any, b: any) => a._student_code.localeCompare(b._student_code, undefined, { numeric: true }));
        }

        const templateData = wrappers.map((w: any) => w.data);

        // Explicitly map exact string column headers to prevent misaligned property injections
        const ws = XLSX.utils.json_to_sheet(templateData, {
            header: ["Student Code", "Student Name", "Program Name", "Written", "MCQ"]
        });

        // Adjust column widths
        const wscols = [
            { wch: 15 }, // Student Code
            { wch: 30 }, // Name
            { wch: 30 }, // Program Name
            { wch: 15 }, // Written
            { wch: 15 }  // MCQ
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Result Entry");

        const safeName = (exam.exam_name || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${safeName}_Result_Template.xlsx`;

        // Safest approach: Base64 encode the binary to avoid modern browser optimizations corrupting byte streams
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

        const byteCharacters = atob(wbout);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Microsoft Excel exact format MIME
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Manual Download Trigger
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    // 2. Download Professional Merit List PDF
    const exportMeritListPDF = () => {
        if (!candidates) return;

        // Sort by Total Score Descending (Rank)
        const rankedList = [...candidates]
            .sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0))
            .map((c: any, index: number) => ({
                ...c,
                rank: index + 1
            }));

        const doc = new jsPDF();

        // --- HEADER ---
        // Brand Title
        doc.setFontSize(22);
        doc.setTextColor(41, 128, 185); // Blue
        doc.setFont("helvetica", "bold");
        doc.text("Science Point by Dr. Talha", 105, 20, { align: "center" });

        // Subtitle / Exam Name
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(exam.exam_name, 105, 30, { align: "center" });

        // Exam Details Line
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const details = `Date: ${exam.exam_date || 'N/A'} | Type: ${exam.exam_type} | Total Marks: ${exam.total_marks}`;
        doc.text(details, 105, 36, { align: "center" });

        // Linked Programs Line
        const programNames = exam.program_exam?.map((pe: any) => pe.program?.program_name).join(', ') || 'General';
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Programs: ${programNames}`, 105, 42, { align: "center" });

        let currentY = 50;

        // --- HIGHLIGHTS / ANALYTICS SECTION ---
        if (analytics) {
            const stats = [
                ["Participated", `${analytics.total_students}`],
                ["Highest (Written)", `${analytics.highest?.written || 0}`],
                ["Highest (MCQ)", `${analytics.highest?.mcq || 0}`],
                ["Highest (Total)", `${analytics.highest?.total || 0}`],
                ["Average (Total)", `${analytics.averages?.total || 0}`]
            ];

            autoTable(doc, {
                startY: currentY,
                head: [['Statistic', 'Value']],
                body: stats,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 1, halign: 'center' },
                headStyles: { halign: 'center', fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 50, halign: 'center' },
                    1: { cellWidth: 30, halign: 'center' }
                },
                tableWidth: 80,
                // Centered table logic:
                margin: { left: (doc.internal.pageSize.width - 80) / 2 }
            });
            // Approximate height of stats table
            currentY = (doc as any).lastAutoTable.finalY + 10;
        }

        // --- STUDENT RANKING TABLE ---
        const tableData = rankedList.map((r: any) => [
            r.rank,
            r.student?.name || 'Unknown',
            r.student?.student_code || r.student?.student_id || '-',
            r.written_marks || 0,
            r.mcq_marks || 0,
            r.total_score || 0
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Rank', 'Student Name', 'ID', 'Written', 'MCQ', 'Total']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 10, cellPadding: 3, halign: 'center' },
            columnStyles: { 1: { halign: 'left' } }, // Name Left Aligned
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 285);
            doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
        }

        doc.save(`${exam.exam_name}_Merit_List.pdf`);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* BREADCRUMB */}
            <div className="flex items-center gap-4 text-slate-500">
                <Link to="/exams" className="hover:text-white flex items-center gap-1 transition-colors">
                    <ArrowLeft size={16} /> Back to Exams
                </Link>
            </div>

            {/* HEADER */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-lg border border-slate-700/50 p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded uppercase tracking-wider">{exam?.exam_type}</span>
                            {exam.program_exam && exam.program_exam.length > 0 && (
                                <>
                                    <span className="text-xs text-slate-600">|</span>
                                    <span className="text-xs text-slate-400">
                                        {exam.program_exam.map((pe: any) => pe.program?.program_name).join(', ')}
                                    </span>
                                </>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-white mt-1">{exam?.exam_name}</h1>
                        <p className="text-slate-400 mt-2 flex gap-4 text-sm items-center">
                            <span>Held on: {exam?.exam_date || 'N/A'}</span>
                            {exam.subject && (
                                <>
                                    <span className="text-slate-600">•</span>
                                    <span>Subject: {exam.subject}</span>
                                </>
                            )}
                            {analytics && (
                                <>
                                    <span className="text-slate-600">•</span>
                                    <span>Participants: <strong className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{analytics.total_students} / {candidates?.length || 0}</strong></span>
                                </>
                            )}
                        </p>

                        <div className="flex gap-4 mt-4">
                            {exam.question_link && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setViewDoc({ url: getEmbedLink(exam.question_link), title: "Question Paper" })}
                                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-all hover:bg-blue-500/20"
                                    >
                                        <FileText size={14} /> View Question
                                    </button>
                                    <a href={exam.question_link} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition-colors p-1.5 hover:bg-slate-700 rounded-lg">
                                        <Download size={14} />
                                    </a>
                                </div>
                            )}
                            {exam.solution_link && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setViewDoc({ url: getEmbedLink(exam.solution_link), title: "Solution" })}
                                        className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all hover:bg-emerald-500/20"
                                    >
                                        <FileText size={14} /> View Solution
                                    </button>
                                    <a href={exam.solution_link} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition-colors p-1.5 hover:bg-slate-700 rounded-lg">
                                        <Download size={14} />
                                    </a>
                                </div>
                            )}
                        </div>

                    </div>
                    <div className="text-right flex flex-col items-end gap-3">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Marks</p>
                            <p className="text-3xl font-bold text-blue-400">{exam?.total_marks}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="text-sm text-slate-400 hover:text-white flex items-center gap-1 border border-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                            >
                                <Edit size={14} /> Edit Details
                            </button>
                            <button
                                onClick={() => {
                                    if (window.confirm("WARNING: Are you sure you want to completely delete this exam and ALL associated student marks? This action cannot be undone.")) {
                                        deleteExamMutation.mutate();
                                    }
                                }}
                                disabled={deleteExamMutation.isPending}
                                className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1 border border-red-500/50 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            >
                                <Trash size={14} /> Delete Exam
                            </button>
                        </div>
                    </div>
                </div>

                {/* ANALYTICS */}
                {analytics && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-700/50">
                        {/* Averages Card */}
                        <div className="bg-slate-800/80 p-5 rounded-2xl border border-blue-500/20 shadow-lg relative overflow-hidden hover:border-blue-500/40 transition-colors">
                            <h3 className="text-blue-400 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider relative z-10">
                                <AlignLeft size={16} /> Averages
                            </h3>
                            <div className="space-y-3 relative z-10">
                                <div className="flex justify-between items-center bg-slate-900/50 px-3 py-2 rounded-lg">
                                    <span className="text-slate-400 text-sm">Written</span>
                                    <span className="text-white font-mono font-bold">{analytics?.averages?.written}</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-900/50 px-3 py-2 rounded-lg">
                                    <span className="text-slate-400 text-sm">MCQ</span>
                                    <span className="text-white font-mono font-bold">{analytics?.averages?.mcq}</span>
                                </div>
                                <div className="flex justify-between items-center bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg">
                                    <span className="text-blue-300 font-medium text-sm">Total</span>
                                    <span className="text-blue-400 font-mono font-bold text-lg">{analytics?.averages?.total}</span>
                                </div>
                            </div>
                        </div>

                        {/* Top Scores Card */}
                        <div className="bg-slate-800/80 p-5 rounded-2xl border border-purple-500/20 shadow-lg relative overflow-hidden hover:border-purple-500/40 transition-colors">
                            <h3 className="text-purple-400 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider relative z-10">
                                <Trophy size={16} /> Top Scores
                            </h3>
                            <div className="space-y-3 relative z-10">
                                <div className="flex justify-between items-center bg-slate-900/50 px-3 py-2 rounded-lg relative overflow-hidden">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 text-xs uppercase font-bold tracking-wider w-16 inline-block">Written</span>
                                        {analytics?.highest?.written_student && (
                                            <>
                                                <span className="text-slate-600">|</span>
                                                <Link to={`/students/${analytics.highest.written_student.student_id}`} className="text-purple-400 text-sm font-medium hover:text-purple-300 hover:underline truncate max-w-[200px]">
                                                    {analytics.highest.written_student.name}
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-white font-mono font-bold text-sm bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">{analytics?.highest?.written}</span>
                                </div>

                                <div className="flex justify-between items-center bg-slate-900/50 px-3 py-2 rounded-lg relative overflow-hidden">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 text-xs uppercase font-bold tracking-wider w-16 inline-block">MCQ</span>
                                        {analytics?.highest?.mcq_student && (
                                            <>
                                                <span className="text-slate-600">|</span>
                                                <Link to={`/students/${analytics.highest.mcq_student.student_id}`} className="text-purple-400 text-sm font-medium hover:text-purple-300 hover:underline truncate max-w-[200px]">
                                                    {analytics.highest.mcq_student.name}
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-white font-mono font-bold text-sm bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">{analytics?.highest?.mcq}</span>
                                </div>

                                <div className="flex justify-between items-center bg-purple-500/10 border border-purple-500/20 px-3 py-2 rounded-lg relative overflow-hidden">
                                    <div className="flex items-center gap-2">
                                        <span className="text-purple-300 text-xs uppercase font-bold tracking-wider w-16 inline-block">Total</span>
                                        {analytics?.highest?.total_student && (
                                            <>
                                                <span className="text-purple-400/50">|</span>
                                                <Link to={`/students/${analytics.highest.total_student.student_id}`} className="text-white text-sm font-bold hover:text-white/80 hover:underline truncate max-w-[200px]">
                                                    {analytics.highest.total_student.name}
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-purple-400 font-mono font-bold text-lg">{analytics?.highest?.total}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ACTIONS */}
            <div className="flex justify-between items-center bg-slate-800/50 backdrop-blur-md p-4 rounded-xl shadow-lg border border-slate-700/50">
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-700/50 px-3 py-2 rounded-lg transition-colors font-medium"
                    >
                        <Upload size={18} /> Upload Excel
                    </button>
                    <div className="h-6 w-px bg-slate-700 mx-2 self-center"></div>
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleSaveManual}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 font-bold transition-all"
                            >
                                <Save size={18} /> Save Changes
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditingRows({}); // Reset row states when cancelling
                                }}
                                className="flex items-center gap-2 text-slate-400 hover:text-white px-4 py-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                            >
                                <X size={18} /> Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-500 font-bold transition-all"
                        >
                            <Edit size={18} /> Edit Marks
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    {/* Template Button Removed - moved effectively to Upload Modal */}
                    <button
                        onClick={exportMeritListPDF}
                        className="flex items-center gap-2 text-white bg-red-600 border border-red-500 px-3 py-2 rounded-lg hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20 text-sm font-bold"
                        title="Download Professional Merit List"
                    >
                        <FileText size={16} /> Merit List
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-lg border border-slate-700/50 overflow-hidden">
                <div className="p-4 border-b border-slate-700/50 bg-slate-900/30 font-bold text-slate-200 flex justify-between items-center">
                    <span>Student List</span>
                    <span className="text-xs text-slate-500 font-normal">Click headers to sort</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-bold border-b border-slate-700/50">
                            <tr>
                                <th className="p-4 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('student_code')}>
                                    <div className="flex items-center gap-1">
                                        Student ID {sortConfig.key === 'student_code' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </div>
                                </th>
                                <th className="p-4">Student Name</th>
                                <th className="p-4 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('program')}>
                                    <div className="flex items-center gap-1">
                                        Programs {sortConfig.key === 'program' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </div>
                                </th>
                                <th className="p-4 text-right cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('written')}>
                                    <div className="flex items-center justify-end gap-1">
                                        Written {sortConfig.key === 'written' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </div>
                                </th>
                                <th className="p-4 text-right cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('mcq')}>
                                    <div className="flex items-center justify-end gap-1">
                                        MCQ {sortConfig.key === 'mcq' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </div>
                                </th>
                                <th className="p-4 text-right cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => handleSort('total')}>
                                    <div className="flex items-center justify-end gap-1">
                                        Total Score {sortConfig.key === 'total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </div>
                                </th>
                                {isEditing && <th className="p-4 text-center">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 text-slate-300">
                            {sortedCandidates?.map((g: any, index: number) => {
                                const editData = g.editData;

                                return (
                                    <tr key={g.student?.student_id || index} className={isEditing ? "bg-blue-500/5" : "hover:bg-slate-700/30 transition-colors"}>
                                        <td className="p-4 font-mono text-slate-400">
                                            {g.student?.student_code || g.student?.student_id || '-'}
                                        </td>
                                        <td className="p-4 font-medium text-white">
                                            <Link to={`/students/${g.student?.student_id}`} className="hover:text-blue-400 hover:underline flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                                    {g.student?.name?.charAt(0) || '?'}
                                                </div>
                                                {g.student?.name || 'Unknown'}
                                            </Link>
                                        </td>
                                        <td className="p-4 text-xs text-slate-400 max-w-xs">
                                            {g.enrollments.map((e: any, i: number) => (
                                                <div key={i} className="mb-1 last:mb-0 flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                                                    <Link to={`/programs/${e.program_id}`} className="hover:text-blue-400 hover:underline">
                                                        {e.program_name}
                                                    </Link>
                                                    <span className="text-slate-500 text-[10px] bg-slate-800 px-1.5 rounded border border-slate-700">Roll: {e.roll_no || '-'}</span>
                                                </div>
                                            ))}
                                        </td>

                                        {isEditing && editingRows[g.student?.student_id] ? (
                                            <>
                                                <td className="p-4 text-right">
                                                    <input
                                                        type="number"
                                                        className="w-20 p-1.5 border border-slate-600 rounded-lg text-right bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                                                        value={editData.written}
                                                        placeholder="0"
                                                        onChange={(e) => g.student?.student_id && handleMarkChange(g.student.student_id, 'written', e.target.value)}
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                    />
                                                </td>
                                                <td className="p-4 text-right">
                                                    <input
                                                        type="number"
                                                        className="w-20 p-1.5 border border-slate-600 rounded-lg text-right bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                                                        value={editData.mcq}
                                                        placeholder="0"
                                                        onChange={(e) => g.student?.student_id && handleMarkChange(g.student.student_id, 'mcq', e.target.value)}
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                    />
                                                </td>
                                                <td className="p-4 text-right text-slate-500 text-sm font-mono">
                                                    {(Number(editData.written) || 0) + (Number(editData.mcq) || 0)}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-4 text-right font-mono text-slate-400 text-sm">
                                                    {g.result_written === 'Not Recorded' ? <span className="text-xs text-slate-500 italic">Not Recorded</span> : g.result_written}
                                                </td>
                                                <td className="p-4 text-right font-mono text-slate-400 text-sm">
                                                    {g.result_mcq === 'Not Recorded' ? <span className="text-xs text-slate-500 italic">Not Recorded</span> : g.result_mcq}
                                                </td>
                                                <td className={`p-4 text-right font-bold ${g.result_total === 'Not Recorded' ? 'text-slate-500 italic text-xs' : 'text-blue-400 text-lg'}`}>
                                                    {g.result_total}
                                                </td>
                                            </>
                                        )}
                                        {isEditing && (
                                            <td className="p-4 text-center">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const sId = g.student?.student_id;
                                                            if (sId) {
                                                                setEditingRows(prev => ({
                                                                    ...prev,
                                                                    [sId]: !prev[sId]
                                                                }));
                                                            }
                                                        }}
                                                        className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${editingRows[g.student?.student_id]
                                                            ? 'bg-slate-600/50 text-slate-300 hover:bg-slate-600'
                                                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'}`}
                                                    >
                                                        {editingRows[g.student?.student_id] ? 'Cancel Edit' : 'Edit Row'}
                                                    </button>

                                                    {g.result_total !== 'Not Recorded' && !editingRows[g.student?.student_id] && (
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm("Are you sure you want to delete the recorded marks for this student?")) {
                                                                    const sId = g.student?.student_id;
                                                                    if (sId) clearMarkMutation.mutate(sId);
                                                                }
                                                            }}
                                                            title="Clear Recorded Marks"
                                                            disabled={clearMarkMutation.isPending}
                                                            className="px-2 py-1.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center disabled:opacity-50"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}

                            {!sortedCandidates || sortedCandidates.length === 0 && (
                                <tr><td colSpan={isEditing ? 7 : 6} className="p-12 text-center text-slate-500 italic">No students enrolled or results published.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Document Viewer Modal using simple overlay for now */}
            {
                viewDoc && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 animate-fade-in">
                        <div className="bg-slate-900 w-full h-full max-w-5xl rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
                            <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800">
                                <h3 className="font-bold text-lg text-white">{viewDoc.title}</h3>
                                <button onClick={() => setViewDoc(null)} className="text-slate-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex-1 bg-slate-900 p-2 relative">
                                <iframe
                                    src={viewDoc.url}
                                    className="w-full h-full border-none rounded bg-white"
                                    title="Document Viewer"
                                />
                            </div>
                        </div>
                    </div>
                )
            }

            <UploadResultsModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                examId={id!}
                onDownloadTemplate={exportResultTemplate}
                studentLookup={candidates?.reduce((acc: any, c: any) => {
                    if (c.student?.student_code) acc[String(c.student.student_code)] = c.student.student_id;
                    // Also map by ID itself just in case
                    if (c.student?.student_id) acc[String(c.student.student_id)] = c.student.student_id;
                    return acc;
                }, {}) || {}}
            />

            {/* Edit Modal */}
            <CreateExamModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                examData={exam}
            />
        </div >
    );
};

export default ExamDetails;
