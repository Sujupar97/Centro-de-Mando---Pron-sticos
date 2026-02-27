// components/recap/RecapBadge.tsx
// Small indicator button to re-open the Daily Recap modal.
// Used in sidebar (desktop) and header (mobile).

import React from 'react';
import { ChartBarIcon } from '../icons/Icons';

interface RecapBadgeProps {
    hasData: boolean;
    hasUnseen: boolean;
    onReopen: () => void;
    variant: 'sidebar' | 'mobile';
}

export const RecapBadge: React.FC<RecapBadgeProps> = ({ hasData, hasUnseen, onReopen, variant }) => {
    if (!hasData) return null;

    if (variant === 'mobile') {
        return (
            <button
                onClick={onReopen}
                className="relative text-slate-400 hover:text-white transition-colors p-1"
                title="Recap del Día"
            >
                <ChartBarIcon className="w-5 h-5" />
                {hasUnseen && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                )}
            </button>
        );
    }

    // Sidebar variant
    return (
        <button
            onClick={onReopen}
            className="w-full flex items-center px-4 py-2.5 mx-3 mb-2 rounded-xl text-slate-400 hover:bg-white/5 hover:text-slate-100 transition-all duration-300 group"
            style={{ width: 'calc(100% - 24px)' }}
        >
            <div className="mr-3 transition-transform duration-300 group-hover:scale-110">
                <ChartBarIcon className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Recap</span>
            {hasUnseen && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            )}
        </button>
    );
};
