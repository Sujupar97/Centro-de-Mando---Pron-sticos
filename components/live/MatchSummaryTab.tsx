import React from 'react';
import { GameDetails, APIEvent, APIFixtureStatistics } from '../../types';
import { GoalIcon, YellowCardIcon, RedCardIcon, SubstitutionIcon } from '../icons/Icons';

interface MatchSummaryTabProps {
    details: GameDetails;
}

const EventIcon: React.FC<{ event: APIEvent }> = ({ event }) => {
    switch (event.type) {
        case 'Goal':
            return <GoalIcon className="w-4 h-4 text-emerald-400" />;
        case 'Card':
            if (event.detail.toLowerCase().includes('yellow'))
                return <YellowCardIcon className="w-4 h-4 text-yellow-400" />;
            return <RedCardIcon className="w-4 h-4 text-red-400" />;
        case 'subst':
            return <SubstitutionIcon className="w-4 h-4 text-blue-400" />;
        default:
            return null;
    }
};

const getStatValue = (stats: { type: string; value: any }[], type: string): number => {
    const stat = stats.find(s => s.type === type);
    if (stat?.value === null || stat?.value === undefined) return 0;
    if (typeof stat.value === 'string' && stat.value.endsWith('%')) return parseFloat(stat.value);
    return Number(stat.value) || 0;
};

const MiniStatBar: React.FC<{ label: string; home: number; away: number; suffix?: string }> = ({ label, home, away, suffix = '' }) => {
    const total = home + away || 1;
    const homePct = (home / total) * 100;

    return (
        <div className="py-1.5">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-white font-bold">{home}{suffix}</span>
                <span className="text-slate-500 uppercase text-[10px] tracking-wider">{label}</span>
                <span className="text-white font-bold">{away}{suffix}</span>
            </div>
            <div className="flex h-1 rounded-full bg-slate-700 overflow-hidden">
                <div className="h-full bg-emerald-500/80 rounded-l-full transition-all" style={{ width: `${homePct}%` }} />
                <div className="h-full bg-blue-500/80 rounded-r-full transition-all" style={{ width: `${100 - homePct}%` }} />
            </div>
        </div>
    );
};

const FormDots: React.FC<{ matches: any[] | null; teamId: number; label: string }> = ({ matches, teamId, label }) => {
    if (!matches || matches.length === 0) return null;

    const last5 = matches.slice(0, 5);

    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase w-10 shrink-0">{label}</span>
            <div className="flex gap-1">
                {last5.map((m, i) => {
                    const isHome = m.teams.home.id === teamId;
                    const goalsFor = isHome ? m.goals.home : m.goals.away;
                    const goalsAgainst = isHome ? m.goals.away : m.goals.home;
                    const result = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';

                    return (
                        <span
                            key={i}
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                                result === 'W' ? 'bg-emerald-500 text-white' :
                                result === 'L' ? 'bg-red-500 text-white' :
                                'bg-slate-500 text-white'
                            }`}
                            title={`${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name}`}
                        >
                            {result}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

const MatchSummaryTab: React.FC<MatchSummaryTabProps> = ({ details }) => {
    const events = details.events;
    const stats = details.statistics;
    const homeTeamId = details.teams.home.id;
    const awayTeamId = details.teams.away.id;

    // Key stats
    const homeStats = stats?.[0]?.statistics || [];
    const awayStats = stats?.[1]?.statistics || [];

    const keyStats = [
        { label: 'Posesión', type: 'Ball Possession', suffix: '%' },
        { label: 'Tiros', type: 'Total Shots' },
        { label: 'Al Arco', type: 'Shots on Goal' },
        { label: 'Corners', type: 'Corner Kicks' },
        { label: 'Faltas', type: 'Fouls' },
    ];

    // Key events (goals, red cards)
    const keyEvents = events?.filter(e =>
        e.type === 'Goal' || (e.type === 'Card' && e.detail.toLowerCase().includes('red'))
    ) || [];

    return (
        <div className="space-y-6">
            {/* Events Timeline */}
            {events && events.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Eventos</h4>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {events.map((event, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                                    event.team.id === homeTeamId ? 'justify-start' : 'flex-row-reverse'
                                } ${event.type === 'Goal' ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`}
                            >
                                <span className="text-slate-500 font-mono text-xs w-8 text-center shrink-0">
                                    {event.time.elapsed}'{event.time.extra ? `+${event.time.extra}` : ''}
                                </span>
                                <EventIcon event={event} />
                                <div className={`min-w-0 ${event.team.id === homeTeamId ? '' : 'text-right'}`}>
                                    <span className="text-white text-sm font-medium truncate block">{event.player.name}</span>
                                    {event.type === 'subst' && event.assist.name && (
                                        <span className="text-slate-500 text-[11px] block truncate">{event.assist.name}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Key Stats */}
            {stats && stats.length >= 2 && (
                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Estadísticas Clave</h4>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                        <div className="flex justify-between mb-3">
                            <span className="text-xs font-bold text-emerald-400">{details.teams.home.name}</span>
                            <span className="text-xs font-bold text-blue-400">{details.teams.away.name}</span>
                        </div>
                        {keyStats.map(({ label, type, suffix }) => {
                            const home = getStatValue(homeStats, type);
                            const away = getStatValue(awayStats, type);
                            if (home === 0 && away === 0) return null;
                            return <MiniStatBar key={type} label={label} home={home} away={away} suffix={suffix} />;
                        })}
                    </div>
                </div>
            )}

            {/* Recent Form */}
            {(details.lastMatches?.home || details.lastMatches?.away) && (
                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Forma Reciente</h4>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5 space-y-3">
                        <FormDots matches={details.lastMatches.home} teamId={homeTeamId} label={details.teams.home.name.substring(0, 3).toUpperCase()} />
                        <FormDots matches={details.lastMatches.away} teamId={awayTeamId} label={details.teams.away.name.substring(0, 3).toUpperCase()} />
                    </div>
                </div>
            )}

            {/* Empty state */}
            {(!events || events.length === 0) && (!stats || stats.length < 2) && (
                <div className="text-center py-12 text-slate-500">
                    <p className="text-sm">No hay datos disponibles para este partido aún.</p>
                    <p className="text-xs mt-1">Los datos aparecerán cuando el partido comience.</p>
                </div>
            )}
        </div>
    );
};

export default MatchSummaryTab;
