import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { StudentRepository } from '../repositories/StudentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { X, Loader2 } from 'lucide-react';

interface CreateStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateStudentModal: React.FC<CreateStudentModalProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        name: '',
        fathers_name: '',
        school: '',
        contact: '',
        class_grade: '',
        batch_id: '' // Added batch_id to formData
    });

    // Fetch Batches
    const { data: batches } = useQuery({
        queryKey: ['batches'],
        queryFn: ProgramRepository.getAllBatches
    });

    const createMutation = useMutation({
        mutationFn: StudentRepository.addStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            onClose();
            setFormData({ name: '', fathers_name: '', school: '', contact: '', class_grade: '', batch_id: '' }); // Reset batch_id
        },
        onError: (err) => {
            alert("Failed to add student: " + err);
        }
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({
            name: formData.name,
            fathers_name: formData.fathers_name || undefined,
            school: formData.school || undefined,
            contact: formData.contact || undefined,
            class_grade: formData.class_grade ? parseInt(formData.class_grade) : undefined,
            batch_id: formData.batch_id ? parseInt(formData.batch_id) : undefined // Added batch_id to payload
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { // Updated type for HTMLSelectElement
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg p-8 relative border border-slate-700">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <X size={24} />
                </button>

                <h2 className="text-2xl font-bold mb-6 text-white text-center">Register New Student</h2>

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Main Info */}
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-1">Full Name</label>
                        <input
                            name="name" type="text" required
                            className="w-full rounded-lg border-slate-700 bg-slate-800 p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                            value={formData.name} onChange={handleChange}
                            placeholder="e.g. John Doe"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-5"> {/* Changed to grid-cols-2 */}
                        <div>
                            <label className="block text-sm font-bold text-slate-400 mb-1">Class (Grade)</label>
                            <input
                                name="class_grade" type="number"
                                className="w-full rounded-lg border-slate-700 bg-slate-800 p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 bg-none"
                                value={formData.class_grade} onChange={handleChange}
                                placeholder="e.g. 10"
                            />
                        </div>
                        <div> {/* Added new div for Batch */}
                            <label className="block text-sm font-bold text-slate-400 mb-1">Batch (Cohort)</label>
                            <select
                                name="batch_id"
                                className="w-full rounded-lg border-slate-700 bg-slate-800 p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all appearance-none"
                                value={formData.batch_id} onChange={handleChange}
                            >
                                <option value="" className="bg-slate-800 text-slate-500">Select Batch...</option>
                                {batches?.map((b: any) => (
                                    <option key={b.batch_id} value={b.batch_id} className="bg-slate-800">{b.batch_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-1">Father's Name</label>
                        <input
                            name="fathers_name" type="text"
                            className="w-full rounded-lg border-slate-700 bg-slate-800 p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                            value={formData.fathers_name} onChange={handleChange}
                            placeholder="Father's Name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-1">School/College</label>
                        <input
                            name="school" type="text"
                            className="w-full rounded-lg border-slate-700 bg-slate-800 p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                            value={formData.school} onChange={handleChange}
                            placeholder="Current School or College"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-1">Contact Number</label>
                        <input
                            name="contact" type="text"
                            className="w-full rounded-lg border-slate-700 bg-slate-800 p-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                            value={formData.contact} onChange={handleChange}
                            placeholder="Mobile Number"
                        />
                    </div>

                    <div className="flex justify-end pt-6 gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg font-medium transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={createMutation.isPending} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            {createMutation.isPending && <Loader2 className="animate-spin mr-2" size={18} />}
                            Register Student
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CreateStudentModal;
