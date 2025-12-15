import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';

export const AuthPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState(''); // Para el registro
    const [isLogin, setIsLogin] = useState(true);
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-lg shadow-lg">
                <div>
                    <h1 className="text-3xl font-bold text-center text-white">
                        <span className="text-green-accent">Bet</span>Command
                    </h1>
                    <p className="mt-2 text-center text-sm text-gray-400">
                        {isLogin ? 'Inicia sesión para acceder a tu centro de mando' : 'Crea una cuenta para comenzar'}
                    </p>
                </div>
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
                    {isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}
                    <button onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }} className="ml-1 font-medium text-green-accent hover:text-green-500">
                        {isLogin ? 'Regístrate' : 'Inicia Sesión'}
                    </button>
                </p>
            </div>
        </div>
    );
};
