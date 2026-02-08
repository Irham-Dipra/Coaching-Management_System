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
    const [editedMarks, setEditedMarks] = useState<any>({});
    const queryClient = useQueryClient();

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

        // 1. Group by Student ID
        const groupedMap = new Map();

        candidates.forEach((c: any) => {
            const studentId = c?.student?.student_id;
            if (!studentId) return;

            if (!groupedMap.has(studentId)) {
                // Initialize group
                // Use result data from candidate if available (fallback/primary if meritList join fails)
                const candidateResult = c.result_id ? {
                    result_id: c.result_id,
                    written_marks: c.written_marks,
                    mcq_marks: c.mcq_marks,
                    total_score: c.total_score,
                    student: c.student // Keep student ref if needed
                } : null;

                groupedMap.set(studentId, {
                    student: c.student,
                    enrollments: [],
                    result: candidateResult,
                    editData: { written: 0, mcq: 0 }
                });
            }

            const group = groupedMap.get(studentId);

            // Add enrollment details
            group.enrollments.push({
                program_name: c?.program?.program_name,
                program_id: c?.program_id, // Corrected: fetch from top level
                roll_no: c?.program_roll_no,
                enrollment_id: c.enrollment_id
            });

            // Find result for this student (meritList should now be keyed/findable by student_id or contain student info)
            // meritList comes from getExamResults which returns student object in result.
            // This is still useful if meritList has fresher data or extra fields, but candidateResult is a good baseline.
            const result = meritList?.find((r: any) => r.student?.student_id === studentId);

            // If found, assign it. Since we group by student, we don't need to check "better" result anymore 
            // as there is only one result per student per exam now.
            if (result) {
                group.result = result;
            }

            // Consolidate Edit Data 
            if (editedMarks[studentId]) {
                group.editData = editedMarks[studentId];
            }
        });

        const merged = Array.from(groupedMap.values()).map((g: any) => {
            const result = g.result;
            // If we have local edits, use them. Otherwise fallback to DB result.
            const editData = g.editData.written || g.editData.mcq ? g.editData :
                { written: result?.written_marks || 0, mcq: result?.mcq_marks || 0 };

            return {
                ...g,
                result_written: result?.written_marks ?? '-',
                result_mcq: result?.mcq_marks ?? '-',
                result_total: result?.total_score ?? '-',
                // Numeric values for sorting
                sort_written: isEditing ? (Number(editData.written) || 0) : (result?.written_marks || 0),
                sort_mcq: isEditing ? (Number(editData.mcq) || 0) : (result?.mcq_marks || 0),
                sort_total: isEditing ? ((Number(editData.written) || 0) + (Number(editData.mcq) || 0)) : (result?.total_score || 0),
                sort_student_id: g.student?.student_id || 0,
                editData: editData,
                // program_list_display moved to JSX
            };
        });

        // 2. Sort
        return merged.sort((a: any, b: any) => {
            let aValue: any;
            let bValue: any;

            // FIX: When editing, do NOT sort by live edited values to prevent jumping rows.
            // Use the original result or 0.
            if (sortConfig.key === 'student_id') {
                aValue = a.sort_student_id;
                bValue = b.sort_student_id;
            } else if (sortConfig.key === 'written') {
                aValue = isEditing ? (a.result_written === '-' ? 0 : a.result_written) : a.sort_written;
                bValue = isEditing ? (b.result_written === '-' ? 0 : b.result_written) : b.sort_written;
            } else if (sortConfig.key === 'mcq') {
                aValue = isEditing ? (a.result_mcq === '-' ? 0 : a.result_mcq) : a.sort_mcq;
                bValue = isEditing ? (b.result_mcq === '-' ? 0 : b.result_mcq) : b.sort_mcq;
            } else if (sortConfig.key === 'total') {
                aValue = isEditing ? (a.result_total === '-' ? 0 : a.result_total) : a.sort_total;
                bValue = isEditing ? (b.result_total === '-' ? 0 : b.result_total) : b.sort_total;
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

    // ... existing export functions ...
    const exportCSV = () => {
        if (!meritList) return;
        // Ensure strictly sorted by Total Score
        const sortedList = [...meritList].sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0));

        const ws = XLSX.utils.json_to_sheet(sortedList.map((r: any) => ({
            Name: r?.student?.name || 'Unknown',
            // Roll: r?.student?.roll_no || '-', // Removed roll from student table?
            // We might want Program Roll here, but merit list might not have it easily if we removed enrollment link.
            // For now, Name is enough or we rely on what's available.
            Written: r.written_marks,
            MCQ: r.mcq_marks,
            Total: r.total_score
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Merit List");
        XLSX.writeFile(wb, `${exam.exam_name}_Merit_List.xlsx`);
    };

    const exportPDF = () => {
        if (!meritList) return;
        // Ensure strictly sorted by Total Score
        const sortedList = [...meritList].sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0));

        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text(exam.exam_name || "Exam Results", 14, 22);
        doc.setFontSize(11);
        doc.text(`Date: ${exam.exam_date || 'N/A'}`, 14, 30);
        doc.text(`Type: ${exam.exam_type}`, 14, 36);

        // Table Data
        const tableData = sortedList.map((r: any, index: number) => [
            index + 1,
            r?.student?.name || 'Unknown',
            // r?.student?.roll_no || '-',
            r.written_marks,
            r.mcq_marks,
            r.total_score
        ]);

        autoTable(doc, {
            head: [['Rank', 'Student Name', 'Written', 'MCQ', 'Total']],
            body: tableData,
            startY: 44,
        });

        doc.save(`${exam.exam_name}_Results.pdf`);
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
                                <a href={exam.question_link} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                    <Download size={14} /> Question Paper
                                </a>
                            )}
                            {exam.solution_link && (
                                <a href={exam.solution_link} target="_blank" rel="noreferrer" className="text-sm text-green-600 hover:underline flex items-center gap-1">
                                    <Download size={14} /> Solution
                                </a>
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
                <div className="flex gap-4">
                    <button onClick={exportCSV} className="flex items-center gap-2 text-green-600 border border-green-200 px-3 py-1.5 rounded hover:bg-green-50">
                        <Download size={18} /> Export Excel
                    </button>
                    <button onClick={exportPDF} className="flex items-center gap-2 text-red-600 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50">
                        <FileText size={18} /> Export PDF
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
