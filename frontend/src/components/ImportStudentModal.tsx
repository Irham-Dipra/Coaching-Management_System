import React, { useState } from 'react';
import { Upload, X, Download, FileSpreadsheet } from 'lucide-react';
import { StudentRepository } from '../repositories/StudentRepository';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ImportStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ImportStudentModal: React.FC<ImportStudentModalProps> = ({ isOpen, onClose }) => {
    const [file, setFile] = useState<File | null>(null);
    const queryClient = useQueryClient();

    const importMutation = useMutation({
        mutationFn: StudentRepository.importStudents,
        onSuccess: (data) => {
            alert(`Successfully imported ${data.count} students!`);
            queryClient.invalidateQueries({ queryKey: ['students'] });
            onClose();
        },
        onError: (err: Error) => {
            alert(`Import failed: ${err.message}`);
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (!file) return;
        importMutation.mutate(file);
    };

    const handleDownloadTemplate = () => {
        StudentRepository.downloadTemplate();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700">
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Upload size={24} className="text-blue-500" />
                        Import Students
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Instructional Step */}
                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/20">
                        <h3 className="font-bold text-blue-400 text-sm mb-2 flex items-center gap-2">
                            <Download size={16} />
                            Step 1: Get the Template
                        </h3>
                        <p className="text-sm text-blue-300/80 mb-4">Download the Excel template to ensure your data is formatted correctly.</p>
                        <button
                            onClick={handleDownloadTemplate}
                            className="bg-slate-800 border border-blue-500/30 text-blue-400 w-full py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-500/10 transition-colors"
                        >
                            Download Excel Template
                        </button>
                    </div>

                    {/* Upload Step */}
                    <div>
                        <h3 className="font-bold text-slate-300 text-sm mb-2 flex items-center gap-2">
                            <FileSpreadsheet size={16} />
                            Step 2: Upload Files
                        </h3>
                        <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors bg-slate-800/50 group cursor-pointer relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                id="file-upload"
                            />
                            <div className="pointer-events-none">
                                {file ? (
                                    <div className="text-emerald-400 font-bold flex flex-col items-center animate-fade-in">
                                        <FileSpreadsheet size={40} className="mb-2" />
                                        <span className="break-all">{file.name}</span>
                                    </div>
                                ) : (
                                    <div className="text-slate-500 flex flex-col items-center group-hover:text-slate-400 transition-colors">
                                        <Upload size={40} className="mb-3 text-slate-600 group-hover:text-blue-500 transition-colors" />
                                        <span className="font-bold text-slate-400">Click to Select File</span>
                                        <span className="text-xs mt-1">Supports .xlsx, .xls</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={!file || importMutation.isPending}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed transition-all"
                    >
                        {importMutation.isPending ? 'Importing...' : 'Start Import'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportStudentModal;
