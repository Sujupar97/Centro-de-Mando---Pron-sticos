import React from 'react';
import { APIFixtureStatistics } from '../../types';

const StatRow: React.FC<{ type: string; homeValue: number; awayValue: number }> = ({ type, homeValue, awayValue }) => {
    const total = homeValue + awayValue;
    const homeWidth = total > 0 ? (homeValue / total) * 100 : 50;
    const awayWidth = total > 0 ? (awayValue / total) * 100 : 50;

    const homeBarClass = homeValue >= awayValue ? 'bg-green-accent' : 'bg-gray-600';
    const awayBarClass = awayValue >= homeValue ? 'bg-green-accent' : 'bg-gray-600';

    const finalHomeBarClass = homeValue === awayValue ? 'bg-gray-600' : homeBarClass;
    const finalAwayBarClass = homeValue === awayValue ? 'bg-gray-600' : awayBarClass;

    return (
        <div className="my-3 animate-fade-in">
            <div className="flex justify-between items-center text-sm mb-1 px-1">
                <span className="font-bold text-lg text-white">{homeValue}</span>
                <span className="text-xs text-gray-400 uppercase font-semibold tracking-wider">{type}</span>
                <span className="font-bold text-lg text-white">{awayValue}</span>
            </div>
            <div className="flex w-full h-2 rounded-full bg-gray-900 overflow-hidden">
                <div className={`h-full rounded-l-full transition-all duration-500 ${finalHomeBarClass}`} style={{ width: `${homeWidth}%` }}></div>
                <div className={`h-full rounded-r-full transition-all duration-500 ${finalAwayBarClass}`} style={{ width: `${awayWidth}%` }}></div>
            </div>
        </div>
    );
};

// Diccionario de Traducciones
const STATS_TRANSLATIONS: { [key: string]: string } = {
    "Shots on Goal": "Tiros a Puerta",
    "Shots off Goal": "Tiros Fuera",
    "Total Shots": "Remates Totales",
    "Blocked Shots": "Remates Bloqueados",
    "Shots insidebox": "Remates al Arco",
    "Shots outsidebox": "Remates Fuera",
    "Fouls": "Faltas",
    "Corner Kicks": "Tiros de Esquina",
    "Offsides": "Fueras de Juego",
    "Ball Possession": "Posesión de Balón",
    "Yellow Cards": "Tarjetas Amarillas",
    "Red Cards": "Tarjetas Rojas",
    "Goalkeeper Saves": "Atajadas",
    "Total passes": "Pases Totales",
    "Passes accurate": "Pases Completados",
    "Passes %": "% Pases",
    "Passes % ": "% Pases", // Fix for potential API trailing spaces
    "expected_goals": "Goles Esperados (xG)",
    "goals_prevented": "Goles Prevenidos"
};

const translateStat = (type: string) => {
    // Normalizar key (trim) y buscar
    const cleanType = type.trim();
    return STATS_TRANSLATIONS[cleanType] || cleanType;
};

export const StatisticsTab: React.FC<{ stats: APIFixtureStatistics[] | null }> = ({ stats }) => {
    if (!stats || stats.length < 2) {
        return <div className="text-center py-8 text-gray-500">No hay estadísticas detalladas disponibles para este partido.</div>;
    }

    const homeStats = stats[0].statistics;
    const awayStats = stats[1].statistics;

    // Obtener tipos únicos
    const allStatTypes = [...new Set([...homeStats.map(s => s.type), ...awayStats.map(s => s.type)])];

    // Lista de estadísticas prioritarias para ordenar
    const PRIORITY_ORDER = [
        "Expected Goals", "Ball Possession", "Total Shots", "Shots on Goal",
        "Corner Kicks", "Fouls", "Yellow Cards", "Red Cards"
    ];

    // Ordenar estadísticas: Prioritarias primero, luego alfabético o por aparición
    // (Opcional: Si el usuario quiere orden específico, podemos añadir sort logic. Por ahora mantenemos el orden de aparición o API)
    // Pero traduciremos en el render.

    const getStatValue = (teamStats: { type: string, value: any }[], type: string): number => {
        const stat = teamStats.find(s => s.type === type);
        if (stat?.value === null || stat?.value === undefined) return 0;
        if (typeof stat.value === 'string' && stat.value.endsWith('%')) {
            return parseFloat(stat.value);
        }
        return Number(stat.value) || 0;
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg">
            {allStatTypes.map(type => {
                const homeValue = getStatValue(homeStats, type);
                const awayValue = getStatValue(awayStats, type);
                if (homeValue === 0 && awayValue === 0) return null;

                const label = translateStat(type);

                return <StatRow key={type} type={label} homeValue={homeValue} awayValue={awayValue} />;
            })}
        </div>
    );
};