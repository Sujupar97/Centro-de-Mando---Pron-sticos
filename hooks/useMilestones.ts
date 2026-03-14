import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'derbix_milestones_seen';

export interface Milestone {
  id: string;
  title: string;
  icon: string;
  description: string;
}

const MILESTONE_DEFS: Milestone[] = [
  { id: 'streak_5', title: 'Racha de Fuego', icon: '\uD83D\uDD25', description: '5 picks ganados consecutivos' },
  { id: 'golden_week', title: 'Semana Dorada', icon: '\u2B50', description: 'Win rate \u226575% en la semana' },
  { id: 'rookie', title: 'Rookie', icon: '\uD83C\uDF1F', description: 'Tu primera semana en Derbix' },
  { id: 'veteran', title: 'Veterano', icon: '\uD83C\uDFC5', description: '30 d\u00EDas usando Derbix' },
  { id: 'perfect_day', title: 'D\u00EDa Perfecto', icon: '\uD83D\uDCAF', description: '10+ picks ganados en un d\u00EDa' },
];

export const useMilestones = (isPaidUser: boolean) => {
  const [pendingMilestone, setPendingMilestone] = useState<Milestone | null>(null);

  const getSeenMilestones = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const markSeen = useCallback((id: string) => {
    const seen = getSeenMilestones();
    if (!seen.includes(id)) {
      seen.push(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    }
    setPendingMilestone(null);
  }, []);

  const triggerMilestone = useCallback((id: string) => {
    if (!isPaidUser) return;
    const seen = getSeenMilestones();
    if (seen.includes(id)) return;
    const milestone = MILESTONE_DEFS.find(m => m.id === id);
    if (milestone) {
      setPendingMilestone(milestone);
    }
  }, [isPaidUser]);

  // Check for "rookie" milestone on first load
  useEffect(() => {
    if (!isPaidUser) return;
    const seen = getSeenMilestones();
    if (!seen.includes('rookie')) {
      const timer = setTimeout(() => triggerMilestone('rookie'), 5000);
      return () => clearTimeout(timer);
    }
  }, [isPaidUser, triggerMilestone]);

  const dismissMilestone = useCallback(() => {
    if (pendingMilestone) {
      markSeen(pendingMilestone.id);
    }
  }, [pendingMilestone, markSeen]);

  return {
    pendingMilestone,
    triggerMilestone,
    dismissMilestone,
    allMilestones: MILESTONE_DEFS,
  };
};
