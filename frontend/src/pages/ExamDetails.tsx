import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExamRepository } from '../repositories/ExamRepository';
import { FileText, Trophy, AlignLeft, Download, Upload, Edit, Save, X } from 'lucide-react';
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
    const [viewDoc, setViewDoc] = useState<{ url: string, title: string } | null>(null);
    const [editedMarks, setEditedMarks] = useState<any>({});
    const queryClient = useQueryClient();

    // Queries
    const { data: exam, isError: isExamError, refetch: refetchExam } = useQuery({
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
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'student_id', direction: 'asc' });

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
                result_written: g.written_marks ?? '-',
                result_mcq: g.mcq_marks ?? '-',
                result_total: g.total_score ?? '-',

                // Sorting Values
                sort_written: isEditing ? (Number(finalEditData.written) || 0) : (g.written_marks || 0),
                sort_mcq: isEditing ? (Number(finalEditData.mcq) || 0) : (g.mcq_marks || 0),
                sort_total: isEditing ? ((Number(finalEditData.written) || 0) + (Number(finalEditData.mcq) || 0)) : (g.total_score || 0),
                sort_student_id: studentId || 0,

                editData: finalEditData,
                enrollments: g.enrollments // Already provided by backend
            };
        });

        // 2. Sort
        return merged.sort((a: any, b: any) => {
            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'student_id') {
                aValue = a.sort_student_id;
                bValue = b.sort_student_id;
            } else if (sortConfig.key === 'written') {
                aValue = a.sort_written;
                bValue = b.sort_written;
            } else if (sortConfig.key === 'mcq') {
                aValue = a.sort_mcq;
                bValue = b.sort_mcq;
            } else if (sortConfig.key === 'total') {
                aValue = a.sort_total;
                bValue = b.sort_total;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
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

                    const written = fromMerit?.written_marks ?? c.written_marks ?? 0;
                    const mcq = fromMerit?.mcq_marks ?? c.mcq_marks ?? 0;

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

    // Mutation
    const bulkUpdateMutation = useMutation({
        mutationFn: (data: any) => ExamRepository.submitBulkResults(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analytics', id] });
            queryClient.invalidateQueries({ queryKey: ['merit', id] });
            queryClient.invalidateQueries({ queryKey: ['candidates', id] });
            setIsEditing(false);
            setEditedMarks({});
            alert("Marks updated successfully!");
        },
        onError: (err) => alert("Failed to update marks: " + err)
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
        const resultsArray = Object.values(editedMarks).map((m: any) => ({
            student_id: m.student_id,
            written_marks: m.written === '' ? 0 : (m.written || 0),
            mcq_marks: m.mcq === '' ? 0 : (m.mcq || 0)
        }));

        bulkUpdateMutation.mutate({
            exam_id: parseInt(id!),
            results: resultsArray
        });
    };

    // --- EXPORT FUNCTIONS ---

    // 1. Download Excel Template for Re-upload
    const exportResultTemplate = () => {
        if (!candidates) return;

        // Prepare Data: ID, Name, Written, MCQ
        // Sorted by Student ID for easier data entry from physical sheets
        const templateData = candidates
            .map((c: any) => ({
                "Student ID": c.student?.student_id,
                "Student Name": c.student?.name,
                "Program": c.program?.program_name || (c.enrollments && c.enrollments.map((e: any) => e.program_name).join(', ')),
                "Written Marks": c.written_marks || '', // Pre-fill if exists, else empty
                "MCQ Marks": c.mcq_marks || ''         // Pre-fill if exists, else empty
            }))
            .sort((a: any, b: any) => (a["Student ID"] || 0) - (b["Student ID"] || 0));

        const ws = XLSX.utils.json_to_sheet(templateData);

        // Adjust column widths
        const wscols = [
            { wch: 10 }, // ID
            { wch: 30 }, // Name
            { wch: 25 }, // Program
            { wch: 15 }, // Written
            { wch: 15 }  // MCQ
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Result Entry");
        XLSX.writeFile(wb, `${exam.exam_name}_Result_Template.xlsx`);
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
                styles: { fontSize: 9, cellPadding: 1 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { cellWidth: 30 } },
                margin: { left: 14 }
                // Use limited width to keep it compact or side-by-side? 
                // Let's keep it simple top-left for now or header style.
            });
            // Approximate height of stats table
            currentY = (doc as any).lastAutoTable.finalY + 10;
        }

        // --- STUDENT RANKING TABLE ---
        const tableData = rankedList.map((r: any) => [
            r.rank,
            r.student?.name || 'Unknown',
            r.student?.student_id || '-',
            r.written_marks || 0,
            r.mcq_marks || 0,
            r.total_score || 0,
            // Simple status based on score? e.g. Pass/Fail if pass marks exist? 
            // For now just empty or could be "Grade" placeholder.
            // Let's omit Status col if we don't have logic, or just show Program name
            r.enrollments && r.enrollments.length > 0 ? r.enrollments[0].program_name : '-'
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Rank', 'Student Name', 'ID', 'Written', 'MCQ', 'Total', 'Program']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 3 },
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
        <div className="space-y-6">
            {/* HEADER */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">{exam?.exam_type}</span>
                            {exam.program_exam && exam.program_exam.length > 0 && (
                                <>
                                    <span className="text-xs text-gray-400">|</span>
                                    <span className="text-xs text-gray-500">
                                        {exam.program_exam.map((pe: any) => pe.program?.program_name).join(', ')}
                                    </span>
                                </>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mt-1">{exam?.exam_name}</h1>
                        <p className="text-gray-500 mt-1 flex gap-4">
                            <span>Held on: {exam?.exam_date || 'N/A'}</span>
                            {exam.subject && <span>Subject: {exam.subject}</span>}
                        </p>

                        <div className="flex gap-4 mt-3">
                            {exam.question_link && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setViewDoc({ url: getEmbedLink(exam.question_link), title: "Question Paper" })}
                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                                    >
                                        <FileText size={14} /> View Question
                                    </button>
                                    <a href={exam.question_link} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600">
                                        <Download size={14} />
                                    </a>
                                </div>
                            )}
                            {exam.solution_link && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setViewDoc({ url: getEmbedLink(exam.solution_link), title: "Solution" })}
                                        className="text-sm text-green-600 hover:underline flex items-center gap-1 bg-green-50 px-2 py-1 rounded"
                                    >
                                        <FileText size={14} /> View Solution
                                    </button>
                                    <a href={exam.solution_link} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-green-600">
                                        <Download size={14} />
                                    </a>
                                </div>
                            )}
                        </div>

                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <div>
                            <p className="text-sm text-gray-500 uppercase">Total Marks</p>
                            <p className="text-3xl font-bold text-blue-600">{exam?.total_marks}</p>
                        </div>
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 border px-2 py-1 rounded hover:bg-gray-50"
                        >
                            <Edit size={14} /> Edit Details
                        </button>
                    </div>
                </div>

                {/* ANALYTICS */}
                {analytics && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-100">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h3 className="text-blue-800 font-semibold mb-2 flex items-center gap-2">
                                <AlignLeft size={18} /> Averages
                            </h3>
                            <div className="text-sm text-blue-700 space-y-1">
                                <p className="flex justify-between"><span>Written:</span> <b>{analytics?.averages?.written}</b></p>
                                <p className="flex justify-between"><span>MCQ:</span> <b>{analytics?.averages?.mcq}</b></p>
                                <p className="flex justify-between mt-1"><span>Total:</span> <b>{analytics?.averages?.total}</b></p>
                            </div>
                        </div>

                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <h3 className="text-purple-800 font-semibold mb-2 flex items-center gap-2">
                                <Trophy size={18} /> Top Scores
                            </h3>
                            <div className="text-sm text-purple-700 space-y-1">
                                {/* Removed border-t classes to avoid implication of sum */}
                                <p className="flex justify-between"><span>Highest Written:</span> <b>{analytics?.highest?.written}</b></p>
                                <p className="flex justify-between"><span>Highest MCQ:</span> <b>{analytics?.highest?.mcq}</b></p>
                                <p className="flex justify-between mt-1"><span>Highest Total:</span> <b>{analytics?.highest?.total}</b></p>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-center items-center text-center">
                            <p className="text-gray-500">Total Participants</p>
                            <p className="text-4xl font-bold text-gray-800 mt-2">{analytics?.total_students}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ACTIONS */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium"
                    >
                        <Upload size={18} /> Upload Excel
                    </button>
                    <div className="h-6 w-px bg-gray-300 mx-2"></div>
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleSaveManual}
                                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded shadow-sm hover:bg-green-700 font-medium"
                            >
                                <Save size={18} /> Save Changes
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 px-4 py-2"
                            >
                                <X size={18} /> Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 font-medium"
                        >
                            <Edit size={18} /> Enter Marks Manually
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={exportResultTemplate}
                        className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                        title="Download Excel Template for Data Entry"
                    >
                        <Download size={16} /> Excel Template
                    </button>
                    <button
                        onClick={exportMeritListPDF}
                        className="flex items-center gap-2 text-white bg-red-600 border border-red-700 px-3 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm text-sm font-medium"
                        title="Download Professional Merit List"
                    >
                        <FileText size={16} /> Merit List
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-700 flex justify-between items-center">
                    <span>Student List</span>
                    <span className="text-xs text-gray-400 font-normal">Click headers to sort</span>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white text-gray-500 text-xs uppercase font-semibold border-b border-gray-200">
                        <tr>
                            <th className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('student_id')}>
                                <div className="flex items-center gap-1">
                                    Student {sortConfig.key === 'student_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                            </th>
                            <th className="p-4">Programs</th>
                            <th className="p-4 text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('written')}>
                                <div className="flex items-center justify-end gap-1">
                                    Written {sortConfig.key === 'written' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                            </th>
                            <th className="p-4 text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('mcq')}>
                                <div className="flex items-center justify-end gap-1">
                                    MCQ {sortConfig.key === 'mcq' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                            </th>
                            <th className="p-4 text-right cursor-pointer hover:bg-gray-50" onClick={() => handleSort('total')}>
                                <div className="flex items-center justify-end gap-1">
                                    Total Score {sortConfig.key === 'total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {sortedCandidates?.map((g: any, index: number) => {
                            const editData = g.editData;

                            return (
                                <tr key={g.student?.student_id || index} className={isEditing ? "bg-blue-50/30" : "hover:bg-gray-50"}>
                                    <td className="p-4 font-medium text-gray-900">
                                        <Link to={`/students/${g.student?.student_id}`} className="hover:text-blue-600 hover:underline">
                                            {g.student?.name || 'Unknown'}
                                        </Link>
                                    </td>
                                    <td className="p-4 text-xs text-gray-600 max-w-xs">
                                        {g.enrollments.map((e: any, i: number) => (
                                            <div key={i} className="mb-1 last:mb-0">
                                                <Link to={`/programs/${e.program_id}`} className="hover:text-blue-600 hover:underline font-medium">
                                                    {e.program_name}
                                                </Link>
                                                <span className="text-gray-500 ml-1">(Roll: {e.roll_no || '-'})</span>
                                            </div>
                                        ))}
                                    </td>

                                    {isEditing ? (
                                        <>
                                            <td className="p-4 text-right">
                                                <input
                                                    type="number"
                                                    className="w-20 p-1 border rounded text-right bg-white border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    value={editData.written}
                                                    placeholder="0"
                                                    onChange={(e) => g.student?.student_id && handleMarkChange(g.student.student_id, 'written', e.target.value)}
                                                    onWheel={(e) => e.currentTarget.blur()}
                                                />
                                            </td>
                                            <td className="p-4 text-right">
                                                <input
                                                    type="number"
                                                    className="w-20 p-1 border rounded text-right bg-white border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    value={editData.mcq}
                                                    placeholder="0"
                                                    onChange={(e) => g.student?.student_id && handleMarkChange(g.student.student_id, 'mcq', e.target.value)}
                                                    onWheel={(e) => e.currentTarget.blur()}
                                                />
                                            </td>
                                            <td className="p-4 text-right text-gray-400 text-sm">
                                                {(Number(editData.written) || 0) + (Number(editData.mcq) || 0)}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-4 text-right font-mono text-gray-600">{g.result_written}</td>
                                            <td className="p-4 text-right font-mono text-gray-600">{g.result_mcq}</td>
                                            <td className="p-4 text-right font-bold text-blue-600 text-lg">{g.result_total}</td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}

                        {!sortedCandidates || sortedCandidates.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">No students enrolled or results published.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Document Viewer Modal using simple overlay for now */}
            {viewDoc && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col items-center justify-center p-4">
                    <div className="bg-white w-full h-full max-w-5xl rounded-lg shadow-2xl flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-bold text-lg">{viewDoc.title}</h3>
                            <button onClick={() => setViewDoc(null)} className="text-gray-500 hover:text-black">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 bg-gray-100 p-2 relative">
                            <iframe
                                src={viewDoc.url}
                                className="w-full h-full border-none rounded"
                                title="Document Viewer"
                            />
                        </div>
                    </div>
                </div>
            )}

            <UploadResultsModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                examId={id!}
            />

            {/* Edit Modal */}
            <CreateExamModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                examData={exam}
            />
        </div>
    );
};

export default ExamDetails;
