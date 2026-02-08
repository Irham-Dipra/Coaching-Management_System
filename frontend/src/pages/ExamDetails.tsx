import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

        // 1. Merge Data
        const merged = candidates.map((c: any) => {
            const result = meritList?.find((r: any) => r.enrollment_id === c.enrollment_id);
            const editData = c?.enrollment_id ? (editedMarks[c.enrollment_id] || { written: result?.written_marks || 0, mcq: result?.mcq_marks || 0 }) : { written: 0, mcq: 0 };

            return {
                ...c,
                result_written: result?.written_marks ?? '-',
                result_mcq: result?.mcq_marks ?? '-',
                result_total: result?.total_score ?? '-',
                // Numeric values for sorting
                sort_written: isEditing ? (Number(editData.written) || 0) : (result?.written_marks || 0),
                sort_mcq: isEditing ? (Number(editData.mcq) || 0) : (result?.mcq_marks || 0),
                sort_total: isEditing ? ((Number(editData.written) || 0) + (Number(editData.mcq) || 0)) : (result?.total_score || 0),
                sort_student_id: c.student?.student_id || 0,
                editData: editData
            };
        });

        // 2. Sort
        return merged.sort((a: any, b: any) => {
            let aValue = a.sort_student_id;
            let bValue = b.sort_student_id;

            if (sortConfig.key === 'written') {
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
                if (c?.enrollment_id) {
                    initialMarks[c.enrollment_id] = {
                        student_id: c?.student?.student_id,
                        written: c?.written_marks || 0,
                        mcq: c?.mcq_marks || 0
                    };
                }
            });
            setEditedMarks(initialMarks);
        }
    }, [isEditing, candidates]);

    // Mutation
    const bulkUpdateMutation = useMutation({
        mutationFn: (data: any) => ExamRepository.submitBulkResults(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analytics', id] });
            queryClient.invalidateQueries({ queryKey: ['merit', id] });
            setIsEditing(false);
            setEditedMarks({});
            alert("Marks updated successfully!");
        },
        onError: (err) => alert("Failed to update marks: " + err)
    });

    if (isExamError) return <div className="p-8 text-red-500">Error loading exam details.</div>;
    if (!exam) return <div className="p-8">Loading exam...</div>;

    // Parsers
    const handleMarkChange = (enrollmentId: number, field: 'written' | 'mcq', value: string) => {
        setEditedMarks((prev: any) => ({
            ...prev,
            [enrollmentId]: {
                ...prev[enrollmentId] || {},
                [field]: value === '' ? 0 : Number(value)
            }
        }));
    };

    const handleSaveManual = () => {
        const resultsArray = Object.values(editedMarks).map((m: any) => ({
            student_id: m.student_id,
            written_marks: m.written || 0,
            mcq_marks: m.mcq || 0
        }));

        bulkUpdateMutation.mutate({
            exam_id: parseInt(id!),
            results: resultsArray
        });
    };

    const exportCSV = () => {
        if (!meritList) return;
        // Ensure strictly sorted by Total Score
        const sortedList = [...meritList].sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0));

        const ws = XLSX.utils.json_to_sheet(sortedList.map((r: any) => ({
            Name: r?.enrollment?.student?.name || 'Unknown',
            Roll: r?.enrollment?.student?.roll_no || '-',
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
            r?.enrollment?.student?.name || 'Unknown',
            r?.enrollment?.student?.roll_no || '-',
            r.written_marks,
            r.mcq_marks,
            r.total_score
        ]);

        autoTable(doc, {
            head: [['Rank', 'Student Name', 'Roll No', 'Written', 'MCQ', 'Total']],
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
                        {sortedCandidates?.map((c: any, index: number) => {
                            const editData = c.editData; // Pre-calculated in sortedCandidates

                            return (
                                <tr key={c.enrollment_id || index} className={isEditing ? "bg-blue-50/30" : "hover:bg-gray-50"}>
                                    <td className="p-4 font-medium text-gray-900">
                                        {c.student?.name || 'Unknown'}
                                        <span className="block text-xs text-gray-400">Roll: {c.student?.roll_no || '-'}</span>
                                        <span className="block text-xs text-gray-400">{c.program?.program_name}</span>
                                    </td>

                                    {isEditing ? (
                                        <>
                                            <td className="p-4 text-right">
                                                <input
                                                    type="number"
                                                    className="w-20 p-1 border rounded text-right bg-white border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                                    value={editData.written}
                                                    placeholder="0"
                                                    onChange={(e) => c.enrollment_id && handleMarkChange(c.enrollment_id, 'written', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-4 text-right">
                                                <input
                                                    type="number"
                                                    className="w-20 p-1 border rounded text-right bg-white border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                                    value={editData.mcq}
                                                    placeholder="0"
                                                    onChange={(e) => c.enrollment_id && handleMarkChange(c.enrollment_id, 'mcq', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-4 text-right text-gray-400 text-sm">
                                                {(Number(editData.written) || 0) + (Number(editData.mcq) || 0)}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-4 text-right font-mono text-gray-600">{c.result_written}</td>
                                            <td className="p-4 text-right font-mono text-gray-600">{c.result_mcq}</td>
                                            <td className="p-4 text-right font-bold text-blue-600 text-lg">{c.result_total}</td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}

                        {!sortedCandidates || sortedCandidates.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">No students enrolled or results published.</td></tr>
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
