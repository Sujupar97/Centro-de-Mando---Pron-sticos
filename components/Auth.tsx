import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';

export const AuthPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/app`,
                        data: {
                            full_name: fullName
                        }
                    }
                });
                if (error) throw error;
                setMessage('¡Registro exitoso! Por favor, revisa tu correo para confirmar tu cuenta.');
            }
        } catch (err: any) {
            setError(err.error_description || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });
            if (error) throw error;
            setResetEmailSent(true);
            setMessage('Hemos enviado un enlace de restablecimiento a tu correo. Revisa tu bandeja de entrada.');
        } catch (err: any) {
            setError(err.error_description || err.message);
        } finally {
            setLoading(false);
        }
    };

    const exitForgotPassword = () => {
        setIsForgotPassword(false);
        setResetEmailSent(false);
        setMessage('');
        setError('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-lg shadow-lg">
                <div>
                    <h1 className="text-3xl font-bold text-center text-white">
                        <span className="text-white">Der</span><span className="text-brand">bix</span>
                    </h1>
                    <p className="mt-2 text-center text-sm text-gray-400">
                        {isForgotPassword
                            ? 'Ingresa tu correo para restablecer tu contraseña'
                            : isLogin
                                ? 'Inicia sesión para acceder a tu centro de mando'
                                : 'Crea una cuenta para comenzar'}
                    </p>
                </div>

                {isForgotPassword ? (
                    /* ── Forgot Password Form ── */
                    <>
                        <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
                            <div>
                                <label htmlFor="email-address" className="sr-only">Correo electrónico</label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-green-accent focus:border-green-accent"
                                    placeholder="Correo electrónico"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={resetEmailSent}
                                />
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    disabled={loading || resetEmailSent}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-accent hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-600"
                                >
                                    {loading ? 'Enviando...' : resetEmailSent ? 'Correo Enviado' : 'Enviar Enlace de Restablecimiento'}
                                </button>
                            </div>
                        </form>
                        {error && <p className="mt-2 text-center text-sm text-red-accent">{error}</p>}
                        {message && <p className="mt-2 text-center text-sm text-green-accent">{message}</p>}
                        <p className="mt-2 text-center text-sm text-gray-400">
                            <button onClick={exitForgotPassword} className="font-medium text-green-accent hover:text-green-500">
                                &larr; Volver al inicio de sesión
                            </button>
                        </p>
                    </>
                ) : (
                    /* ── Login / Signup Form ── */
                    <>
                        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
                            {!isLogin && (
                                <div>
                                    <label htmlFor="full-name" className="sr-only">Nombre Completo</label>
                                    <input
                                        id="full-name"
                                        name="full-name"
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-green-accent focus:border-green-accent"
                                        placeholder="Nombre Completo"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                            )}
                            <div>
                                <label htmlFor="email-address" className="sr-only">Correo electrónico</label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-green-accent focus:border-green-accent"
                                    placeholder="Correo electrónico"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">Contraseña</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className="w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-green-accent focus:border-green-accent"
                                    placeholder="Contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            {isLogin && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => { setIsForgotPassword(true); setError(''); setMessage(''); }}
                                        className="text-xs text-green-accent hover:text-green-500"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                            )}
                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-accent hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-600"
                                >
                                    {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
                                </button>
                            </div>
                        </form>
                        {error && <p className="mt-2 text-center text-sm text-red-accent">{error}</p>}
                        {message && <p className="mt-2 text-center text-sm text-green-accent">{message}</p>}
                        <p className="mt-2 text-center text-sm text-gray-400">
                            ¿No tienes una cuenta?
                            <button onClick={() => navigate('/signup')} className="ml-1 font-medium text-green-accent hover:text-green-500">
                                Regístrate
                            </button>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};
