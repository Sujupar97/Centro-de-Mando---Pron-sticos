import React from 'react';

interface PremiumBadgeProps {
  planName: string;
  size?: 'sm' | 'md';
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({ planName, size = 'sm' }) => {
  const normalized = planName?.toLowerCase() || 'free';

  if (normalized === 'free' || normalized === 'gratis') return null;

  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  if (normalized === 'starter') {
    return (
      <span className={`${sizeClasses} rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20`}>
        Starter
      </span>
    );
  }

  if (normalized === 'pro') {
    return (
      <span className={`${sizeClasses} rounded-full font-bold border border-purple-500/30 premium-shimmer-badge`}
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.15))',
          color: '#a78bfa',
        }}
      >
        Pro
      </span>
    );
  }

  if (normalized === 'premium') {
    return (
      <span className={`${sizeClasses} rounded-full font-bold border border-amber-500/30 animate-gold-glow`}
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.15))',
          color: '#fbbf24',
        }}
      >
        Premium
      </span>
    );
  }

  return null;
};

// Avatar ring style based on plan
export const getAvatarRingClass = (planName: string): string => {
  const normalized = planName?.toLowerCase() || 'free';
  switch (normalized) {
    case 'starter':
      return 'ring-2 ring-blue-500/50 ring-offset-1 ring-offset-slate-900';
    case 'pro':
      return 'ring-2 ring-purple-500/60 ring-offset-1 ring-offset-slate-900';
    case 'premium':
      return 'ring-2 ring-amber-400/60 ring-offset-1 ring-offset-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.3)]';
    default:
      return '';
  }
};

// Plan badge button style for sidebar
export const getPlanBadgeClass = (planName: string): string => {
  const normalized = planName?.toLowerCase() || 'free';
  switch (normalized) {
    case 'starter':
      return 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20';
    case 'pro':
      return 'bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border-purple-500/20 hover:from-purple-500/20 hover:to-indigo-500/20 premium-shimmer-btn';
    case 'premium':
      return 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/20 hover:from-amber-500/20 hover:to-yellow-500/20 animate-gold-glow';
    default:
      return 'bg-slate-800/50 border-white/5 hover:bg-emerald-500/10';
  }
};

// Plan name color for sidebar display
export const getPlanNameColor = (planName: string): string => {
  const normalized = planName?.toLowerCase() || 'free';
  switch (normalized) {
    case 'starter':
      return 'text-blue-400';
    case 'pro':
      return 'text-purple-400';
    case 'premium':
      return 'text-amber-400';
    default:
      return 'text-emerald-400';
  }
};
