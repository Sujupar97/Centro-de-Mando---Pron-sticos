
import React from 'react';
import { APILineup } from '../../types';
import { SoccerField } from './SoccerField';

export const LineupsTab: React.FC<{ lineups: APILineup[] | null }> = ({ lineups }) => {
    if (!lineups || lineups.length === 0) {
        return <div className="text-center py-8 text-gray-400 bg-gray-800 rounded-lg">Las alineaciones aún no están disponibles para este partido.</div>;
    }

    const homeLineup = lineups[0]; // Usually home is first in API response, but strictly should check lineup.team.id vs game.teams.home.id
    const awayLineup = lineups.length > 1 ? lineups[1] : null;

    // Check if lineups are real or fallback (heuristic: usually fallback lineups might miss coach or some data, but let's assume API structure is kept).
    // The service handles fetching. Here we just display.
    
    // If we only have 1 lineup, we display what we have.
    
    return (
        <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                <h4 className="text-lg font-bold text-white mb-4 text-center">Formaciones Tácticas</h4>
                <SoccerField homeLineup={homeLineup} awayLineup={awayLineup} isProjected={false} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {lineups.map((lineup, index) => (
                    <div key={index} className="bg-gray-800 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-700">
                            <div>
                                <h4 className="font-bold text-white">{lineup.team.name}</h4>
                                <p className="text-sm text-gray-400">DT: {lineup.coach?.name || 'N/A'}</p>
                            </div>
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-accent/20 text-green-accent">{lineup.formation || 'N/A'}</span>
                        </div>
                        
                        <div className="max-h-60 overflow-y-auto pr-2">
                            <h5 className="font-semibold text-sm text-gray-300 mb-2 sticky top-0 bg-gray-800">Titulares</h5>
                            <ul className="space-y-1.5 text-sm">
                                {lineup.startXI.map(p => (
                                    <li key={p.player.id} className="flex items-center justify-between hover:bg-gray-700/50 p-1 rounded">
                                       <div className="flex items-center">
                                            <span className="w-6 font-mono text-gray-400 font-bold">{p.player.number || '-'}</span>
                                            <span>{p.player.name}</span>
                                       </div>
                                       <span className="px-1.5 py-0.5 text-xs rounded bg-gray-700 text-gray-300">{p.player.pos}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
