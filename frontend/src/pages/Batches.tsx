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

    if (isLoading) return <div className="p-8 text-slate-400">Loading batches...</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-3">
                        <Layers className="text-purple-400" /> Batches
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Manage student cohorts and academic years.</p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-purple-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-purple-500 hover:scale-105 font-bold shadow-lg shadow-purple-500/20 transition-all"
                >
                    <Plus size={20} /> New Batch
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {batches?.map((batch: any) => (
                    <Link to={`/batches/${batch.batch_id}`} key={batch.batch_id} className="block group h-full">
                        <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-slate-700/50 group-hover:border-purple-500/50 group-hover:shadow-purple-500/10 group-hover:-translate-y-1 transition-all h-full flex flex-col justify-between">
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                                        <Calendar size={24} />
                                    </div>
                                    <div className="text-slate-500 group-hover:text-purple-400 transition-colors">
                                        <Layers size={18} />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-slate-100 group-hover:text-purple-400 transition-colors">{batch.batch_name}</h3>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-500 font-mono">
                                <span>ID: #{batch.batch_id}</span>
                                <span className="text-purple-400/80 group-hover:text-purple-400 transition-colors">View Details →</span>
                            </div>
                        </div>
                    </Link>
                ))}

                {(!batches || batches.length === 0) && (
                    <div className="col-span-full border-2 border-dashed border-slate-700/50 bg-slate-800/20 rounded-xl p-12 flex flex-col items-center justify-center text-slate-500">
                        <Layers size={48} className="mb-4 opacity-50" />
                        <p className="text-lg font-medium">No batches found.</p>
                        <p className="text-sm">Create a new batch to get started.</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700">
                        <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-white text-lg">Create New Batch</h3>
                            <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-2">Batch Name</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="e.g. HSC 2026, Summer 2025"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                    value={newBatchName}
                                    onChange={e => setNewBatchName(e.target.value)}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-500 flex justify-center items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
                            >
                                {createMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
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
