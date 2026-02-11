import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { X, Loader2, Plus } from 'lucide-react';

interface CreateProgramModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateProgramModal: React.FC<CreateProgramModalProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        program_name: '',
        batch_id: '',
        monthly_fee: 0,
        start_date: '',
        end_date: '',
        routine: ''
    });

    // 1. Fetch Batches for Dropdown
    const { data: batches } = useQuery({
        queryKey: ['batches'],
        queryFn: ProgramRepository.getAllBatches
    });

    // 2. Mutation for Creating Program
    const createMutation = useMutation({
        mutationFn: ProgramRepository.createProgram,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['programs'] });
            onClose();
            setFormData({ program_name: '', batch_id: '', monthly_fee: 0, start_date: '', end_date: '', routine: '' });
        },
        onError: (err) => {
            alert("Failed to create program: " + err);
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

        createMutation.mutate(payload);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
            <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-slate-700">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Plus size={20} className="text-blue-400" /> Create New Program
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
                            placeholder="e.g. Physics Cycle 1"
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
                        <p className="text-xs text-slate-500 mt-1">Don't see your batch? Create it in Settings.</p>
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

                    {/* Start Date */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                        <input
                            type="date"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={formData.start_date}
                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                        />
                    </div>

                    {/* Routine Link */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Class Routine (Drive Link)</label>
                        <input
                            type="url"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="https://drive.google.com/..."
                            value={formData.routine}
                            onChange={e => setFormData({ ...formData, routine: e.target.value })}
                        />
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
                            disabled={createMutation.isPending}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                        >
                            {createMutation.isPending && <Loader2 className="animate-spin" size={16} />}
                            Create Program
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProgramModal;
