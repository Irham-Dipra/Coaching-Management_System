import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExamRepository } from '../repositories/ExamRepository';
import { X, Upload, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface UploadResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    examId: string;
}

const UploadResultsModal: React.FC<UploadResultsModalProps> = ({ isOpen, onClose, examId }) => {
    const queryClient = useQueryClient();
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    // Mutation to send data to backend
    const uploadMutation = useMutation({
        mutationFn: (results: any[]) => ExamRepository.submitBulkResults({
            exam_id: parseInt(examId),
            results: results
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analytics', examId] });
            queryClient.invalidateQueries({ queryKey: ['merit', examId] });
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
                const formattedData = data.map((row: any) => ({
                    student_id: row['Student ID'] || row['student_id'] || row['ID'],
                    written_marks: Number(row['Written'] || row['written'] || row['Written Marks'] || row['written_marks'] || 0),
                    mcq_marks: Number(row['MCQ'] || row['mcq'] || row['MCQ Marks'] || row['mcq_marks'] || 0)
                })).filter((r: any) => r.student_id); // Filter out empty rows

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

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            { "Student ID": 101, "Written": 35, "MCQ": 12 },
            { "Student ID": 102, "Written": 40, "MCQ": 15 },
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Result_Entry_Template.xlsx");
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
                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/20 flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-bold text-blue-400">Need a format?</h3>
                            <p className="text-xs text-blue-300/70">Download the Excel template to fill marks.</p>
                        </div>
                        <button onClick={handleDownloadTemplate} className="text-xs bg-slate-800 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-500/10 flex items-center gap-1 transition-colors font-semibold">
                            <Download size={14} /> Download Template
                        </button>
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

                    {/* Preview (First 3 rows) */}
                    {previewData.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Preview (First 3 rows)</p>
                            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden text-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-900 text-slate-400">
                                        <tr>
                                            <th className="p-2 pl-3">ID</th>
                                            <th className="p-2">Written</th>
                                            <th className="p-2">MCQ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50 text-slate-300">
                                        {previewData.slice(0, 3).map((row, i) => (
                                            <tr key={i} className="">
                                                <td className="p-2 pl-3 font-mono text-emerald-400">{row.student_id}</td>
                                                <td className="p-2">{row.written_marks}</td>
                                                <td className="p-2">{row.mcq_marks}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 gap-3 border-t border-slate-700/50">
                        <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white font-medium transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={() => uploadMutation.mutate(previewData)}
                            disabled={!file || uploadMutation.isPending || previewData.length === 0}
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
