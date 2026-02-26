import React, { useState } from 'react';
import { League, Game, AnalysisJob } from '../../types';
import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from '../icons/Icons';
import { isAgencyRole } from '../../utils/roles';
import FlashscoreMatchRow from './FlashscoreMatchRow';

interface FlashscoreLeagueGroupProps {
    league: League;
    gameJobStatus: Record<number, AnalysisJob['status']>;
    reportsAvailable: Record<number, boolean>;
    userRole?: string;
    onOpenDetail: (game: Game) => void;
    onAnalyzeGame: (game: Game) => void;
    onAnalyzeLeague: () => void;
    onViewReport: (gameId: number) => void;
}

const FlashscoreLeagueGroup: React.FC<FlashscoreLeagueGroupProps> = ({
    league, gameJobStatus, reportsAvailable, userRole,
    onOpenDetail, onAnalyzeGame, onAnalyzeLeague, onViewReport
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const isAdmin = isAgencyRole(userRole);

    return (
        <div className="rounded-lg overflow-hidden border border-white/5 bg-slate-900/40">
            {/* League Header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-800/60 border-b border-white/5">
                <div
                    className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {league.logo && (
                        <img src={league.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-white truncate">{league.name}</span>
                        <span className="text-[11px] text-slate-500">{league.country}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded font-mono shrink-0">
                        {league.games.length}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isAdmin && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAnalyzeLeague(); }}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 rounded transition-all"
                            title="Analizar Liga Completa"
                        >
                            <SparklesIcon className="w-3 h-3" />
                            BATCH
                        </button>
                    )}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 text-slate-500 hover:text-white transition-colors"
                    >
                        {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Match Rows */}
            {isExpanded && (
                <div>
                    {league.games.map((game) => (
                        <FlashscoreMatchRow
                            key={game.fixture.id}
                            game={game}
                            hasReport={!!reportsAvailable[game.fixture.id]}
                            jobStatus={gameJobStatus[game.fixture.id]}
                            userRole={userRole}
                            onOpenDetail={onOpenDetail}
                            onAnalyze={onAnalyzeGame}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FlashscoreLeagueGroup;
