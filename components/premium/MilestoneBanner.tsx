import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Milestone } from '../../hooks/useMilestones';

interface MilestoneBannerProps {
  milestone: Milestone | null;
  onDismiss: () => void;
}

export const MilestoneBanner: React.FC<MilestoneBannerProps> = ({ milestone, onDismiss }) => {
  useEffect(() => {
    if (!milestone) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [milestone, onDismiss]);

  return createPortal(
    <AnimatePresence>
      {milestone && (
        <motion.div
          className="fixed top-20 left-1/2 z-[70] -translate-x-1/2"
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={onDismiss}
        >
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-amber-500/20 shadow-[0_0_30px_rgba(251,191,36,0.15)] cursor-pointer">
            <span className="text-3xl">{milestone.icon}</span>
            <div>
              <p className="text-white font-bold text-sm">{milestone.title}</p>
              <p className="text-slate-400 text-xs">{milestone.description}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
