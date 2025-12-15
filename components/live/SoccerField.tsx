
import React, { useState } from 'react';
import { APILineup, APILineupPlayer } from '../../types';

interface SoccerFieldProps {
    homeLineup: APILineup | null;
    awayLineup: APILineup | null;
    isProjected?: boolean;
}

const PlayerMarker: React.FC<{ player: APILineupPlayer; color: string; grid: string }> = ({ player, color, grid }) => {
    // API-Football grid format is "row:col" (e.g., "1:1" is goalkeeper).
    // Rows usually go 1 (GK) to 5/6 (Strikers). Cols go 1 (Left) to X (Right).
    
    if (!grid) return null;
    
    const [rowStr, colStr] = grid.split(':');
    const row = parseInt(rowStr);
    const col = parseInt(colStr);

    // Calculate approximate position percentages
    // Row 1 is bottom (GK), Row 5 is top (FW) usually in vertical view, but standard logic:
    // We'll map Row to 'bottom' percentage.
    // 1 -> 10%, 2 -> 30%, 3 -> 50%, 4 -> 70%, 5 -> 90%
    const bottomPct = (row * 18) - 5; 
    
    // Col mapping depends on how many players are in that row, but API grid is generic.
    // Assuming max 5 cols logic roughly. 
    // We need to normalize col based on horizontal spread. 
    // Usually implies generic zones. Let's try simple distribution.
    // Actually, API grid implies relative position.
    
    // Simplification for visualization:
    // Left css property based on col. 
    // If col is 1, it's left. If col is high, right.
    // This requires knowing max cols per row, but let's approximate.
    // Standard pitch width approx spread.
    
    // Heuristic: Map 1..5 to 10%..90%
    const leftPct = (col * 20) - 10; 

    return (
        <div 
            className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 w-16 transition-all duration-300 hover:scale-110 hover:z-10"
            style={{ bottom: `${bottomPct}%`, left: `${leftPct}%` }}
        >
            <div 
                className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shadow-md ${color}`}
                title={player.name}
            >
                {player.number}
            </div>
            <span className="mt-1 text-[10px] font-bold text-white bg-black/50 px-1.5 rounded truncate w-full text-center">
                {player.name.split(' ').pop()}
            </span>
        </div>
    );
};

export const SoccerField: React.FC<SoccerFieldProps> = ({ homeLineup, awayLineup, isProjected = false }) => {
    const [viewTeam, setViewTeam] = useState<'home' | 'away'>('home');

    const currentLineup = viewTeam === 'home' ? homeLineup : awayLineup;
    const teamColor = viewTeam === 'home' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white';

    if (!currentLineup) {
        return (
            <div className="h-96 bg-green-800/50 rounded-lg flex items-center justify-center border border-green-700">
                <p className="text-gray-300">Alineación no disponible para visualizar.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col space-y-4">
            {/* Controles */}
            <div className="flex justify-center space-x-4 bg-gray-800 p-2 rounded-lg">
                <button
                    onClick={() => setViewTeam('home')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${viewTeam === 'home' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                >
                    Local: {homeLineup?.team.name}
                </button>
                <button
                    onClick={() => setViewTeam('away')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${viewTeam === 'away' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                >
                    Visitante: {awayLineup?.team.name}
                </button>
            </div>

            {isProjected && (
                <div className="bg-yellow-500/20 text-yellow-400 text-xs text-center py-1 rounded border border-yellow-500/30">
                    ⚠️ Alineación proyectada basada en el último partido (Formación no confirmada aún).
                </div>
            )}

            {/* Cancha */}
            <div className="relative w-full aspect-[2/3] md:aspect-[3/4] max-w-md mx-auto bg-green-700 rounded-lg border-4 border-white/20 shadow-inner overflow-hidden">
                {/* Dibujo de la cancha (CSS puro) */}
                <div className="absolute inset-0 flex flex-col">
                    {/* Área Portero */}
                    <div className="h-[10%] border-b-2 border-white/30 mx-[30%] border-x-2 relative"></div>
                    
                    {/* Medio Campo */}
                    <div className="absolute top-1/2 w-full border-t-2 border-white/30 transform -translate-y-1/2"></div>
                    <div className="absolute top-1/2 left-1/2 w-[20%] aspect-square border-2 border-white/30 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                    
                    {/* Área Rival (Visualmente arriba) */}
                    <div className="absolute top-0 h-[10%] w-[40%] left-[30%] border-b-2 border-x-2 border-white/30 rounded-b-sm opacity-50"></div>
                </div>

                {/* Patrón de césped */}
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, #000 20px, #000 40px)' }}></div>

                {/* Jugadores */}
                <div className="absolute inset-0 p-4">
                    {/* Titulares */}
                    {currentLineup.startXI.map((item) => (
                        <PlayerMarker 
                            key={item.player.id} 
                            player={item.player} 
                            color={teamColor} 
                            grid={item.player.grid || "1:1"} // Fallback safe
                        />
                    ))}
                </div>
            </div>

            <div className="text-center text-sm text-gray-400">
                <span className="font-semibold text-white">Formación:</span> {currentLineup.formation}
            </div>
        </div>
    );
};
