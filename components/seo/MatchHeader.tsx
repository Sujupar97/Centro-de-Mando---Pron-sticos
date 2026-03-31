import React from 'react';

interface MatchHeaderProps {
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  matchDate: string;
  matchTime?: string;
  homeLogo?: string;
  awayLogo?: string;
  confidence?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  hasResults?: boolean;
  resultCorrect?: boolean | null;
}

export const MatchHeader: React.FC<MatchHeaderProps> = ({
  homeTeam, awayTeam, leagueName, matchDate, matchTime,
  homeLogo, awayLogo, confidence,
  homeScore, awayScore, hasResults, resultCorrect,
}) => {
  const [year, month, day] = matchDate.split('-');
  const formattedDate = `${day}/${month}/${year}`;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {homeLogo && (
            <img src={homeLogo} alt={homeTeam} className="w-12 h-12 object-contain" />
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-display font-serif">
              Pronóstico {homeTeam} vs {awayTeam}
            </h1>
            <p className="text-gray-500 text-sm">
              {leagueName} · {formattedDate}{matchTime ? ` · ${matchTime}` : ''}
            </p>
          </div>
          {awayLogo && (
            <img src={awayLogo} alt={awayTeam} className="w-12 h-12 object-contain" />
          )}
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
            {leagueName}
          </span>
          {confidence && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {confidence} confianza
            </span>
          )}
        </div>
      </div>

      {/* Result banner */}
      {hasResults && homeScore != null && awayScore != null && (
        <div className="mt-4 bg-gray-50 rounded-xl p-4 flex items-center justify-between border border-gray-200">
          <div>
            <span className="font-bold text-xl text-gray-900">{homeScore} - {awayScore}</span>
            <span className="text-gray-500 text-sm ml-2">Resultado Final</span>
          </div>
          <span className={`text-lg font-bold ${resultCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {resultCorrect ? '✓ Predicción Acertada' : '✗ Predicción Fallada'}
          </span>
        </div>
      )}
    </div>
  );
};
