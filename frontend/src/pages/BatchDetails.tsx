import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import StudentList from '../components/StudentList';
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

    if (isLoading) return <div className="p-8 text-slate-400">Loading details...</div>;
    if (error || !batch) return <div className="p-8 text-red-500">Batch not found.</div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4 text-slate-500">
                <Link to="/admin/batches" className="hover:text-white flex items-center gap-1 transition-colors">
                    <ArrowLeft size={16} /> Back to Batches
                </Link>
            </div>

            {/* Title & Actions */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20">
                        <Briefcase size={24} />
                    </div>
                    <div>
                        {isEditing ? (
                            <input
                                className="text-2xl font-bold text-white bg-slate-900 border-b-2 border-blue-500 outline-none w-64 px-2 py-1 rounded-t"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                autoFocus
                                placeholder="Batch Name"
                            />
                        ) : (
                            <div>
                                <h1 className="text-2xl font-bold text-white">{batch.batch_name}</h1>
                                <p className="text-slate-400 text-sm flex items-center gap-2">
                                    <span className="bg-slate-700 px-2 py-0.5 rounded text-xs border border-slate-600">ID: {batch.batch_id}</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-500 shadow-lg shadow-blue-900/20 border border-blue-500/50 transition-all font-medium"
                        >
                            <Save size={18} /> Save Changes
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 text-slate-400 hover:text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 transition-all"
                    >
                        <Edit size={18} /> Edit Batch
                    </button>
                )}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Programs */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Calendar size={20} className="text-purple-400" /> Programs
                        </h2>
                        <div className="space-y-3">
                            {batch.programs && batch.programs.length > 0 ? (
                                batch.programs.map((prog: any) => (
                                    <Link key={prog.program_id} to={`/admin/programs/${prog.program_id}`} className="block">
                                        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-purple-500/50 hover:bg-slate-800 transition-all group">
                                            <h3 className="font-semibold text-slate-200 group-hover:text-purple-400 transition-colors">{prog.program_name}</h3>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-xs text-slate-500">
                                                    Starts: {prog.start_date ? new Date(prog.start_date).toLocaleDateString() : 'TBD'}
                                                </span>
                                                <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                                                    View
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <p className="text-slate-500 italic text-sm text-center py-4">No programs in this batch yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Students */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Users size={20} className="text-emerald-400" /> Batch Students
                            </h2>
                            <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                                Auto-filtered by Batch ID
                            </span>
                        </div>
                        <div className="p-4 flex-1 bg-slate-900/30">
                            {/* Reusing StudentList with fixedBatchId prop */}
                            <StudentList fixedBatchId={id} />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BatchDetails;
