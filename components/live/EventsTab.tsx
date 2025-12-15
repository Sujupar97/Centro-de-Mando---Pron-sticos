import React from 'react';
import { APIEvent } from '../../types';
import { GoalIcon, YellowCardIcon, RedCardIcon, SubstitutionIcon } from '../icons/Icons';

const EventIcon: React.FC<{ event: APIEvent }> = ({ event }) => {
    switch (event.type) {
        case 'Goal':
            return <GoalIcon className="w-5 h-5 text-green-accent" />;
        case 'Card':
            if (event.detail.toLowerCase().includes('yellow')) {
                return <YellowCardIcon className="w-5 h-5 text-yellow-400" />;
            }
            return <RedCardIcon className="w-5 h-5 text-red-accent" />;
        case 'subst':
            return <SubstitutionIcon className="w-5 h-5 text-blue-400" />;
        default:
            return null;
    }
};

export const EventsTab: React.FC<{ events: APIEvent[] | null }> = ({ events }) => {
    if (!events || events.length === 0) {
        return <div className="text-center py-4 text-gray-400">No hay eventos destacados en este partido.</div>;
    }

    return (
        <div className="space-y-3">
            {[...events].reverse().map((event, index) => (
                <div key={index} className="flex items-center space-x-3 text-sm">
                    <div className="w-10 text-center font-mono text-gray-400">{event.time.elapsed}'</div>
                    <div className="flex items-center justify-center w-8 h-8 bg-gray-800 rounded-full flex-shrink-0">
                        <EventIcon event={event} />
                    </div>
                    <div className="flex-grow">
                        <p className="font-semibold text-white">{event.player.name}</p>
                        <p className="text-xs text-gray-400">{event.detail} ({event.team.name})</p>
                    </div>
                </div>
            ))}
        </div>
    );
};