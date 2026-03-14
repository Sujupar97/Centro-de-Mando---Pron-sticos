import React, { createContext, useState, useEffect, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseService';
import { normalizeRole, PlatformRole } from '../utils/roles';

interface Profile {
  id: string;
  full_name: string;
  role: PlatformRole;
  phone_number?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isRecoveryMode: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  // 'loading' ahora solo representa la comprobación inicial y muy rápida de la sesión.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Este efecto maneja el estado de la sesión. `onAuthStateChange` se dispara
    // inmediatamente al cargar con el estado actual de la sesión.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryMode(true);
        } else if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
          setIsRecoveryMode(false);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Este efecto secundario se encarga de cargar el perfil del usuario
    // solo cuando el objeto 'user' cambia. No bloquea la carga inicial.
    if (user) {
      supabase
        .from('profiles')
        .select('id, full_name, role, phone_number')
        .eq('id', user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error al obtener el perfil:', error);
            setProfile(null);
          } else if (data) {
            setProfile({
              ...data,
              role: normalizeRole(data.role),
            } as Profile);
          }
        });
    } else {
      // Si no hay usuario, nos aseguramos de que no haya perfil.
      setProfile(null);
    }
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = { session, user, profile, loading, isRecoveryMode, signOut };

  // Esta pantalla de carga ahora es muy breve y solo se muestra
  // durante la fracción de segundo que tarda en verificarse la sesión.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-16 h-16 border-4 border-green-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};