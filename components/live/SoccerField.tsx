
import React, { useState } from 'react';
import { APILineup, APILineupPlayer } from '../../types';

interface SoccerFieldProps {
    homeLineup: APILineup | null;
    awayLineup: APILineup | null;
    isProjected?: boolean;
}

// Helper Component for individual player
const PlayerMarker: React.FC<{ player: APILineupPlayer; color: string; leftPct: number; bottomPct: number }> = ({ player, color, leftPct, bottomPct }) => {
    return (
        <div
            className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 w-16 transition-all duration-300 hover:scale-110 hover:z-10 group cursor-pointer"
            style={{ bottom: `${bottomPct}%`, left: `${leftPct}%` }}
        >
            <div
                className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shadow-md ${color} relative z-10 bg-opacity-90 backdrop-blur-sm`}
                title={player.name}
            >
                {player.number}
            </div>

            {/* Name Label - Improved readability */}
            <div className="absolute top-8 w-24 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                <span className="text-[10px] font-bold text-white bg-black/80 px-2 py-1 rounded shadow-lg whitespace-nowrap">
                    {player.name}
                </span>
            </div>

            {/* Simple Name (Always visible) */}
            <span className="mt-1 text-[9px] font-bold text-white bg-black/40 px-1.5 rounded truncate w-full text-center max-w-[60px] shadow-sm">
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

    // --- LOGIC TO CENTRALIZE PLAYERS ---
    // 1. Parse grid strings and attach to object
    const playersWithGrid = currentLineup.startXI.map(item => {
        const grid = item.player.grid || "1:1";
        const [r, c] = grid.split(':').map(val => parseInt(val) || 1);
        return { ...item, gridRow: r, gridCol: c };
    });

    // 2. Group by Row
    const rows: { [key: number]: typeof playersWithGrid } = {};
    playersWithGrid.forEach(p => {
        if (!rows[p.gridRow]) rows[p.gridRow] = [];
        rows[p.gridRow].push(p);
    });

    // 3. Calculate positions
    const positionedPlayers = [];

    // Sort rows keys to ensure explicit order if needed, though we map rows later
    // Row 1 = GK (Bottom), Row 5+ = FW (Top)

    for (const [rowNumStr, rowPlayers] of Object.entries(rows)) {
        const rowNum = parseInt(rowNumStr);

        // Sort players in this row by column index (Left -> Right)
        rowPlayers.sort((a, b) => a.gridCol - b.gridCol);

        const count = rowPlayers.length;

        rowPlayers.forEach((p, idx) => {
            // Horizontal Centering Logic:
            // Distribute evenly across the width (0-100%)
            // Formula: Center point of the segment. 
            // Segment size = 100 / count.
            // Center = index * size + size/2

            // Adjust 'Left' perception: Game often implies 1 is Left, Max is Right.
            // But if we have 2 players at col 1 and 2, and others empty, API might imply specific zones.
            // However, user requested "Centralized". So we IGNORE absolute column gap and just DISTRIBUTE present players.

            const leftPct = ((idx + 0.5) * (100 / count));

            // Vertical Logic:
            // Map row 1..5 to 10%..90% approx.
            // Some formations have 6 rows.
            // Let's use flexible scaling if max rows > 5?
            // Standard: Row 1=10%, Row 2=30%, Row 3=50%, Row 4=70%, Row 5=85%
            const bottomPct = (rowNum * 18) - 5;

            positionedPlayers.push({
                ...p,
                leftPct,
                bottomPct: Math.min(Math.max(bottomPct, 5), 95) // Clamp
            });
        });
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
                    {positionedPlayers.map((item) => (
                        <PlayerMarker
                            key={item.player.id}
                            player={item.player}
                            color={teamColor}
                            leftPct={item.leftPct}
                            bottomPct={item.bottomPct}
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
