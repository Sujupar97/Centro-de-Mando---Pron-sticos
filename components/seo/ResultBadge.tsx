import React from 'react';

interface ResultBadgeProps {
  result: 'WON' | 'LOST' | 'VOID' | 'PENDING' | string;
  size?: 'sm' | 'md';
}

export const ResultBadge: React.FC<ResultBadgeProps> = ({ result, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  switch (result) {
    case 'WON':
      return (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30`}>
          ✓ Acertada
        </span>
      );
    case 'LOST':
      return (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full font-bold bg-red-500/15 text-red-400 border border-red-500/30`}>
          ✗ Fallada
        </span>
      );
    case 'VOID':
      return (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30`}>
          ⊘ Nula
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 ${sizeClasses} rounded-full font-medium bg-slate-500/15 text-slate-400 border border-slate-500/30`}>
          ⏳ Pendiente
        </span>
      );
  }
};
