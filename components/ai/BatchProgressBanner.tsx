import React, { useEffect } from 'react';
import { Game } from '../../types';

interface BatchProgressBannerProps {
    total: number;
    completed: number;
    currentGame: Game | null;
    leagueName: string;
    isActive: boolean;
    results: Record<number, 'done' | 'failed'>;
    onCancel: () => void;
    onDismiss: () => void;
}

const BatchProgressBanner: React.FC<BatchProgressBannerProps> = ({
    total, completed, currentGame, leagueName, isActive, results, onCancel, onDismiss
}) => {
    const successCount = Object.values(results).filter(r => r === 'done').length;
    const failCount = Object.values(results).filter(r => r === 'failed').length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const currentNum = completed + 1;
    const isFinished = !isActive && completed > 0 && completed >= total;

    // Auto-dismiss after 4 seconds when batch finishes
    useEffect(() => {
        if (isFinished) {
            const timer = setTimeout(onDismiss, 4000);
            return () => clearTimeout(timer);
        }
    }, [isFinished, onDismiss]);

    // Don't show if never started or already dismissed
    if (!isActive && !isFinished) return null;

    return (
        <div className={`mb-4 rounded-xl border backdrop-blur-sm overflow-hidden ${isFinished ? 'border-emerald-500/30 bg-emerald-950/60' : 'border-blue-500/30 bg-blue-950/60'}`}>
            {/* Progress bar */}
            <div className="h-1 bg-blue-900/50">
                <div
                    className={`h-full transition-all duration-500 ease-out ${isFinished ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-blue-500 to-brand'}`}
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Spinner or check */}
                    {isFinished ? (
                        <span className="text-emerald-400 text-lg flex-shrink-0">&#10003;</span>
                    ) : (
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    )}

                    <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                            {isFinished ? (
                                `Batch completado: ${leagueName}`
                            ) : currentGame ? (
                                `Analizando ${currentNum} de ${total}: ${currentGame.teams.home.name} vs ${currentGame.teams.away.name}`
                            ) : (
                                `Preparando análisis ${currentNum} de ${total}...`
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-xs mt-0.5">
                            <span className={isFinished ? 'text-emerald-300' : 'text-blue-300'}>{leagueName}</span>
                            {successCount > 0 && <span className="text-emerald-400">{successCount} completados</span>}
                            {failCount > 0 && <span className="text-red-400">{failCount} fallidos</span>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-sm font-bold ${isFinished ? 'text-emerald-300' : 'text-blue-300'}`}>{progressPct}%</span>
                    {!isFinished && (
                        <button
                            onClick={onCancel}
                            className="px-3 py-1 text-xs font-medium text-red-300 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/30"
                        >
                            Cancelar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BatchProgressBanner;
