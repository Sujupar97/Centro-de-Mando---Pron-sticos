import React from 'react';
import { ArrowRightIcon, RocketLaunchIcon } from '../icons/Icons';
import { useScrollReveal } from './useScrollReveal';
import { trackRegisterCTA } from '../../services/analyticsService';

interface FinalCTAProps {
  onGetStarted: () => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onGetStarted }) => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-24 md:py-32 px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-brand/8 rounded-full blur-[100px]" />
      </div>

      {/* Skewed accent */}
      <div className="absolute inset-0 bg-brand/5 skew-y-2 transform origin-bottom-left scale-110" />

      <div className="max-w-4xl mx-auto text-center relative z-10" ref={ref}>
        <div className={`transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand/10 mb-8">
            <RocketLaunchIcon className="w-8 h-8 text-brand" />
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-7xl font-display font-bold text-white mb-6 tracking-tight">
            ¿Listo para decisiones
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-emerald-400">
              inteligentes?
            </span>
          </h2>

          <p className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto mb-10">
            Únete a los apostadores que ya usan datos, no corazonadas.
          </p>

          <button
            onClick={() => { trackRegisterCTA('final_cta'); onGetStarted(); }}
            className="group inline-flex items-center gap-3 px-12 py-6 bg-brand text-white font-bold rounded-2xl text-lg hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(16,185,129,0.3)] hover:shadow-[0_0_80px_rgba(16,185,129,0.5)]"
          >
            Comienza Gratis
            <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>

          <p className="mt-6 text-sm text-slate-500">
            Sin tarjeta de crédito &nbsp;•&nbsp; Cancela cuando quieras
          </p>
        </div>
      </div>
    </section>
  );
};
