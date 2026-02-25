import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExamRepository } from '../repositories/ExamRepository';
import { X, Upload, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface UploadResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    examId: string;
    onDownloadTemplate?: (sortBy: 'student_code' | 'program') => void;
    studentLookup?: Record<string, number>; // Maps "student_code" -> student_id
}

const UploadResultsModal: React.FC<UploadResultsModalProps> = ({ isOpen, onClose, examId, onDownloadTemplate, studentLookup }) => {
    const queryClient = useQueryClient();
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [templateSortMode, setTemplateSortMode] = useState<'student_code' | 'program'>('student_code');

    // Mutation to send data to backend
    const uploadMutation = useMutation({
        mutationFn: (results: any[]) => ExamRepository.submitBulkResults({
            exam_id: parseInt(examId),
            results: results
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analytics', examId] });
            queryClient.invalidateQueries({ queryKey: ['merit', examId] });
            queryClient.invalidateQueries({ queryKey: ['candidates', examId] }); // Refresh list
            onClose();
            setFile(null);
            setPreviewData([]);
            alert("Results uploaded successfully!");
        },
        onError: (err) => {
            alert("Failed to upload results: " + err);
        }
    });

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsParsing(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Map keys to lowercase/standardize
                const formattedData = data.map((row: any) => {
                    const rawCode = row['Student Code'] || row['student_code'] || row['Code'] || row['Student ID'] || row['student_id'] || row['ID'];

                    // Resolve ID from Code using Lookup if available
                    let resolvedId = rawCode;
                    if (studentLookup && rawCode) {
                        const lookupId = studentLookup[String(rawCode)];
                        if (lookupId) resolvedId = lookupId;
                    }

                    const wRaw = row['Written'] ?? row['written'] ?? row['Written Marks'] ?? row['written_marks'];
                    const mcqRaw = row['MCQ'] ?? row['mcq'] ?? row['MCQ Marks'] ?? row['mcq_marks'];

                    let w = (wRaw === '' || wRaw === undefined || wRaw === null) ? null : Number(wRaw);
                    let mcq = (mcqRaw === '' || mcqRaw === undefined || mcqRaw === null) ? null : Number(mcqRaw);

                    // If one mark is provided but the other is missing, default the missing one to 0
                    if (w !== null && mcq === null) mcq = 0;
                    if (mcq !== null && w === null) w = 0;

                    return {
                        student_id: resolvedId,
                        written_marks: w,
                        mcq_marks: mcq
                    };
                }).filter((r: any) => r.student_id && (r.written_marks !== null || r.mcq_marks !== null)); // Filter out empty rows

                setPreviewData(formattedData);
            } catch (err) {
                alert("Error parsing file. Make sure it's a valid Excel file.");
                setFile(null);
            } finally {
                setIsParsing(false);
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg p-6 relative border border-slate-700">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                    <Upload className="text-blue-400" /> Upload Results
                </h2>

                <div className="space-y-6">
                    {/* Template Download */}
                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-blue-400">Need a format?</h3>
                            <p className="text-xs text-blue-300/70 mb-2">Download the pre-filled Excel template.</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Sort by:</span>
                                <select
                                    className="bg-slate-800 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none focus:border-blue-500 cursor-pointer"
                                    value={templateSortMode}
                                    onChange={(e) => setTemplateSortMode(e.target.value as any)}
                                >
                                    <option value="student_code">Student Code (Ascending)</option>
                                    <option value="program">Programs</option>
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={() => onDownloadTemplate && onDownloadTemplate(templateSortMode)}
                            disabled={!onDownloadTemplate}
                            className="text-xs bg-slate-800 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-500/10 flex items-center gap-1 transition-colors font-semibold disabled:opacity-50 whitespace-nowrap"
                        >
                            <Download size={14} /> Download Template
                        </button>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex gap-2 items-start text-xs text-amber-200/90 shadow-inner">
                        <span className="text-amber-400 font-bold mt-0.5">Note:</span>
                        <p>The uploaded file is treated as the absolute source of truth for all candidates. If a student is completely omitted from the uploaded file or their marks are left blank, their existing marks will be <strong>deleted</strong> and reset to "Not Recorded".</p>
                    </div>

                    {/* File Input */}
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors relative bg-slate-800/50 group">
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                            <FileSpreadsheet className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform" size={48} />
                            {isParsing ? (
                                <div className="animate-fade-in">
                                    <p className="font-bold text-white mb-1">Parsing File...</p>
                                    <p className="text-sm text-slate-400">Please wait</p>
                                </div>
                            ) : file ? (
                                <div className="animate-fade-in">
                                    <p className="font-bold text-white mb-1">{file.name}</p>
                                    <p className="text-sm text-emerald-400 font-mono">{previewData.length} records found</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="font-bold text-slate-300">Click to Upload Excel File</p>
                                    <p className="text-xs text-slate-500 mt-1">Supports .xlsx, .csv</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview removed as per request */}

                    <div className="flex justify-end pt-4 gap-3 border-t border-slate-700/50">
                        <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white font-medium transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                const presentIds = new Set(previewData.map(r => r.student_id));
                                const allIds = studentLookup ? new Set(Object.values(studentLookup)) : new Set();
                                const missingRecords = Array.from(allIds)
                                    .filter(id => !presentIds.has(id as number))
                                    .map(id => ({ student_id: id, written_marks: null, mcq_marks: null }));

                                uploadMutation.mutate([...previewData, ...missingRecords]);
                            }}
                            disabled={!file || uploadMutation.isPending}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                        >
                            {uploadMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                            Upload & Process
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadResultsModal;
