import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { Loader2, Plus, Calendar, Layers } from 'lucide-react';

const Batches: React.FC = () => {
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newBatchName, setNewBatchName] = useState('');

    // Fetch Batches
    const { data: batches, isLoading } = useQuery({
        queryKey: ['batches'],
        queryFn: ProgramRepository.getAllBatches
    });

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: (name: string) => ProgramRepository.createBatch({ batch_name: name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['batches'] });
            setIsCreateOpen(false);
            setNewBatchName('');
        },
        onError: (err) => alert("Failed to create batch: " + err)
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newBatchName);
    };

    if (isLoading) return <div className="p-8">Loading batches...</div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Layers className="text-purple-600" /> Batches
                    </h1>
                    <p className="text-gray-500 text-sm">Manage student cohorts.</p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 font-medium shadow-sm transition-colors"
                >
                    <Plus size={18} /> New Batch
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {batches?.map((batch: any) => (
                    <Link to={`/batches/${batch.batch_id}`} key={batch.batch_id} className="block group">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 group-hover:shadow-md group-hover:border-purple-200 transition-all">
                            <div className="flex items-start justify-between mb-2">
                                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                                    <Calendar size={20} />
                                </div>
                                <div className="text-gray-300 group-hover:text-purple-400 transition-colors">
                                    <Layers size={16} />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 group-hover:text-purple-700">{batch.batch_name}</h3>
                            <p className="text-xs text-gray-400 mt-1">ID: #{batch.batch_id}</p>
                        </div>
                    </Link>
                ))}

                {(!batches || batches.length === 0) && (
                    <div className="col-span-full border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400">
                        <Layers size={40} className="mb-2 opacity-20" />
                        <p>No batches found.</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Create New Batch</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Batch Name</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="e.g. HSC 2026, Summer 2025"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                    value={newBatchName}
                                    onChange={e => setNewBatchName(e.target.value)}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-bold hover:bg-purple-700 flex justify-center items-center gap-2 transition-colors"
                            >
                                {createMutation.isPending && <Loader2 className="animate-spin" size={18} />}
                                Create Batch
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Batches;
