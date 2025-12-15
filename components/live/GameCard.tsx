import React, { useState, useCallback, useEffect } from 'react';
import { Game, GameDetails, APIStanding } from '../../types';
import { fetchGameDetails } from '../../services/liveDataService';
import { ChartBarIcon, ClockIcon, UsersIcon, UsersGroupIcon, ListBulletIcon, TrophyIcon, ArrowPathIcon } from '../icons/Icons';
import { StatisticsTab } from './StatisticsTab';
import { EventsTab } from './EventsTab';
import { H2HTab } from './H2HTab';
import { LineupsTab } from './LineupsTab';
import { TeamStatsTab } from './TeamStatsTab';
import { StandingsTab } from './StandingsTab';

type ActiveTab = 'stats' | 'events' | 'h2h' | 'lineups' | 'team_stats' | 'standings';

export const GameCard: React.FC<{ game: Game; }> = ({ game }) => {
    const [details, setDetails] = useState<GameDetails | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefetching, setIsRefetching] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<ActiveTab>('stats');

    const loadDetails = useCallback(async (forceRefresh = false) => {
        if (forceRefresh) {
            setIsRefetching(true);
        } else {
            setIsLoading(true);
        }
        setError('');

        try {
            const fetchedDetails = await fetchGameDetails(game);
            setDetails(fetchedDetails);
        } catch (err) {
            setError('No se pudieron cargar los detalles del partido.');
            console.error(err);
        } finally {
            setIsLoading(false);
            setIsRefetching(false);
        }
    }, [game]);
    
    useEffect(() => {
        loadDetails(false);
    }, [loadDetails]);


    const handleRefresh = (e: React.MouseEvent) => {
        e.stopPropagation();
        loadDetails(true);
    };
    
    const renderTabContent = () => {
        if (!details) return null;
        switch (activeTab) {
            case 'stats': return <StatisticsTab stats={details.statistics} />;
            case 'events': return <EventsTab events={details.events} />;
            case 'h2h': return <H2HTab h2h={details.h2h} />;
            case 'lineups': return <LineupsTab lineups={details.lineups} />;
            case 'team_stats': return <TeamStatsTab teamStats={details.teamStats} />;
            case 'standings': return <StandingsTab standings={details.standings?.[0] || null} homeTeamId={game.teams.home.id} awayTeamId={game.teams.away.id} />;
            default: return null;
        }
    };

    const tabs = [
        { id: 'stats', name: 'Estadísticas', icon: <ChartBarIcon className="w-5 h-5"/> },
        { id: 'events', name: 'Eventos', icon: <ClockIcon className="w-5 h-5"/> },
        { id: 'lineups', name: 'Alineaciones', icon: <UsersGroupIcon className="w-5 h-5"/> },
        { id: 'team_stats', name: 'Est. Equipo', icon: <TrophyIcon className="w-5 h-5"/> },
        { id: 'standings', name: 'Clasificación', icon: <ListBulletIcon className="w-5 h-5"/> },
        { id: 'h2h', name: 'H2H', icon: <UsersIcon className="w-5 h-5"/> },
    ];
    
    return (
        <div className="border-t border-gray-700 bg-gray-900/50 rounded-b-lg p-4">
            {isLoading && (
                <div className="text-center py-4">
                    <div className="w-6 h-6 border-2 border-green-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-gray-400 mt-2">
                        Cargando detalles... La primera carga puede tardar si se sincronizan datos.
                    </p>
                </div>
            )}
            {error && <div className="text-center py-4 text-red-accent">{error}</div>}
            
            {!isLoading && details && (
                <div>
                    <div className="flex justify-between items-center border-b border-gray-700 mb-4">
                        <div className="flex overflow-x-auto">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as ActiveTab)}
                                    className={`flex items-center space-x-2 py-2 px-4 text-sm font-medium transition-colors flex-shrink-0 ${
                                        activeTab === tab.id
                                            ? 'border-b-2 border-green-accent text-green-accent'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {tab.icon}
                                    <span>{tab.name}</span>
                                </button>
                            ))}
                        </div>
                         <button
                            onClick={handleRefresh}
                            disabled={isRefetching}
                            className="p-2 ml-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
                            aria-label="Refrescar datos"
                        >
                            <ArrowPathIcon className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    {renderTabContent()}
                </div>
            )}
        </div>
    );
};