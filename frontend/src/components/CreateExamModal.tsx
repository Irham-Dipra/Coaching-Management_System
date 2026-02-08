import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExamRepository } from '../repositories/ExamRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { X, Loader2 } from 'lucide-react';

interface CreateExamModalProps {
    isOpen: boolean;
    onClose: () => void;
    programId?: string; // Made Optional
}

const CreateExamModal: React.FC<CreateExamModalProps> = ({ isOpen, onClose, programId }) => {
    const queryClient = useQueryClient();

    // Local state for Program Selection (Array now)
    const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);

    // Reset or Sync when modal opens/props change
    React.useEffect(() => {
        if (programId) {
            setSelectedProgramIds([programId]);
        } else {
            setSelectedProgramIds([]);
        }
    }, [programId, isOpen]);

    // Fetch Programs only if we need to select one (i.e. we are NOT on a specific program page)
    const { data: programs } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms,
        enabled: !programId && isOpen
    });

    const [formData, setFormData] = useState({
        exam_name: '',
        exam_date: '',
        exam_type: 'Weekly',
        subject: '',
        total_marks: 50,
        question_link: '',
        solution_link: ''
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => ExamRepository.createExam(data),
        onSuccess: () => {
            // Invalidate all related programs
            selectedProgramIds.forEach(pid => {
                queryClient.invalidateQueries({ queryKey: ['program', pid] });
            });
            queryClient.invalidateQueries({ queryKey: ['all-exams'] });

            onClose();
            setFormData({
                exam_name: '', exam_date: '', exam_type: 'Weekly',
                subject: '', total_marks: 50,
                question_link: '', solution_link: ''
            });
            if (!programId) setSelectedProgramIds([]);
        },
        onError: (err) => {
            alert("Failed to create exam: " + err);
        }
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedProgramIds.length === 0) {
            alert("Please select at least one program.");
            return;
        }

        createMutation.mutate({
            ...formData,
            program_ids: selectedProgramIds.map(id => parseInt(id)),
            total_marks: Number(formData.total_marks),
            exam_date: formData.exam_date || null
        });
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto pt-10 pb-10">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-4">Schedule New Exam</h2>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Program Selector (Multi-Select) - Show only if not pre-linked to a program */}
                    {!programId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Programs / Batches</label>
                            <div className="border rounded-md max-h-40 overflow-y-auto p-2 bg-gray-50 grid grid-cols-1 gap-1">
                                {programs?.map((p: any) => (
                                    <label key={p.program_id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 rounded"
                                            checked={selectedProgramIds.includes(String(p.program_id))}
                                            onChange={() => toggleProgram(String(p.program_id))}
                                        />
                                        <span className="text-sm text-gray-700">{p.program_name} <span className="text-xs text-gray-500">({p.batch?.batch_name})</span></span>
                                    </label>
                                ))}
                            </div>
                            {selectedProgramIds.length === 0 && <p className="text-xs text-red-500 mt-1">Required*</p>}
                        </div>
                    )}

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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Question Paper Link</label>
                            <input
                                name="question_link" type="text"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white text-sm"
                                placeholder="https://drive.google.com/..."
                                value={formData.question_link} onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Solution/Solve Link</label>
                            <input
                                name="solution_link" type="text"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white text-sm"
                                placeholder="https://..."
                                value={formData.solution_link} onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="button" onClick={onClose} className="mr-3 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                            Cancel
                        </button>
                        <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                            {createMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
                            Create Exam
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CreateExamModal;
