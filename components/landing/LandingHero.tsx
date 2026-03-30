import React from 'react';
import { SparklesIcon, ArrowRightIcon } from '../icons/Icons';
import { trackRegisterCTA } from '../../services/analyticsService';

interface LandingHeroProps {
  onGetStarted: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onGetStarted }) => {
  const scrollToHowItWorks = () => {
    document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="relative pt-40 pb-24 md:pt-52 md:pb-32 lg:pt-60 lg:pb-40 px-6 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1920px] h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[10%] w-[600px] h-[600px] bg-brand/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[10%] left-[40%] w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '4s' }} />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
      </div>

      <div className="max-w-5xl mx-auto text-center relative z-10 flex flex-col items-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 mb-10 animate-fade-in-up backdrop-blur-md hover:bg-white/10 transition-colors cursor-default">
          <SparklesIcon className="w-4 h-4 text-brand" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
            Inteligencia Artificial para el Fútbol
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-display font-bold text-white tracking-tighter leading-[0.95] mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Tus apuestas.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-emerald-400 to-brand relative inline-block">
            Respaldadas por datos.
            <span className="absolute inset-0 bg-brand/20 blur-3xl -z-10" aria-hidden="true" />
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Derbix analiza miles de partidos cada día para darte recomendaciones claras.
          <span className="text-white font-medium"> Sin tipsters. Sin estafas. Sin ruido.</span> Solo datos.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <button
            onClick={() => { trackRegisterCTA('hero'); onGetStarted(); }}
            className="group relative w-full sm:w-auto px-10 py-5 bg-brand text-white font-bold rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_rgba(16,185,129,0.5)] overflow-hidden text-lg"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              Comienza tu prueba gratis
              <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-hover to-brand opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
          <button
            onClick={scrollToHowItWorks}
            className="w-full sm:w-auto px-10 py-5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl transition-all backdrop-blur-md border border-white/10 hover:border-white/20 text-lg"
          >
            Ver cómo funciona
          </button>
        </div>

        {/* Trust sub-text */}
        <p className="mt-8 text-sm text-slate-500 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          Sin tarjeta de crédito &nbsp;•&nbsp; Cancela cuando quieras
        </p>
      </div>
    </header>
  );
};
