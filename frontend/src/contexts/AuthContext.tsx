import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    userName: string | null;
    dbUserId: number | null;
    roleId: number | null;
    userRole: string | null;
    loading: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [dbUserId, setDbUserId] = useState<number | null>(null);
    const [roleId, setRoleId] = useState<number | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                clearProfile();
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchUserProfile = async (authId: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('user_id, role_id, user_name')
                .eq('auth_id', authId)
                .single();

            if (error || !data) {
                console.error("Error fetching user profile:", error);
                clearProfile();
            } else {
                setUserName(data.user_name);
                setDbUserId(data.user_id);
                setRoleId(data.role_id);

                // Map role_id to name (1=Admin, 2=Teacher, 3=Student)
                const roleMap: { [key: number]: string } = { 1: 'admin', 2: 'teacher', 3: 'student' };
                setUserRole(roleMap[data.role_id] || 'unknown');
            }
        } catch (err) {
            console.error("Unexpected error fetching profile:", err);
            clearProfile();
        } finally {
            setLoading(false);
        }
    };

    const clearProfile = () => {
        setUserName(null);
        setDbUserId(null);
        setRoleId(null);
        setUserRole(null);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        clearProfile();
    };

    return (
        <AuthContext.Provider value={{ session, user, userName, dbUserId, roleId, userRole, loading, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
