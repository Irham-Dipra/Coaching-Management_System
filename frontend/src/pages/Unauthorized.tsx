import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Unauthorized: React.FC = () => {
    const { signOut } = useAuth();

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldAlert className="text-orange-600" size={32} />
                </div>

                <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Restricted</h1>

                <p className="text-gray-600 mb-6">
                    You do not have permission to view this page.
                </p>

                <button
                    onClick={signOut}
                    className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
                >
                    <LogOut size={18} /> Sign Out
                </button>
            </div>
        </div>
    );
};

export default Unauthorized;
