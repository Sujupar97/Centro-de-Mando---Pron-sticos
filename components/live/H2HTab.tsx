import React from 'react';
import { Game } from '../../types';

export const H2HTab: React.FC<{ h2h: Game[] | null }> = ({ h2h }) => {
    if (!h2h || h2h.length === 0) {
        return <div className="text-center py-4 text-gray-400">No hay datos de enfrentamientos directos disponibles.</div>;
    }

    return (
        <div className="space-y-2">
            {h2h.map((game, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg text-sm">
                    <span className="text-gray-400">{new Date(game.fixture.timestamp * 1000).toLocaleDateString('es-ES')}</span>
                    <div className="flex-grow text-center">
                        <span className="text-white font-medium">{game.teams.home.name}</span>
                        <span className="font-bold text-green-accent mx-2">{game.goals.home} - {game.goals.away}</span>
                        <span className="text-white font-medium">{game.teams.away.name}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};