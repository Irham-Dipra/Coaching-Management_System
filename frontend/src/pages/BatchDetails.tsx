import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import StudentList from '../components/StudentList'; // Reuse existing
import { ArrowLeft, Edit, Save, Calendar, Users, Briefcase } from 'lucide-react';

const BatchDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');

    // Fetch Batch Details
    const { data: batch, isLoading, error } = useQuery({
        queryKey: ['batch', id],
        queryFn: () => ProgramRepository.getBatchById(id!),
        enabled: !!id
    });

    // Sync state
    React.useEffect(() => {
        if (batch) {
            setEditName(batch.batch_name);
        }
    }, [batch]);

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: (name: string) => ProgramRepository.updateBatch(id!, { batch_name: name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['batch', id] });
            setIsEditing(false);
        },
        onError: (err: any) => alert("Update failed: " + err.message)
    });

    const handleSave = () => {
        if (!editName.trim()) return;
        updateMutation.mutate(editName);
    };

    if (isLoading) return <div className="p-8">Loading details...</div>;
    if (error || !batch) return <div className="p-8 text-red-500">Batch not found.</div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4 text-gray-500">
                <Link to="/batches" className="hover:text-gray-900 flex items-center gap-1 transition-colors">
                    <ArrowLeft size={16} /> Back to Batches
                </Link>
            </div>

            {/* Title & Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                        <Calendar size={24} />
                    </div>
                    <div>
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    className="text-2xl font-bold text-gray-900 border-b-2 border-purple-500 outline-none"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <h1 className="text-2xl font-bold text-gray-900">{batch.batch_name}</h1>
                        )}
                        <p className="text-gray-500 text-sm">Batch ID: #{batch.batch_id}</p>
                    </div>
                </div>

                {isEditing ? (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 shadow-sm"
                        >
                            <Save size={18} /> Save
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 text-gray-500 hover:text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-50 transition-colors"
                    >
                        <Edit size={18} /> Edit Name
                    </button>
                )}
            </div>

            {/* Programs Section */}
            <div>
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Briefcase size={20} className="text-gray-400" />
                    Programs in this Batch
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {batch.program?.map((prog: any) => (
                        <Link
                            to={`/programs/${prog.program_id}`}
                            key={prog.program_id}
                            className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all group"
                        >
                            <h3 className="font-bold text-gray-800 group-hover:text-purple-700">{prog.program_name}</h3>
                            <div className="mt-2 flex justify-between text-sm text-gray-500">
                                <span>{prog.type || 'Academic'}</span>
                                {prog.monthly_fee > 0 ? (
                                    <span className="text-green-600 font-medium">৳ {prog.monthly_fee}/mo</span>
                                ) : (
                                    <span className="text-blue-600">Free</span>
                                )}
                            </div>
                        </Link>
                    ))}

                    {(!batch.program || batch.program.length === 0) && (
                        <div className="col-span-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 italic">
                            No programs assigned to this batch yet.
                        </div>
                    )}
                </div>
            </div>

            {/* Students Section (Reusing Filtered List) */}
            <div>
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Users size={20} className="text-gray-400" />
                    Students in this Batch
                </h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                    {/* Reuse StudentList with locked Filter */}
                    <div className="p-4">
                        <StudentList fixedBatchId={id} />
                    </div>
                </div>
            </div>

        </div>
    );
};

export default BatchDetails;
