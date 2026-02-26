import React from 'react';
import { Game, AnalysisJob } from '../../types';
import { CheckCircleIcon, SparklesIcon } from '../icons/Icons';
import { isAgencyRole } from '../../utils/roles';

interface FlashscoreMatchRowProps {
    game: Game;
    hasReport: boolean;
    jobStatus?: AnalysisJob['status'];
    userRole?: string;
    onOpenDetail: (game: Game) => void;
    onAnalyze: (game: Game) => void;
}

const FlashscoreMatchRow: React.FC<FlashscoreMatchRowProps> = ({
    game, hasReport, jobStatus, userRole, onOpenDetail, onAnalyze
}) => {
    const isAdmin = isAgencyRole(userRole);
    const scoreAvailable = game.goals.home !== null && game.goals.away !== null;
    const isLive = game.fixture.status.elapsed !== null && game.fixture.status.short !== 'FT' && game.fixture.status.short !== 'AET' && game.fixture.status.short !== 'PEN';
    const isFinished = game.fixture.status.short === 'FT' || game.fixture.status.short === 'AET' || game.fixture.status.short === 'PEN';
    const isProcessing = jobStatus && ['queued', 'ingesting', 'data_ready', 'analyzing'].includes(jobStatus);

    const handleAnalyzeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAnalyze(game);
    };

    return (
        <div
            onClick={() => onOpenDetail(game)}
            className="flex items-center h-14 sm:h-12 px-2 sm:px-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/[0.03] last:border-b-0 group"
        >
            {/* Time / Status */}
            <div className="w-12 sm:w-14 shrink-0 text-center">
                {isLive ? (
                    <span className="text-xs font-bold text-red-400 flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        {game.fixture.status.elapsed}'
                    </span>
                ) : isFinished ? (
                    <span className="text-[11px] font-bold text-slate-500">FIN</span>
                ) : (
                    <span className="text-xs font-mono text-slate-400">
                        {new Date(game.fixture.timestamp * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-white/5 mx-1 shrink-0" />

            {/* Home Team */}
            <div className="flex-1 flex items-center justify-end gap-2 min-w-0 pr-2">
                <span className={`text-sm truncate ${isFinished && scoreAvailable && game.goals.home! > game.goals.away! ? 'text-white font-bold' : 'text-slate-300'}`}>
                    {game.teams.home.name}
                </span>
                <img src={game.teams.home.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
            </div>

            {/* Score */}
            <div className="w-14 shrink-0 text-center">
                {scoreAvailable ? (
                    <span className={`text-sm font-bold tracking-wider ${isLive ? 'text-red-400' : 'text-white'}`}>
                        {game.goals.home} - {game.goals.away}
                    </span>
                ) : (
                    <span className="text-sm font-bold text-slate-600">vs</span>
                )}
            </div>

            {/* Away Team */}
            <div className="flex-1 flex items-center justify-start gap-2 min-w-0 pl-2">
                <img src={game.teams.away.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
                <span className={`text-sm truncate ${isFinished && scoreAvailable && game.goals.away! > game.goals.home! ? 'text-white font-bold' : 'text-slate-300'}`}>
                    {game.teams.away.name}
                </span>
            </div>

            {/* Indicators */}
            <div className="w-16 sm:w-20 shrink-0 flex items-center justify-end gap-1.5">
                {isProcessing && (
                    <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                )}

                {hasReport && (
                    <CheckCircleIcon className="w-4 h-4 text-brand" />
                )}

                {isAdmin && !hasReport && !isProcessing && (
                    <button
                        onClick={handleAnalyzeClick}
                        className="sm:opacity-0 sm:group-hover:opacity-100 p-2 sm:p-1 rounded text-blue-400 hover:bg-blue-500/10 transition-all"
                        title="Analizar"
                    >
                        <SparklesIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default FlashscoreMatchRow;
