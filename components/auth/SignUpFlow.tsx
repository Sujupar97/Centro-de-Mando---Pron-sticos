import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseService';
import { PlanSelector } from './PlanSelector';
import { ArrowRightIcon, ArrowLeftIcon, SparklesIcon } from '../icons/Icons';
import { initSubscriptionPayment, usdToCop } from '../../services/wompiService';

interface SignUpData {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
}

interface Plan {
    id: string;
    name: string;
    displayName: string;
    priceCents: number;
}

export const SignUpFlow: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [signUpData, setSignUpData] = useState<SignUpData>({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

    // Step 1: User Data
    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!signUpData.fullName || !signUpData.email || !signUpData.password) {
            setError('Por favor completa todos los campos');
            return;
        }

        if (signUpData.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (signUpData.password !== signUpData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setStep(2);
    };

    // Step 2: Plan Selection + Registration
    const handleCompleteSignUp = async () => {
        if (!selectedPlan) {
            setError('Por favor selecciona un plan');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. Crear cuenta de usuario
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: signUpData.email,
                password: signUpData.password,
                options: {
                    data: {
                        full_name: signUpData.fullName
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('No se pudo crear el usuario');

            // 2. Crear perfil
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    email: signUpData.email,
                    full_name: signUpData.fullName,
                    role: 'usuario'
                });

            if (profileError) throw profileError;

            // 3. Si es plan gratuito, asignar directamente
            if (selectedPlan.priceCents === 0) {
                // Obtener el plan free de la DB
                const { data: planData } = await supabase
                    .from('subscription_plans')
                    .select('id')
                    .eq('name', 'free')
                    .single();

                if (planData) {
                    await supabase
                        .from('user_subscriptions')
                        .insert({
                            user_id: authData.user.id,
                            plan_id: planData.id,
                            status: 'active',
                            current_period_start: new Date().toISOString(),
                            current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 año
                        });
                }

                // Redirigir a app
                navigate('/app');
            } else {
                // 4. Si es plan de pago, iniciar Wompi
                const priceCOP = usdToCop(selectedPlan.priceCents / 100);

                await initSubscriptionPayment(
                    selectedPlan.name,
                    selectedPlan.displayName,
                    priceCOP,
                    signUpData.email,
                    signUpData.fullName,
                    () => {
                        // Éxito - redirigir a app
                        navigate('/app');
                    },
                    () => {
                        // Error en pago
                        setError('Hubo un problema con el pago. Intenta de nuevo.');
                        setLoading(false);
                    }
                );
            }
        } catch (err: any) {
            console.error('Error en registro:', err);
            setError(err.message || 'Ocurrió un error al crear la cuenta');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-6xl">
                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-brand' : 'text-slate-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-brand bg-brand/20' : 'border-slate-600'
                                }`}>
                                1
                            </div>
                            <span className="text-sm font-medium hidden sm:inline">Tus Datos</span>
                        </div>

                        <div className={`h-0.5 w-16 ${step >= 2 ? 'bg-brand' : 'bg-slate-700'}`}></div>

                        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-brand' : 'text-slate-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-brand bg-brand/20' : 'border-slate-600'
                                }`}>
                                2
                            </div>
                            <span className="text-sm font-medium hidden sm:inline">Elige tu Plan</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-slate-900 rounded-3xl border border-white/10 p-8 md:p-12">
                    {step === 1 ? (
                        /* STEP 1: User Data */
                        <div className="max-w-md mx-auto">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 border border-brand/20 mb-4">
                                    <SparklesIcon className="w-4 h-4 text-brand" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-brand">Únete Ahora</span>
                                </div>
                                <h1 className="text-4xl font-black text-white mb-2">Crea tu Cuenta</h1>
                                <p className="text-slate-400">Accede a pronósticos con IA en segundos</p>
                            </div>

                            <form onSubmit={handleStep1Submit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Nombre Completo
                                    </label>
                                    <input
                                        type="text"
                                        value={signUpData.fullName}
                                        onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand transition-colors"
                                        placeholder="Juan Pérez"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={signUpData.email}
                                        onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand transition-colors"
                                        placeholder="tu@email.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={signUpData.password}
                                        onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand transition-colors"
                                        placeholder="Mínimo 6 caracteres"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Confirmar Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        value={signUpData.confirmPassword}
                                        onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand transition-colors"
                                        placeholder="Repite tu contraseña"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                        <p className="text-red-400 text-sm">{error}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-gradient-to-r from-brand to-emerald-400 text-slate-900 font-bold rounded-xl hover:shadow-lg hover:shadow-brand/30 transition-all flex items-center justify-center gap-2"
                                >
                                    Continuar
                                    <ArrowRightIcon className="w-5 h-5" />
                                </button>

                                <p className="text-center text-sm text-slate-400 mt-4">
                                    ¿Ya tienes cuenta?{' '}
                                    <button
                                        type="button"
                                        onClick={() => navigate('/login')}
                                        className="text-brand hover:text-emerald-400 font-medium"
                                    >
                                        Inicia Sesión
                                    </button>
                                </p>
                            </form>
                        </div>
                    ) : (
                        /* STEP 2: Plan Selection */
                        <div>
                            <PlanSelector selectedPlan={selectedPlan} onSelectPlan={setSelectedPlan} />

                            {error && (
                                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl max-w-2xl mx-auto">
                                    <p className="text-red-400 text-sm text-center">{error}</p>
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-4 mt-8">
                                <button
                                    onClick={() => setStep(1)}
                                    disabled={loading}
                                    className="px-6 py-3 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <ArrowLeftIcon className="w-5 h-5" />
                                    Atrás
                                </button>

                                <button
                                    onClick={handleCompleteSignUp}
                                    disabled={!selectedPlan || loading}
                                    className="px-8 py-3 bg-gradient-to-r from-brand to-emerald-400 text-slate-900 font-bold rounded-xl hover:shadow-lg hover:shadow-brand/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            {selectedPlan?.priceCents === 0 ? 'Comenzar Gratis' : 'Continuar al Pago'}
                                            <ArrowRightIcon className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Trust Indicators */}
                <div className="mt-8 text-center">
                    <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-green-500"></div>
                            <span>+1,250 usuarios</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-brand"></div>
                            <span>75% accuracy</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                            <span>Pago seguro</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
