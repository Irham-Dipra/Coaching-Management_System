import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProgramRepository } from '../repositories/ProgramRepository';
import StudentList from '../components/StudentList';
import BatchPerformance from './BatchPerformance';
import { ArrowLeft, Edit, Save, Calendar, Users, Briefcase, TrendingUp } from 'lucide-react';

const BatchDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'performance'>('overview');

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
                <Link to="/batches" className="hover:text-white flex items-center gap-1 transition-colors">
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

            {/* Tabs */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                <div className="flex border-b border-slate-700/50">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-4 text-sm font-bold text-center transition-all whitespace-nowrap ${activeTab === 'overview'
                            ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Briefcase size={16} /> Overview
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('performance')}
                        className={`flex-1 py-4 text-sm font-bold text-center transition-all whitespace-nowrap ${activeTab === 'performance'
                            ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5'
                            : 'text-emerald-500/70 hover:text-emerald-300 hover:bg-emerald-500/10'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <TrendingUp size={16} /> Performance
                        </div>
                    </button>
                </div>

                <div className="p-6">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8">

                            {/* Section: Assigned Programs */}
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Calendar size={24} className="text-purple-400" /> Assigned Programs
                                </h2>

                                {batch.programs && batch.programs.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {batch.programs.map((prog: any) => (
                                            <Link key={prog.program_id} to={`/programs/${prog.program_id}`} className="block h-full">
                                                <div className="h-full bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700 p-6 hover:border-purple-500/50 hover:bg-slate-800 transition-all group shadow-lg flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                                                <Briefcase size={20} />
                                                            </div>
                                                            {prog.status && (
                                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${prog.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                                    'bg-slate-700 text-slate-400 border border-slate-600'
                                                                    }`}>
                                                                    {prog.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="text-lg font-bold text-slate-200 group-hover:text-white transition-colors mb-2 line-clamp-2">
                                                            {prog.program_name}
                                                        </h3>
                                                    </div>

                                                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center text-sm text-slate-400">
                                                        <span className="flex items-center gap-1.5">
                                                            <Calendar size={14} />
                                                            {prog.start_date ? new Date(prog.start_date).toLocaleDateString() : 'No Start Date'}
                                                        </span>
                                                        <span className="text-purple-400 font-medium text-xs bg-purple-500/10 px-2 py-1 rounded group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                                            View Details →
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-8 text-center">
                                        <Briefcase size={48} className="mx-auto text-slate-600 mb-3" />
                                        <p className="text-slate-400 font-medium">No programs assigned to this batch.</p>
                                        <p className="text-slate-500 text-sm mt-1">Create a program and assign it to this batch to see it here.</p>
                                    </div>
                                )}
                            </div>

                            {/* Section: Students List */}
                            <div className="space-y-4">
                                <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col">
                                    <div className="p-6 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/80">
                                        <div>
                                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                <Users size={24} className="text-emerald-400" /> Student Directory
                                            </h2>
                                            <p className="text-slate-400 text-sm mt-1">Manage all students enrolled in this batch.</p>
                                        </div>
                                    </div>
                                    <div className="p-0 bg-slate-900/30">
                                        <StudentList fixedBatchId={id} hideHeader={true} />
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* PERFORMANCE TAB */}
                    {activeTab === 'performance' && (
                        <BatchPerformance batchId={id!} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default BatchDetails;
