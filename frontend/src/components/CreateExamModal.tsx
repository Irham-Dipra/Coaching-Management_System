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

    // Local state for Program Selection if programId is not passed
    const [selectedProgramId, setSelectedProgramId] = useState(programId || '');

    // Reset or Sync when modal opens/props change
    React.useEffect(() => {
        if (programId) setSelectedProgramId(programId);
    }, [programId, isOpen]);

    // Fetch Programs only if we need to select one
    const { data: programs } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms,
        enabled: !programId && isOpen // Only fetch if no programId provided
    });

    const [formData, setFormData] = useState({
        exam_name: '',
        exam_date: '',
        exam_type: 'Weekly',
        subject: '',
        total_marks: 50
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => ExamRepository.createExam(data),
        onSuccess: () => {
            // Invalidate specific program if we know it, otherwise specific one we selected
            if (programId) {
                queryClient.invalidateQueries({ queryKey: ['program', programId] });
            }
            if (selectedProgramId) {
                queryClient.invalidateQueries({ queryKey: ['program', selectedProgramId] });
            }
            // Also invalidate all-exams list for the directory page
            queryClient.invalidateQueries({ queryKey: ['all-exams'] });

            onClose();
            setFormData({ exam_name: '', exam_date: '', exam_type: 'Weekly', subject: '', total_marks: 50 });
            if (!programId) setSelectedProgramId('');
        },
        onError: (err) => {
            alert("Failed to create exam: " + err);
        }
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedProgramId) {
            alert("Please select a program.");
            return;
        }

        createMutation.mutate({
            ...formData,
            program_id: parseInt(selectedProgramId),
            total_marks: Number(formData.total_marks),
            exam_date: formData.exam_date || null
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-4">Schedule New Exam</h2>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Program Selector (Only if programId missing) */}
                    {!programId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Program / Batch</label>
                            <select
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                                value={selectedProgramId}
                                onChange={(e) => setSelectedProgramId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Program --</option>
                                {programs?.map((p: any) => (
                                    <option key={p.program_id} value={p.program_id}>
                                        {p.program_name}
                                    </option>
                                ))}
                            </select>
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
