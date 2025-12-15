import React from 'react';
import { APIStanding } from '../../types';

interface StandingsTabProps {
    standings: APIStanding[] | null;
    homeTeamId: number;
    awayTeamId: number;
}

export const StandingsTab: React.FC<StandingsTabProps> = ({ standings, homeTeamId, awayTeamId }) => {
    if (!standings || standings.length === 0) {
        return <div className="text-center py-4 text-gray-400">La tabla de clasificación no está disponible.</div>;
    }

    const headers = ['#', 'Equipo', 'PJ', 'G', 'E', 'P', 'DG', 'Pts'];

    return (
        <div className="overflow-x-auto bg-gray-800 rounded-lg">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-700/50 text-gray-400 uppercase text-xs">
                    <tr>
                        {headers.map(h => <th key={h} className="p-3 font-semibold">{h}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {standings.map(s => {
                        const isHome = s.team.id === homeTeamId;
                        const isAway = s.team.id === awayTeamId;
                        const rowClass = isHome ? 'bg-green-accent/10' : isAway ? 'bg-blue-500/10' : '';
                        
                        return (
                            <tr key={s.rank} className={rowClass}>
                                <td className="p-3 font-bold text-white">{s.rank}</td>
                                <td className="p-3 flex items-center">
                                    <img src={s.team.logo} alt={s.team.name} className="w-5 h-5 mr-3" />
                                    <span className="font-semibold text-white">{s.team.name}</span>
                                </td>
                                <td className="p-3">{s.all.played}</td>
                                <td className="p-3">{s.all.win}</td>
                                <td className="p-3">{s.all.draw}</td>
                                <td className="p-3">{s.all.lose}</td>
                                <td className="p-3">{s.goalsDiff}</td>
                                <td className="p-3 font-bold text-white">{s.points}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};