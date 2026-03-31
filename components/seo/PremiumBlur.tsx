import React from 'react';
import { useNavigate } from 'react-router-dom';
import { trackRegisterCTA, trackPremiumBlurView } from '../../services/analyticsService';

interface PremiumBlurProps {
  children: React.ReactNode;
  matchTitle?: string;
}

/**
 * Wraps premium content with a blur overlay and registration CTA.
 * Used on public SEO pages to gate prediction details.
 */
export const PremiumBlur: React.FC<PremiumBlurProps> = ({ children, matchTitle }) => {
  const navigate = useNavigate();

  const handleCTAClick = () => {
    trackRegisterCTA('seo_blur');
    if (matchTitle) trackPremiumBlurView(matchTitle);
    navigate('/signup');
  };

  return (
    <div className="relative overflow-hidden rounded-2xl min-h-[300px]">
      {/* Blurred content */}
      <div
        className="blur-md select-none pointer-events-none"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay with CTA */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-2xl p-8 z-10">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Desbloquea las Predicciones Premium
        </h3>
        <p className="text-gray-500 mb-6 text-center max-w-md">
          Accede a probabilidades exactas, picks de valor y el análisis profundo completo.
          1 pronóstico gratis al día, para siempre.
        </p>
        <button
          onClick={handleCTAClick}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8 py-3 rounded-xl transition-all hover:scale-105"
        >
          Crear Cuenta Gratis
        </button>
        <p className="text-gray-400 text-sm mt-4">
          ¿Ya tienes cuenta?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-emerald-400 hover:underline"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
};
