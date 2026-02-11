import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    userName: string | null;
    dbUserId: number | null;
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
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user?.email) {
                fetchUserProfile(session.user.email);
            } else {
                setLoading(false);
            }
        });

        // 2. Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user?.email) {
                fetchUserProfile(session.user.email);
            } else {
                setUserName(null);
                setDbUserId(null);
                setUserRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchUserProfile = async (email: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('user_id, role_id, user_name, roles(role_name)')
                .eq('email', email)
                .single();

            if (error) {
                console.error("Error fetching user profile:", error);
            } else if (data) {
                setUserName(data.user_name);
                setDbUserId(data.user_id);

                // Resolve role name from joined roles data
                const r = data.roles as any;
                const roleName = Array.isArray(r) ? r[0]?.role_name : r?.role_name;
                setUserRole(roleName?.toLowerCase() || 'unknown');
            }
        } catch (err) {
            console.error("Unexpected error fetching profile:", err);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUserName(null);
        setDbUserId(null);
        setUserRole(null);
    };

    return (
        <AuthContext.Provider value={{ session, user, userName, dbUserId, userRole, loading, signOut }}>
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
