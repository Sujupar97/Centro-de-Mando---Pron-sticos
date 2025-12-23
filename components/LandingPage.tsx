import React, { useEffect } from 'react';
import {
    SparklesIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    RocketLaunchIcon,
    CheckIcon,
    ArrowRightIcon,
    UsersIcon,
    GlobeAmericasIcon,
    LockClosedIcon
} from './icons/Icons';
import { useAuth } from '../hooks/useAuth';

interface LandingPageProps {
    onGetStarted: () => void;
    onLoginClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLoginClick }) => {
    const { session } = useAuth();

    // If session exists (e.g. slight delay in App update), redirect or just don't show info.
    // In practice, App.tsx handles this, but this is a safety check.
    useEffect(() => {
        if (session) {
            window.location.reload(); // Force refresh to trigger App re-evaluation if stuck
        }
    }, [session]);

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200 selection:bg-brand selection:text-white overflow-x-hidden">

            {/* --- NAVBAR --- */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 backdrop-blur-md transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 animate-fade-in">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand to-emerald-600 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                            <ChartBarIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-display font-bold text-white tracking-tight">
                            Bet<span className="text-brand">Command</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <button
                            onClick={onLoginClick}
                            className="hidden md:block text-slate-400 hover:text-white font-medium text-sm transition-colors hover:scale-105 transform duration-200"
                        >
                            Iniciar Sesión
                        </button>
                        <button
                            onClick={onGetStarted}
                            className="px-6 py-2.5 bg-white text-slate-950 font-bold rounded-full transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                        >
                            <span>Comenzar</span>
                            <ArrowRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* --- HERO SECTION --- */}
            <header className="relative pt-40 pb-32 md:pt-60 md:pb-48 px-6 overflow-hidden">
                {/* Background Effects */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1920px] h-full pointer-events-none">
                    <div className="absolute top-[-10%] left-[10%] w-[600px] h-[600px] bg-brand/10 rounded-full blur-[120px] animate-pulse-slow"></div>
                    <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

                    {/* Grid Pattern Overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>
                </div>

                <div className="max-w-6xl mx-auto text-center relative z-10 flex flex-col items-center">

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-10 animate-fade-in-up backdrop-blur-md hover:bg-white/10 transition-colors cursor-default">
                        <SparklesIcon className="w-4 h-4 text-brand" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Inteligencia Artificial 2.0</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-bold text-white tracking-tighter leading-[0.95] mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        Domina el <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-brand to-emerald-600 relative">
                            Juego.
                            {/* Text Glow Effect */}
                            <span className="absolute inset-0 bg-brand/20 blur-2xl -z-10 bg-clip-text text-transparent" aria-hidden="true">Juego.</span>
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        La plataforma definitiva para apostadores profesionales. Análisis predictivo, gestión de capital y datos en tiempo real.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                        <button
                            onClick={onGetStarted}
                            className="group relative w-full sm:w-auto px-10 py-5 bg-white text-slate-950 font-bold rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)] overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                Crea tu cuenta GRATIS
                                <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </button>
                        <button
                            onClick={onLoginClick}
                            className="w-full sm:w-auto px-10 py-5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl transition-all backdrop-blur-md border border-white/5 hover:border-white/10"
                        >
                            Ya tengo cuenta
                        </button>
                    </div>

                    {/* Social Proof / Trust */}
                    <div className="mt-20 pt-10 border-t border-white/5 w-full max-w-4xl animate-fade-in" style={{ animationDelay: '0.5s' }}>
                        <p className="text-sm text-slate-500 font-medium mb-6 uppercase tracking-widest">Tecnología utilizada por profesionales en</p>
                        <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                            {/* Fake Logos for Design Aesthetic */}
                            <span className="text-xl font-display font-bold text-white">Bet<span className="text-brand">365</span></span>
                            <span className="text-xl font-display font-bold text-white">Draft<span className="text-blue-500">Kings</span></span>
                            <span className="text-xl font-display font-bold text-white">Fan<span className="text-blue-400">Duel</span></span>
                            <span className="text-xl font-display font-bold text-white">Pinnacle</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- APP PREVIEW (FLOATING) --- */}
            <section className="relative z-20 -mt-20 mb-32 px-4">
                <div className="max-w-6xl mx-auto animate-float">
                    <div className="relative rounded-2xl p-1 bg-gradient-to-b from-white/20 to-transparent backdrop-blur-sm shadow-2xl">
                        <div className="rounded-xl overflow-hidden bg-slate-900 border border-white/10 aspect-[16/10] shadow-2xl relative">
                            {/* Decorative UI Mockup */}
                            <div className="absolute inset-0 flex flex-col md:flex-row">
                                {/* Fake Sidebar */}
                                <div className="hidden md:block w-64 h-full bg-slate-950/50 border-r border-white/5 p-4 space-y-4">
                                    <div className="h-8 w-32 bg-white/10 rounded-lg animate-pulse" style={{ animationDuration: '3s' }}></div>
                                    <div className="h-4 w-20 bg-white/5 rounded-lg"></div>
                                    <div className="space-y-2 pt-4">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className="h-10 w-full bg-white/5 rounded-lg opacity-50"></div>
                                        ))}
                                    </div>
                                </div>
                                {/* Content */}
                                <div className="flex-1 p-8 space-y-6 bg-slate-900">
                                    <div className="flex justify-between items-center">
                                        <div className="h-10 w-48 bg-white/10 rounded-lg"></div>
                                        <div className="flex gap-2">
                                            <div className="h-10 w-10 bg-brand/20 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-6">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-brand/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="h-64 bg-white/5 rounded-2xl border border-white/5"></div>
                                </div>
                            </div>

                            {/* Gradient Overlay for Fade Effect at bottom */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-50"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- BENTO GRID FEATURES --- */}
            <section className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <h2 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">Poder Ilimitado.</h2>
                        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                            Herramientas diseñadas obsesivamente para darte la ventaja que la casa no quiere que tengas.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[400px]">
                        {/* Large Feature */}
                        <div className="md:col-span-2 relative group overflow-hidden rounded-3xl bg-slate-900 border border-white/10 hover:border-brand/30 transition-all duration-500">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="p-10 relative z-10 h-full flex flex-col justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
                                        <SparklesIcon className="w-6 h-6 text-brand" />
                                    </div>
                                    <h3 className="text-3xl font-bold text-white mb-4">Predicciones Cuánticas</h3>
                                    <p className="text-slate-400 text-lg max-w-md">Nuestro motor de IA analiza más de 5,000 puntos de datos por partido para encontrar valor real donde otros solo ven ruido.</p>
                                </div>
                                <div className="mt-8 flex gap-2">
                                    <div className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-bold">Probabilidad Alta</div>
                                    <div className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 border border-white/10 text-sm">ROI +15%</div>
                                </div>
                            </div>
                            <div className="absolute right-[-10%] bottom-[-10%] w-[60%] h-[80%] bg-gradient-to-tl from-slate-800 to-slate-950 rounded-tl-3xl border-l border-t border-white/10 group-hover:scale-105 transition-transform duration-700"></div>
                        </div>

                        {/* Tall Feature */}
                        <div className="md:row-span-2 relative group overflow-hidden rounded-3xl bg-slate-900 border border-white/10 hover:border-blue-500/30 transition-all duration-500">
                            <div className="p-10 relative z-10 h-full flex flex-col">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                                    <GlobeAmericasIcon className="w-6 h-6 text-blue-400" />
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-4">Cobertura Global</h3>
                                <p className="text-slate-400 text-lg mb-8">Desde la Premier League hasta ligas menores en Asia. Si hay cuotas, tenemos datos.</p>

                                <div className="flex-1 space-y-4">
                                    {['Premier League', 'La Liga', 'NBA', 'NFL', 'Champions'].map(league => (
                                        <div key={league} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                            <span className="font-semibold text-white">{league}</span>
                                            <ArrowRightIcon className="w-4 h-4 text-slate-500" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Small Feature 1 */}
                        <div className="relative group overflow-hidden rounded-3xl bg-slate-900 border border-white/10 hover:border-purple-500/30 transition-all duration-500">
                            <div className="p-10 flex flex-col h-full justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                                        <LockClosedIcon className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Seguridad Total</h3>
                                    <p className="text-slate-400">Encriptación de extremo a extremo para tus estrategias.</p>
                                </div>
                            </div>
                        </div>

                        {/* Small Feature 2 */}
                        <div className="relative group overflow-hidden rounded-3xl bg-slate-900 border border-white/10 hover:border-brand/30 transition-all duration-500">
                            <div className="p-10 flex flex-col h-full justify-between">
                                <div>
                                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mb-6">
                                        <UsersIcon className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Comunidad VIP</h3>
                                    <p className="text-slate-400">Acceso exclusivo a estrategias de apostadores top.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* --- BIG CTA --- */}
            <section className="py-40 px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-brand/10 skew-y-3 transform origin-bottom-left scale-110"></div>
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-10 tracking-tight">
                        Deja de adivinar.<br />Empieza a ganar.
                    </h2>
                    <div className="flex flex-col items-center gap-6">
                        <button
                            onClick={onGetStarted}
                            className="px-12 py-6 bg-white text-slate-950 font-bold rounded-full text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)] flex items-center gap-4"
                        >
                            Comenzar Prueba Gratuita
                            <RocketLaunchIcon className="w-6 h-6" />
                        </button>
                        <p className="text-slate-400 text-sm">Sin tarjeta de crédito requerida • Cancelación inmediata</p>
                    </div>
                </div>
            </section>

            {/* --- FOOTER --- */}
            <footer className="py-12 border-t border-white/5 bg-slate-950 text-slate-500 text-sm">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 grayscale opacity-50">
                        <ChartBarIcon className="w-5 h-5" />
                        <span className="font-bold">BetCommand</span>
                    </div>
                    <div className="flex gap-8">
                        <a href="#" className="hover:text-white transition-colors">Términos</a>
                        <a href="#" className="hover:text-white transition-colors">Privacidad</a>
                        <a href="#" className="hover:text-white transition-colors">Soporte</a>
                    </div>
                    <p>&copy; {new Date().getFullYear()} BetCommand Inc.</p>
                </div>
            </footer>
        </div>
    );
};
