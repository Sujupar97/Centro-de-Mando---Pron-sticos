import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseService';
import { useAuth } from '../../hooks/useAuth';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading, isRecoveryMode } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!session && !isRecoveryMode) {
      setTokenInvalid(true);
    } else if (session && !isRecoveryMode) {
      navigate('/app');
    }
  }, [session, authLoading, isRecoveryMode, navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      setTimeout(() => navigate('/app'), 2000);
    } catch (err: any) {
      if (err.message?.includes('session') || err.message?.includes('token')) {
        setError('Tu sesión ha expirado. Solicita un nuevo enlace de restablecimiento.');
      } else {
        setError(err.message || 'Error al restablecer la contraseña');
      }
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 rounded-2xl border border-white/10 p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white">
              <span>Der</span><span className="text-emerald-500">bix</span>
            </h1>
            <h2 className="text-xl font-bold text-white mt-6">Restablecer Contraseña</h2>
            {!tokenInvalid && !success && (
              <p className="text-slate-400 mt-2 text-sm">Ingresa tu nueva contraseña</p>
            )}
          </div>

          {tokenInvalid ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Enlace inválido o expirado</h3>
              <p className="text-slate-400 text-sm mb-6">
                Este enlace ya no es válido. Solicita uno nuevo desde la página de inicio de sesión.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-900 font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
              >
                Ir al inicio de sesión
              </button>
            </div>
          ) : success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Contraseña actualizada</h3>
              <p className="text-slate-400 text-sm">Redirigiendo a tu cuenta...</p>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Repite tu contraseña"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-900 font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? 'Actualizando...' : 'Restablecer Contraseña'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
