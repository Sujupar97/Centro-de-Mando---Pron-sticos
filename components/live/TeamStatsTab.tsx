import React from 'react';
import { APITeamSeasonStats } from '../../types';

interface TeamStatsProps {
    teamStats: {
        home: APITeamSeasonStats | null;
        away: APITeamSeasonStats | null;
    }
}

const StatRow: React.FC<{ label: string, homeValue: string | number, awayValue: string | number }> = ({ label, homeValue, awayValue }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
        <span className="font-semibold text-white">{homeValue}</span>
        <span className="text-sm text-gray-400 text-center mx-2">{label}</span>
        <span className="font-semibold text-white">{awayValue}</span>
    </div>
);

const FormDisplay: React.FC<{ form: string }> = ({ form }) => (
    <div className="flex space-x-1">
        {[...form].slice(-5).map((result, index) => {
            let color = 'bg-gray-600';
            if (result === 'W') color = 'bg-green-accent';
            if (result === 'L') color = 'bg-red-accent';
            if (result === 'D') color = 'bg-yellow-500';
            return <span key={index} className={`w-4 h-4 rounded-full ${color}`} title={result}></span>;
        })}
    </div>
);

export const TeamStatsTab: React.FC<TeamStatsProps> = ({ teamStats }) => {
    const { home, away } = teamStats;

    if (!home || !away) {
        return <div className="text-center py-4 text-gray-400">No hay estadísticas de temporada disponibles.</div>;
    }

    return (
        <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <FormDisplay form={home.form || ''} />
                <h4 className="text-lg font-bold text-white">Rendimiento en Liga</h4>
                <FormDisplay form={away.form || ''} />
            </div>

            <div className="space-y-2">
                <StatRow 
                    label="Partidos Jugados" 
                    homeValue={home.fixtures.played.total} 
                    awayValue={away.fixtures.played.total} 
                />
                 <StatRow 
                    label="Victorias" 
                    homeValue={home.fixtures.wins.total} 
                    awayValue={away.fixtures.wins.total} 
                />
                 <StatRow 
                    label="Empates" 
                    homeValue={home.fixtures.draws.total} 
                    awayValue={away.fixtures.draws.total} 
                />
                 <StatRow 
                    label="Derrotas" 
                    homeValue={home.fixtures.loses.total} 
                    awayValue={away.fixtures.loses.total} 
                />
                <StatRow 
                    label="Goles Anotados" 
                    homeValue={home.goals.for.total.total} 
                    awayValue={away.goals.for.total.total} 
                />
                <StatRow 
                    label="Goles Recibidos" 
                    homeValue={home.goals.against.total.total} 
                    awayValue={away.goals.against.total.total} 
                />
            </div>
        </div>
    );
};