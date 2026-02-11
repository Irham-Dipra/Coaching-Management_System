import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { X, Loader2, Edit } from 'lucide-react';

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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
            <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-slate-700">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Edit size={20} className="text-blue-400" /> Edit Program Details
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">

                    {/* Program Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Program Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={formData.program_name}
                            onChange={e => setFormData({ ...formData, program_name: e.target.value })}
                        />
                    </div>

                    {/* Batch Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Batch</label>
                        <select
                            required
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                        <label className="block text-sm font-medium text-slate-300 mb-1">Monthly Fee (৳)</label>
                        <input
                            type="number"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={formData.monthly_fee}
                            onChange={e => setFormData({ ...formData, monthly_fee: Number(e.target.value) })}
                        />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                            <input
                                type="date"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={formData.start_date}
                                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
                            <input
                                type="date"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={formData.end_date}
                                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Routine Link */}
                    <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                        <label className="block text-sm font-bold text-blue-400 mb-1">Class Routine (Drive Link)</label>
                        <input
                            type="url"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="https://drive.google.com/..."
                            value={formData.routine}
                            onChange={e => setFormData({ ...formData, routine: e.target.value })}
                        />
                        <p className="text-xs text-blue-300/60 mt-1">Paste a public Google Drive or PDF link here.</p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                        >
                            {updateMutation.isPending && <Loader2 className="animate-spin" size={16} />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProgramModal;
