import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { X, Loader2 } from 'lucide-react';

interface EditProgramModalProps {
    isOpen: boolean;
    onClose: () => void;
    program: any;
}

const EditProgramModal: React.FC<EditProgramModalProps> = ({ isOpen, onClose, program }) => {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        program_name: '',
        batch_id: '',
        monthly_fee: 0,
        start_date: '',
        end_date: '',
        routine: ''
    });

    // Populate form data when program changes
    useEffect(() => {
        if (program) {
            setFormData({
                program_name: program.program_name || '',
                batch_id: program.batch_id?.toString() || '',
                monthly_fee: program.monthly_fee || 0,
                start_date: program.start_date || '',
                end_date: program.end_date || '',
                routine: program.routine || ''
            });
        }
    }, [program]);

    // Fetch Batches for Dropdown
    const { data: batches } = useQuery({
        queryKey: ['batches'],
        queryFn: ProgramRepository.getAllBatches
    });

    const updateMutation = useMutation({
        mutationFn: (data: any) => ProgramRepository.updateProgram(program.program_id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['program', program.program_id.toString()] });
            // Also invalidate list
            queryClient.invalidateQueries({ queryKey: ['programs'] });
            onClose();
        },
        onError: (err) => {
            alert("Failed to update program: " + err);
        }
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...formData,
            batch_id: formData.batch_id ? parseInt(formData.batch_id) : null,
            monthly_fee: parseFloat(formData.monthly_fee.toString()),
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            routine: formData.routine || null
        };

        updateMutation.mutate(payload);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-4">Edit Program Details</h2>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Program Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Program Name</label>
                        <input
                            type="text"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            value={formData.program_name}
                            onChange={e => setFormData({ ...formData, program_name: e.target.value })}
                        />
                    </div>

                    {/* Batch Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Batch</label>
                        <select
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            value={formData.batch_id}
                            onChange={e => setFormData({ ...formData, batch_id: e.target.value })}
                        >
                            <option value="">Select a Batch</option>
                            {batches?.map((b: any) => (
                                <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Fee */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Monthly Fee (৳)</label>
                        <input
                            type="number"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            value={formData.monthly_fee}
                            onChange={e => setFormData({ ...formData, monthly_fee: Number(e.target.value) })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input
                                type="date"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                                value={formData.start_date}
                                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">End Date</label>
                            <input
                                type="date"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                                value={formData.end_date}
                                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Routine Link */}
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <label className="block text-sm font-bold text-blue-800">Class Routine (Drive Link)</label>
                        <input
                            type="url"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white placeholder-gray-400"
                            placeholder="https://drive.google.com/..."
                            value={formData.routine}
                            onChange={e => setFormData({ ...formData, routine: e.target.value })}
                        />
                        <p className="text-xs text-blue-600 mt-1">Paste a public Google Drive or PDF link here.</p>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="mr-3 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                        >
                            {updateMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
                            Save Changes
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default EditProgramModal;
