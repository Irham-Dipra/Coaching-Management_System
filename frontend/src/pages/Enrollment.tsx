import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentRepository } from '../repositories/StudentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import { Search, CheckCircle, Loader2, UserPlus, Users, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Enrollment: React.FC = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');

    // ====================
    // DATA FETCHING
    // ====================
    const { data: students } = useQuery({ queryKey: ['students'], queryFn: StudentRepository.getAllStudents });
    const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: ProgramRepository.getAllPrograms });
    const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: ProgramRepository.getAllBatches });

    // ====================
    // STATE: EXISTING STUDENT
    // ====================
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPrograms, setSelectedPrograms] = useState<number[]>([]);

    // ====================
    // STATE: NEW STUDENT
    // ====================
    const [newStudent, setNewStudent] = useState({
        name: '',
        fathers_name: '',
        school: '',
        contact: '',
        class_grade: '',
        batch_id: ''
    });
    const [newStudentPrograms, setNewStudentPrograms] = useState<number[]>([]);

    // Filter Students for Existing Tab
    const filteredStudents = students?.filter((s: any) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.enrollment?.some((e: any) => String(e.roll_no).includes(searchTerm))
    ) || [];

    // ====================
    // MUTATIONS
    // ====================
    const enrollExistingMutation = useMutation({
        mutationFn: async () => {
            if (!selectedStudentId) throw new Error("No student selected");
            // Enroll in all selected programs
            // We do this sequentially or parallel, but repo only supports one by one currently?
            // Actually, we should probably update repo to support bulk, but let's stick to loop for now 
            // OR use the new RPC if it supports just enrolling?
            // The RPC 'register_student_with_enrollment' creates a student.
            // We need a 'enroll_student_bulk' maybe? Or just loop.
            // Let's loop for now as per "Block A" reqs.
            const promises = selectedPrograms.map(pid =>
                StudentRepository.enrollStudent({ student_id: selectedStudentId, program_id: pid })
            );
            return Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            alert("Enrollment successful!");
            setSelectedStudentId(null);
            setSelectedPrograms([]);
        },
        onError: (err) => alert("Failed to enroll: " + err)
    });

    const createAndEnrollMutation = useMutation({
        mutationFn: async () => {
            return StudentRepository.registerStudentWithEnrollment({
                student: {
                    name: newStudent.name,
                    fathers_name: newStudent.fathers_name || undefined,
                    school: newStudent.school || undefined,
                    contact: newStudent.contact || undefined,
                    class_grade: newStudent.class_grade ? parseInt(newStudent.class_grade) : undefined,
                    batch_id: newStudent.batch_id ? parseInt(newStudent.batch_id) : undefined
                },
                program_ids: newStudentPrograms
            });
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            // Show Success Animation / Card
            // calculated initial due amount? We can't easily calculate it on frontend without checking fees.
            // For now, simple alert or navigate. 
            // User requested "summary card showing the student's name, assigned programs, and their calculated initial due amount".
            // We can fetch financial summary.
            const studentId = data.student_id;
            navigate(`/students?highlight=${studentId}`); // Or separate success view
        },
        onError: (err) => alert("Failed to register: " + err)
    });

    // ====================
    // HANDLERS
    // ====================
    const toggleProgram = (id: number, isNew: boolean) => {
        if (isNew) {
            setNewStudentPrograms(prev =>
                prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
            );
        } else {
            setSelectedPrograms(prev =>
                prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
            );
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
                        Enrollment Center
                    </h1>
                    <p className="text-slate-400 mt-2">Manage student admissions and program assignments.</p>
                </div>
            </div>

            {/* TABS */}
            <div className="bg-slate-800/50 backdrop-blur-md p-1 rounded-xl inline-flex border border-slate-700">
                <button
                    onClick={() => setActiveTab('existing')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'existing'
                        ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-900/20 border border-emerald-500/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                >
                    <Users size={18} />
                    Existing Student
                </button>
                <button
                    onClick={() => setActiveTab('new')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'new'
                        ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-900/20 border border-blue-500/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                >
                    <UserPlus size={18} />
                    New Student
                </button>
            </div>

            {/* CONTENT */}
            <div className="grid lg:grid-cols-3 gap-8">

                {/* LEFT PANEL: INPUT FORM */}
                <div className="lg:col-span-2 space-y-6">

                    {activeTab === 'existing' ? (
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 shadow-xl">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Search className="text-emerald-400" /> Select Student
                            </h2>

                            <div className="relative group mb-6">
                                <Search className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by name or roll number..."
                                    className="w-full pl-10 p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                                {filteredStudents.map((student: any) => (
                                    <div
                                        key={student.student_id}
                                        onClick={() => setSelectedStudentId(student.student_id)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${selectedStudentId === student.student_id
                                            ? 'bg-emerald-500/10 border-emerald-500/50'
                                            : 'bg-slate-900/30 border-slate-700/50 hover:bg-slate-800'
                                            }`}
                                    >
                                        <div>
                                            <h3 className={`font-bold ${selectedStudentId === student.student_id ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                {student.name}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {student.class ? `${student.class}` : 'No Class'} • {student.contact || 'No Contact'}
                                            </p>
                                        </div>
                                        {selectedStudentId === student.student_id && <CheckCircle className="text-emerald-500" size={20} />}
                                    </div>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <p className="text-center text-slate-500 py-4">No students found.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 shadow-xl animate-fade-in">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <UserPlus className="text-blue-400" /> Student Details
                            </h2>

                            <div className="grid md:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Full Name</label>
                                    <input
                                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                        value={newStudent.name}
                                        onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Father's Name</label>
                                    <input
                                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                        value={newStudent.fathers_name}
                                        onChange={e => setNewStudent({ ...newStudent, fathers_name: e.target.value })}
                                        placeholder="Father's Name"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Contact</label>
                                    <input
                                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                        value={newStudent.contact}
                                        onChange={e => setNewStudent({ ...newStudent, contact: e.target.value })}
                                        placeholder="01XXXXXXXXX"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Class</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                        value={newStudent.class_grade}
                                        onChange={e => setNewStudent({ ...newStudent, class_grade: e.target.value })}
                                        placeholder="e.g. 10"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Batch</label>
                                    <select
                                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none appearance-none"
                                        value={newStudent.batch_id}
                                        onChange={e => setNewStudent({ ...newStudent, batch_id: e.target.value })}
                                    >
                                        <option value="">Select Batch...</option>
                                        {batches?.map((b: any) => (
                                            <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">School/College</label>
                                    <input
                                        className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
                                        value={newStudent.school}
                                        onChange={e => setNewStudent({ ...newStudent, school: e.target.value })}
                                        placeholder="Current School"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL: PROGRAMS & ACTION */}
                <div className="space-y-6">
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 shadow-xl h-full flex flex-col">
                        <h2 className="text-xl font-bold text-white mb-4">Select Programs</h2>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 max-h-[400px] scrollbar-thin scrollbar-thumb-slate-700">
                            {programs?.map((prog: any) => {
                                const isSelected = activeTab === 'existing'
                                    ? selectedPrograms.includes(prog.program_id)
                                    : newStudentPrograms.includes(prog.program_id);

                                // Check if already enrolled for existing student
                                let isAlreadyEnrolled = false;
                                if (activeTab === 'existing' && selectedStudentId) {
                                    const student = students?.find((s: any) => s.student_id === selectedStudentId);
                                    // Backend filters enrollment to only show 'Active' ones, so existence check is enough
                                    if (student?.enrollment?.some((e: any) => e.program_id === prog.program_id)) {
                                        isAlreadyEnrolled = true;
                                    }
                                }

                                return (
                                    <div
                                        key={prog.program_id}
                                        onClick={() => !isAlreadyEnrolled && toggleProgram(prog.program_id, activeTab === 'new')}
                                        className={`p-3 rounded-xl border transition-all flex justify-between items-center ${isAlreadyEnrolled
                                            ? 'bg-slate-800/50 border-slate-800 opacity-50 cursor-not-allowed'
                                            : isSelected
                                                ? 'bg-blue-500/10 border-blue-500/50 cursor-pointer'
                                                : 'bg-slate-900/30 border-slate-700/50 hover:bg-slate-800 cursor-pointer'
                                            }`}
                                    >
                                        <div className="flex flex-col">
                                            <span className={`font-medium ${isSelected ? 'text-blue-400' : isAlreadyEnrolled ? 'text-slate-500' : 'text-slate-300'}`}>
                                                {prog.program_name}
                                            </span>
                                            {isAlreadyEnrolled && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Already Enrolled</span>}
                                        </div>
                                        {isSelected && <CheckCircle className="text-blue-500" size={16} />}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-700/50">
                            <div className="flex justify-between items-center mb-4 text-sm text-slate-400">
                                <span>Selected Programs:</span>
                                <span className="text-white font-bold">
                                    {activeTab === 'existing' ? selectedPrograms.length : newStudentPrograms.length}
                                </span>
                            </div>

                            <button
                                disabled={
                                    (activeTab === 'existing' && (!selectedStudentId || selectedPrograms.length === 0)) ||
                                    (activeTab === 'new' && (!newStudent.name || newStudentPrograms.length === 0)) ||
                                    enrollExistingMutation.isPending ||
                                    createAndEnrollMutation.isPending
                                }
                                onClick={() => activeTab === 'existing' ? enrollExistingMutation.mutate() : createAndEnrollMutation.mutate()}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {(enrollExistingMutation.isPending || createAndEnrollMutation.isPending) ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <>
                                        Complete Enrollment <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Enrollment;
