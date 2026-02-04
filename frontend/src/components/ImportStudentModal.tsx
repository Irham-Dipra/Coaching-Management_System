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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Upload size={24} className="text-blue-600" />
                        Import Students
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Instructional Step */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h3 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2">
                            <Download size={16} />
                            Step 1: Get the Template
                        </h3>
                        <p className="text-sm text-blue-600 mb-3">Download the Excel template to ensure your data is formatted correctly.</p>
                        <button
                            onClick={handleDownloadTemplate}
                            className="bg-white border border-blue-200 text-blue-700 w-full py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-50 transition-colors"
                        >
                            Download Excel Template
                        </button>
                    </div>

                    {/* Upload Step */}
                    <div>
                        <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                            <FileSpreadsheet size={16} />
                            Step 2: Upload Files
                        </h3>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors bg-gray-50">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer block">
                                {file ? (
                                    <div className="text-green-600 font-bold flex flex-col items-center">
                                        <FileSpreadsheet size={32} className="mb-2" />
                                        {file.name}
                                    </div>
                                ) : (
                                    <div className="text-gray-500 flex flex-col items-center">
                                        <Upload size={32} className="mb-2 text-gray-400" />
                                        <span className="font-medium text-gray-700">Click to Select File</span>
                                        <span className="text-xs mt-1">Supports .xlsx, .xls</span>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={!file || importMutation.isPending}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        {importMutation.isPending ? 'Importing...' : 'Start Import'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportStudentModal;
