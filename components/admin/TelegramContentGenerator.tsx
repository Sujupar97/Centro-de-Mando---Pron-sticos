import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseService';
import { getCurrentDateInBogota } from '../../utils/dateUtils';
import { getSmartParlays, translateMarket } from '../../services/smartParlayService';
import { getPublicResults } from '../../services/resultsService';

interface TelegramBlock {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    content: string;
    available: boolean;
    loading: boolean;
}

interface PickData {
    fixture_id: number;
    market: string;
    selection: string;
    odds: number;
    home_team: string;
    away_team: string;
    league: string;
}

function formatDateSpanish(dateStr: string): string {
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const [, m, d] = dateStr.split('-').map(Number);
    return `${d} de ${months[m - 1]}`;
}

function getYesterday(today: string): string {
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(y, m - 1, d - 1);
    return date.toISOString().split('T')[0];
}

function get7DaysAgo(today: string): string {
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(y, m - 1, d - 7);
    return date.toISOString().split('T')[0];
}

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

export const TelegramContentGenerator: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [blocks, setBlocks] = useState<TelegramBlock[]>([
        { id: 'morning', title: 'Pronósticos del Día', subtitle: 'Top 5 oportunidades para hoy', icon: '⚽', content: '', available: false, loading: true },
        { id: 'parlay', title: 'Parlay del Día', subtitle: 'Combinada conservadora', icon: '🎯', content: '', available: false, loading: true },
        { id: 'evening', title: 'Resultados del Día', subtitle: 'Resumen de ayer', icon: '📊', content: '', available: false, loading: true },
        { id: 'weekly', title: 'Resumen Semanal', subtitle: 'Últimos 7 días', icon: '📈', content: '', available: false, loading: true },
        { id: 'welcome', title: 'Mensaje de Bienvenida', subtitle: 'Pin del canal', icon: '👋', content: '', available: true, loading: false },
    ]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const updateBlock = useCallback((id: string, updates: Partial<TelegramBlock>) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    }, []);

    // ──── Fetch Morning Picks ────
    const fetchMorningPicks = useCallback(async () => {
        updateBlock('morning', { loading: true });
        try {
            const today = getCurrentDateInBogota();

            const { data: picks } = await supabase
                .from('value_picks_v2')
                .select('fixture_id, market, selection, odds, opportunity_rank')
                .eq('is_opportunity', true)
                .eq('opportunity_date', today)
                .order('opportunity_rank', { ascending: true })
                .limit(5);

            if (!picks || picks.length === 0) {
                updateBlock('morning', { loading: false, available: false, content: '' });
                return;
            }

            // Enrich with match data
            const fixtureIds = picks.map(p => p.fixture_id);
            const { data: matches } = await supabase
                .from('daily_matches')
                .select('api_fixture_id, home_team, away_team, league_name')
                .in('api_fixture_id', fixtureIds);

            const matchMap = new Map((matches || []).map(m => [m.api_fixture_id, m]));

            const enriched: PickData[] = picks.map(p => {
                const match = matchMap.get(p.fixture_id);
                return {
                    fixture_id: p.fixture_id,
                    market: p.market,
                    selection: p.selection,
                    odds: p.odds,
                    home_team: match?.home_team || 'Equipo Local',
                    away_team: match?.away_team || 'Equipo Visitante',
                    league: match?.league_name || 'Liga',
                };
            });

            const dateLabel = formatDateSpanish(today);
            let msg = `⚽ PRONÓSTICOS DEL DÍA | ${dateLabel}\n\nNuestras mejores oportunidades para hoy:\n`;

            enriched.forEach(pick => {
                msg += `\n🏆 ${pick.league}\n${pick.home_team} vs ${pick.away_team}\n📊 ${translateMarket(pick.market)}: ${pick.selection}\n💰 Cuota: ${pick.odds.toFixed(2)}\n`;
            });

            msg += `\nSolo mostramos los mejores. Análisis completo con probabilidades y más picks en:\n👉 derbix.co`;

            updateBlock('morning', { loading: false, available: true, content: msg });
        } catch (err) {
            console.error('[TelegramContent] Morning picks error:', err);
            updateBlock('morning', { loading: false, available: false });
        }
    }, [updateBlock]);

    // ──── Fetch Parlay of the Day ────
    const fetchParlay = useCallback(async () => {
        updateBlock('parlay', { loading: true });
        try {
            const today = getCurrentDateInBogota();
            const parlays = await getSmartParlays(today);

            const conservative = parlays.find(p => p.risk_tier === 'conservative');
            if (!conservative) {
                updateBlock('parlay', { loading: false, available: false, content: '' });
                return;
            }

            const dateLabel = formatDateSpanish(today);
            let msg = `🎯 PARLAY DEL DÍA | ${dateLabel}\n\nCombinada conservadora de ${conservative.picks.length} selecciones:\n`;

            conservative.picks.forEach((pick, i) => {
                const emoji = NUMBER_EMOJIS[i] || `${i + 1}.`;
                msg += `\n${emoji} ${pick.home_team} vs ${pick.away_team}\n   ${translateMarket(pick.market)}: ${pick.selection} @ ${pick.odds.toFixed(2)}\n`;
            });

            msg += `\n💰 Cuota combinada: ${conservative.combined_odds.toFixed(2)}\n`;
            msg += `\nGenerado por IA analizando +3.000 datos por partido.\n\nVer todos los parlays → derbix.co`;

            updateBlock('parlay', { loading: false, available: true, content: msg });
        } catch (err) {
            console.error('[TelegramContent] Parlay error:', err);
            updateBlock('parlay', { loading: false, available: false });
        }
    }, [updateBlock]);

    // ──── Fetch Evening Results ────
    const fetchEveningResults = useCallback(async () => {
        updateBlock('evening', { loading: true });
        try {
            const today = getCurrentDateInBogota();
            const yesterday = getYesterday(today);

            const results = await getPublicResults(yesterday, yesterday, 'picks');

            if (!results || results.totalVerified === 0) {
                updateBlock('evening', { loading: false, available: false, content: '' });
                return;
            }

            const dateLabel = formatDateSpanish(yesterday);
            let msg = `📊 RESULTADOS | ${dateLabel}\n\n`;
            msg += `✅ ${results.won} aciertos | ❌ ${results.lost} fallos\n`;
            msg += `🎯 Win Rate: ${results.winRate.toFixed(1)}%\n`;

            // Top wins by highest odds
            const wins = (results.recentResults || [])
                .filter(r => r.result === 'WON')
                .sort((a, b) => (b.odds || 0) - (a.odds || 0))
                .slice(0, 5);

            if (wins.length > 0) {
                msg += `\nMejores aciertos:\n`;
                wins.forEach(w => {
                    const score = w.actual_score ? ` (${w.actual_score})` : '';
                    msg += `\n✅ ${w.home_team} vs ${w.away_team}${score}\n   ${translateMarket(w.market)}: ${w.selection} @ ${(w.odds || 0).toFixed(2)}\n`;
                });
            }

            if (results.currentStreak && results.currentStreak.type === 'win' && results.currentStreak.count > 3) {
                msg += `\n🔥 Racha: ${results.currentStreak.count} aciertos seguidos\n`;
            }

            msg += `\nResultados completos → derbix.co`;

            updateBlock('evening', { loading: false, available: true, content: msg });
        } catch (err) {
            console.error('[TelegramContent] Evening results error:', err);
            updateBlock('evening', { loading: false, available: false });
        }
    }, [updateBlock]);

    // ──── Fetch Weekly Summary ────
    const fetchWeeklySummary = useCallback(async () => {
        updateBlock('weekly', { loading: true });
        try {
            const today = getCurrentDateInBogota();
            const weekAgo = get7DaysAgo(today);

            const results = await getPublicResults(weekAgo, today, 'picks');

            if (!results || results.totalVerified === 0) {
                updateBlock('weekly', { loading: false, available: false, content: '' });
                return;
            }

            const startLabel = formatDateSpanish(weekAgo);
            const endLabel = formatDateSpanish(today);

            let msg = `📈 RESUMEN SEMANAL | ${startLabel} - ${endLabel}\n\n`;
            msg += `📊 ${results.totalVerified} pronósticos verificados\n`;
            msg += `✅ ${results.won} aciertos | ❌ ${results.lost} fallos\n`;
            msg += `🎯 Win Rate: ${results.winRate.toFixed(1)}%\n`;

            if (results.bankroll?.periodROI !== undefined) {
                msg += `💰 ROI: ${results.bankroll.periodROI.toFixed(1)}%\n`;
            }

            if (results.currentStreak && results.currentStreak.type === 'win' && results.currentStreak.count > 2) {
                msg += `🔥 Racha actual: ${results.currentStreak.count} aciertos seguidos\n`;
            }

            msg += `\nLa constancia hace la diferencia. Cada pick es analizado con +3.000 datos estadísticos.\n\nEmpieza gratis → derbix.co`;

            updateBlock('weekly', { loading: false, available: true, content: msg });
        } catch (err) {
            console.error('[TelegramContent] Weekly summary error:', err);
            updateBlock('weekly', { loading: false, available: false });
        }
    }, [updateBlock]);

    // ──── Welcome Message (static) ────
    const generateWelcome = useCallback(() => {
        const msg = `👋 Bienvenido a Derbix

Aquí recibirás:

⚽ Pronósticos del día (10-11 AM)
🎯 Parlay del día
📊 Resultados verificados (noche)
📈 Resumen semanal (lunes)

Derbix analiza +3.000 datos por partido con inteligencia artificial para encontrar oportunidades de valor.

Todos los pronósticos, probabilidades y análisis completos:
👉 derbix.co

🔔 Activa notificaciones para no perderte nada.`;

        updateBlock('welcome', { content: msg, available: true, loading: false });
    }, [updateBlock]);

    // ──── Load All ────
    const loadAll = useCallback(async () => {
        setRefreshing(true);
        generateWelcome();
        await Promise.allSettled([
            fetchMorningPicks(),
            fetchParlay(),
            fetchEveningResults(),
            fetchWeeklySummary(),
        ]);
        setRefreshing(false);
    }, [fetchMorningPicks, fetchParlay, fetchEveningResults, fetchWeeklySummary, generateWelcome]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // ──── Copy ────
    const handleCopy = async (blockId: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedId(blockId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    const unavailableMessages: Record<string, string> = {
        morning: 'Los pronósticos del día aún no están disponibles. Se generan después del análisis diario (8-10 AM).',
        parlay: 'Los parlays se generan junto con los pronósticos del día.',
        evening: 'Aún no hay resultados verificados para ayer.',
        weekly: 'No hay suficientes datos verificados en los últimos 7 días.',
        welcome: '',
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {onBack && (
                <button
                    onClick={onBack}
                    className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    Volver a Admin
                </button>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <svg className="w-7 h-7 text-sky-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                        Contenido Telegram
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Mensajes listos para copiar y pegar en tu canal</p>
                </div>

                <button
                    onClick={loadAll}
                    disabled={refreshing}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                >
                    <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                    {refreshing ? 'Actualizando...' : 'Actualizar'}
                </button>
            </div>

            {/* Blocks */}
            {blocks.map(block => (
                <div key={block.id} className="bg-slate-800/50 border border-white/5 rounded-xl overflow-hidden">
                    {/* Block header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{block.icon}</span>
                            <div>
                                <h3 className="text-white font-medium">{block.title}</h3>
                                <p className="text-xs text-slate-500">{block.subtitle}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {block.available && !block.loading && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                                    Listo
                                </span>
                            )}
                            {!block.available && !block.loading && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-400">
                                    Sin datos
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Block content */}
                    <div className="p-4">
                        {block.loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : block.available && block.content ? (
                            <>
                                <div className="bg-slate-900/50 border border-white/10 rounded-lg p-4 mb-3 max-h-80 overflow-y-auto">
                                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{block.content}</pre>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => handleCopy(block.id, block.content)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                                            copiedId === block.id
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-brand text-slate-900 hover:bg-emerald-400'
                                        }`}
                                    >
                                        {copiedId === block.id ? (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                                Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                                                Copiar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="text-slate-500 text-sm py-4 text-center">{unavailableMessages[block.id]}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
