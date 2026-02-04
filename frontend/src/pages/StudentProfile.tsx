import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentRepository } from '../repositories/StudentRepository';
import { ProgramRepository } from '../repositories/ProgramRepository';
import StudentFinancialStatus from '../components/StudentFinancialStatus';
import { User, Calendar, BookOpen, CreditCard, Edit2, Save, Plus, Trash2 } from 'lucide-react';

const StudentProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [selectedProgramId, setSelectedProgramId] = useState('');

    // 1. Fetch Student Details
    const { data: student, isLoading } = useQuery({
        queryKey: ['student', id],
        queryFn: () => StudentRepository.getStudentById(id!),
        enabled: !!id
    });

    // 2. Fetch Enrollments
    const { data: enrollments } = useQuery({
        queryKey: ['enrollments', id],
        queryFn: () => StudentRepository.getEnrollments(id!),
        enabled: !!id
    });

    // 3. Fetch All Programs (for enrollment dropdown)
    const { data: allPrograms } = useQuery({
        queryKey: ['programs'],
        queryFn: ProgramRepository.getAllPrograms
    });

    // 4. Fetch Batches (for profile edit)
    const { data: batches } = useQuery({
        queryKey: ['batches'],
        queryFn: ProgramRepository.getAllBatches
    });

    // Mutations
    const updateMutation = useMutation({
        mutationFn: (updates: any) => StudentRepository.updateStudent(id!, updates),
        onSuccess: () => {
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ['student', id] });
        }
    });

    const enrollMutation = useMutation({
        mutationFn: (programId: number) => StudentRepository.enrollStudent({
            student_id: parseInt(id!),
            program_id: programId
        }),
        onSuccess: () => {
            setShowEnrollModal(false);
            queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    const deleteEnrollmentMutation = useMutation({
        mutationFn: StudentRepository.deleteEnrollment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enrollments', id] });
        },
        onError: (err) => {
            alert("Failed to delete enrollment");
        }
    });

    if (isLoading) return <div className="p-8">Loading profile...</div>;
    if (!student) return <div className="p-8">Student not found</div>;

    const handleEditToggle = () => {
        setEditForm(student);
        setIsEditing(true);
    };

    const handleSave = () => {
        updateMutation.mutate(editForm);
    };

    return (
        <div className="max-w-5xl mx-auto">
            {/* HEADER CARD */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                            <User size={40} />
                        </div>
                        <div>
                            {isEditing ? (
                                <div className="space-y-2">
                                    <input
                                        className="block w-full border p-1 rounded font-bold text-xl text-gray-900 bg-white"
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        placeholder="Full Name"
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            className="border p-1 rounded text-sm text-gray-900 bg-white w-20" placeholder="Class"
                                            value={editForm.class || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setEditForm({ ...editForm, class: val === '' ? '' : parseInt(val) });
                                            }}
                                        />
                                        <select
                                            className="border p-1 rounded text-sm text-gray-900 bg-white min-w-[120px]"
                                            value={editForm.batch_id || ''}
                                            onChange={e => setEditForm({ ...editForm, batch_id: e.target.value ? parseInt(e.target.value) : null })}
                                        >
                                            <option value="">No Batch</option>
                                            {batches?.map((b: any) => (
                                                <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
                                    <div className="flex gap-2 text-gray-500 items-center">
                                        <span>Class {student.class}</span>
                                        {student.batch && (
                                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold uppercase">
                                                {student.batch.batch_name}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">Student ID: #{student.student_id}</p>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 font-medium text-sm flex items-center gap-2">
                            <CreditCard size={16} /> ID Card
                        </button>
                        <button className="border border-red-200 text-red-600 px-4 py-2 rounded hover:bg-red-50 font-medium text-sm">
                            Suspend
                        </button>
                        {isEditing ? (
                            <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2">
                                <Save size={16} /> Save
                            </button>
                        ) : (
                            <button onClick={handleEditToggle} className="border border-gray-300 px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-50 text-gray-700">
                                <Edit2 size={16} /> Edit Profile
                            </button>
                        )}
                    </div>
                </div>

                {/* DETAILS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-6 border-t border-gray-100">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Father's Name</label>
                        {isEditing ? (
                            <input
                                className="block w-full border p-1 rounded text-gray-900 bg-white"
                                value={editForm.fathers_name || ''}
                                onChange={e => setEditForm({ ...editForm, fathers_name: e.target.value })}
                            />
                        ) : (
                            <p className="text-gray-800 font-medium">{student.fathers_name || '-'}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">School/College</label>
                        {isEditing ? (
                            <input
                                className="block w-full border p-1 rounded text-gray-900 bg-white"
                                value={editForm.school || ''}
                                onChange={e => setEditForm({ ...editForm, school: e.target.value })}
                            />
                        ) : (
                            <p className="text-gray-800 font-medium">{student.school || '-'}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Contact</label>
                        {isEditing ? (
                            <input
                                className="block w-full border p-1 rounded text-gray-900 bg-white"
                                value={editForm.contact || ''}
                                onChange={e => setEditForm({ ...editForm, contact: e.target.value })}
                            />
                        ) : (
                            <p className="text-gray-800 font-medium">{student.contact || '-'}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-6">

                {/* MAIN CONTENT: Enrollments & Finance */}
                <div className="space-y-6">
                    {/* FINANCIAL STATUS */}
                    <StudentFinancialStatus studentId={id!} />

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <BookOpen size={20} className="text-blue-600" />
                                Enrolled Programs
                            </h3>
                            <button
                                onClick={() => setShowEnrollModal(true)}
                                className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium hover:bg-blue-100"
                            >
                                + Enroll
                            </button>
                        </div>

                        {showEnrollModal && (
                            <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-100">
                                <p className="text-sm font-bold text-blue-800 mb-2">Select Program to Enroll</p>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 border p-2 rounded text-gray-900 bg-white"
                                        value={selectedProgramId}
                                        onChange={e => setSelectedProgramId(e.target.value)}
                                    >
                                        <option value="">Choose a Program...</option>
                                        {allPrograms?.map((p: any) => (
                                            <option key={p.program_id} value={p.program_id}>
                                                {p.program_name} (Batch: {p.batch?.batch_name})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => enrollMutation.mutate(parseInt(selectedProgramId))}
                                        className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700"
                                        disabled={!selectedProgramId}
                                    >
                                        Confirm
                                    </button>
                                    <button onClick={() => setShowEnrollModal(false)} className="text-gray-500 px-2">Cancel</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {enrollments?.map((enroll: any) => (
                                <div key={enroll.enrollment_id} className="border border-gray-100 p-4 rounded-lg flex justify-between items-center hover:bg-gray-50 group">
                                    <div>
                                        <p className="font-bold text-gray-900">{enroll.program?.program_name || 'Unknown Program'}</p>
                                        <div className="flex gap-3 mt-1 text-sm text-gray-500">
                                            <span className="font-mono bg-gray-100 px-2 rounded text-gray-700 font-bold">Roll: {enroll.roll_no || 'N/A'}</span>
                                            <span>Joined: {enroll.enrollment_date || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (confirm("Are you sure you want to remove this enrollment?")) {
                                                deleteEnrollmentMutation.mutate(enroll.enrollment_id);
                                            }
                                        }}
                                        className="text-red-400 hover:text-red-600 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete Enrollment"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                            {(!enrollments || enrollments.length === 0) && (
                                <p className="text-center text-gray-400 py-4">Not enrolled in any programs yet.</p>
                            )}
                        </div>
                    </div>
                </div>



            </div>
        </div>
    );
};

export default StudentProfile;
