import confetti from 'canvas-confetti';

/**
 * Trigger a short confetti burst for win celebrations.
 * Called from DailyRecapModal or HighProbPicks when a good result is detected.
 */
export const triggerWinCelebration = () => {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.4 },
    colors: ['#10b981', '#34d399', '#059669'],
    gravity: 1.2,
    ticks: 80,
  });
};
