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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-4">Register New Student</h2>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Main Info */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input
                            name="name" type="text" required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            value={formData.name} onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4"> {/* Changed to grid-cols-2 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Class (Grade)</label>
                            <input
                                name="class_grade" type="number"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                                value={formData.class_grade} onChange={handleChange}
                            />
                        </div>
                        <div> {/* Added new div for Batch */}
                            <label className="block text-sm font-medium text-gray-700">Batch (Cohort)</label>
                            <select
                                name="batch_id"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                                value={formData.batch_id} onChange={handleChange}
                            >
                                <option value="">Select Batch...</option>
                                {batches?.map((b: any) => (
                                    <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Father's Name</label>
                        <input
                            name="fathers_name" type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            value={formData.fathers_name} onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">School/College</label>
                        <input
                            name="school" type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            value={formData.school} onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                        <input
                            name="contact" type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-gray-900 bg-white"
                            value={formData.contact} onChange={handleChange}
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="button" onClick={onClose} className="mr-3 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                            Cancel
                        </button>
                        <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                            {createMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
                            Register
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CreateStudentModal;
