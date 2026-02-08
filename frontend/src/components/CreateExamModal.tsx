import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExamRepository } from '../repositories/ExamRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { X } from 'lucide-react';

interface CreateExamModalProps {
    isOpen: boolean;
    onClose: () => void;
    programId?: string;
    examData?: any; // For editing
}

const CreateExamModal: React.FC<CreateExamModalProps> = ({ isOpen, onClose, programId, examData }) => {
    const queryClient = useQueryClient();
    const isEditing = !!examData;

    // Local state for Program Selection (Array now)
    const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);

    // Local state for dropdown visibility
    const [isProgramDropdownOpen, setIsProgramDropdownOpen] = useState(false);

    // Initial Form State
    const initialFormState = {
        exam_name: '',
        exam_date: '',
        exam_type: 'Weekly',
        subject: '',
        total_marks: 50,
        question_link: '',
        solution_link: ''
    };

    const [formData, setFormData] = useState(initialFormState);

    // Reset or Sync when modal opens/props change
    React.useEffect(() => {
        if (isOpen) {
            if (isEditing && examData) {
                // Pre-fill for Edit Mode
                setFormData({
                    exam_name: examData.exam_name || '',
                    exam_date: examData.exam_date || '',
                    exam_type: examData.exam_type || 'Weekly',
                    subject: examData.subject || '',
                    total_marks: examData.total_marks || 50,
                    question_link: examData.question_link || '',
                    solution_link: examData.solution_link || ''
                });

                // Extract linked program IDs
                // Structure: examData.program_exam = [{ program: { program_id: 1, ... } }, ...]
                if (examData.program_exam) {
                    const linkedIds = examData.program_exam.map((pe: any) =>
                        String(pe.program_id || pe.program?.program_id)
                    ).filter((id: string) => id && id !== 'undefined');
                    setSelectedProgramIds(linkedIds);
                } else {
                    setSelectedProgramIds([]);
                }

            } else {
                // Reset for Create Mode
                setFormData(initialFormState);
                if (programId) {
                    setSelectedProgramIds([programId]);
                } else {
                    setSelectedProgramIds([]);
                }
            }
        }
    }, [programId, isOpen, examData]);

    // Fetch Programs only if we need to select one (i.e. we are NOT on a specific program page)
    const { data: programs } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms,
        enabled: isOpen // Always fetch to allow editing programs
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => ExamRepository.createExam(data),
        onSuccess: () => {
            handleSuccess("Exam created successfully!");
        },
        onError: (err) => alert("Failed to create exam: " + err)
    });

    const updateMutation = useMutation({
        mutationFn: (data: any) => ExamRepository.updateExam(examData?.exam_id, data),
        onSuccess: () => {
            handleSuccess("Exam updated successfully!");
        },
        onError: (err) => alert("Failed to update exam: " + err)
    });

    const handleSuccess = (msg: string) => {
        // Invalidate all related programs
        selectedProgramIds.forEach(pid => {
            queryClient.invalidateQueries({ queryKey: ['program', pid] });
        });
        queryClient.invalidateQueries({ queryKey: ['all-exams'] });

        // Also invalidate specific exam details AND candidates
        if (isEditing && examData?.exam_id) {
            queryClient.invalidateQueries({ queryKey: ['exam', String(examData.exam_id)] });
            queryClient.invalidateQueries({ queryKey: ['candidates', String(examData.exam_id)] });
        }

        onClose();
        alert(msg);
    };

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedProgramIds.length === 0) {
            alert("Please select at least one program.");
            return;
        }

        const payload = {
            ...formData,
            program_ids: selectedProgramIds.map(id => parseInt(id)),
            total_marks: Number(formData.total_marks),
            exam_date: formData.exam_date || null
        };

        if (isEditing) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const toggleProgram = (pid: string) => {
        setSelectedProgramIds(prev =>
            prev.includes(pid)
                ? prev.filter(id => id !== pid)
                : [...prev, pid]
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-4">
                    {isEditing ? 'Edit Exam Details' : 'Schedule New Exam'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Program Selector (Collapsible Dropdown) - Always show now to allow editing */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Programs / Batches</label>

                        <button
                            type="button"
                            onClick={() => setIsProgramDropdownOpen(!isProgramDropdownOpen)}
                            className="w-full flex justify-between items-center px-4 py-2 border rounded-md bg-white text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <span>
                                {selectedProgramIds.length === 0
                                    ? "Select Programs..."
                                    : `${selectedProgramIds.length} Program(s) Selected`}
                            </span>
                            <span className="text-xs text-gray-500">{isProgramDropdownOpen ? '▲' : '▼'}</span>
                        </button>

                        {isProgramDropdownOpen && (
                            <div className="mt-2 border rounded-md max-h-60 overflow-y-auto p-2 bg-gray-50 grid grid-cols-1 gap-1 shadow-inner">
                                {programs?.map((p: any) => (
                                    <label key={p.program_id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 rounded"
                                            checked={selectedProgramIds.some(id => String(id) === String(p.program_id))}
                                            onChange={() => toggleProgram(String(p.program_id))}
                                        />
                                        <span className="text-sm text-gray-700">{p.program_name} <span className="text-xs text-gray-500">({p.batch?.batch_name})</span></span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {selectedProgramIds.length === 0 && <p className="text-xs text-red-500 mt-1">Required*</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Exam Title</label>
                        <input
                            name="exam_name" type="text" required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            placeholder="e.g. Physics Weekly Test 5"
                            value={formData.exam_name} onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Type</label>
                            <select
                                name="exam_type"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                                value={formData.exam_type} onChange={handleChange}
                            >
                                <option value="Weekly">Weekly</option>
                                <option value="Monthly">Monthly</option>
                                <option value="Term">Term Final</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Total Marks</label>
                            <input
                                name="total_marks" type="number" required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                                value={formData.total_marks} onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Date</label>
                        <input
                            name="exam_date" type="date"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            value={formData.exam_date} onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Subject (Optional)</label>
                        <input
                            name="subject" type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            value={formData.subject} onChange={handleChange}
                        />
                    </div>

                    {/* Link Fields */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Question Paper Link (Google Drive)</label>
                        <input
                            name="question_link" type="url"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            placeholder="https://..."
                            value={formData.question_link} onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Solution Link (Google Drive)</label>
                        <input
                            name="solution_link" type="url"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            placeholder="https://..."
                            value={formData.solution_link} onChange={handleChange}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 shadow-sm font-medium"
                    >
                        {isEditing ? 'Update Exam' : 'Schedule Exam'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateExamModal;
