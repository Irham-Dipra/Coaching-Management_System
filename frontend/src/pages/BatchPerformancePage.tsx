import React from 'react';
import { useParams, Link } from 'react-router-dom';
import BatchPerformance from './BatchPerformance';
import { ArrowLeft, TrendingUp } from 'lucide-react';

const BatchPerformancePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();

    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4 text-slate-500">
                <Link to={`/batches/${id}`} className="hover:text-white flex items-center gap-1 transition-colors">
                    <ArrowLeft size={16} /> Back to Batch Overview
                </Link>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center border border-emerald-500/20">
                    <TrendingUp size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Batch Performance Report</h1>
                    <p className="text-slate-400 text-sm">Aggregated analytics across all programs in this batch</p>
                </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700 p-6 shadow-xl">
                {id ? <BatchPerformance batchId={id} /> : <div className="text-slate-400">Invalid Batch ID</div>}
            </div>
        </div>
    );
};

export default BatchPerformancePage;
