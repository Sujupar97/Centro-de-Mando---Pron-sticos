// services/smartParlayService.ts
// Servicio para gestionar Parlays (combinaciones multi-partido desde parlay_combos_v2)

import { supabase } from './supabaseService';

export interface ParlayPick {
    fixture_id: number;
    market: string;
    selection: string;
    odds: number;
    p_model: number;
    home_team: string;
    away_team: string;
    league: string;
    reasoning?: string;
}

export interface ParlayCombo {
    id: string;
    date: string;
    picks: ParlayPick[];
    combined_odds: number;
    combined_probability: number;
    pick_count: number;
    risk_tier: 'conservative' | 'balanced' | 'aggressive';
    status: 'pending' | 'won' | 'lost' | 'partial' | 'void';
    generated_at: string;
}

export interface GenerateParlaysResult {
    success: boolean;
    date?: string;
    stats?: {
        total_picks: number;
        fixtures_with_picks: number;
        combinations_evaluated: number;
        combos_saved: number;
    };
    combos?: ParlayCombo[];
    message?: string;
    error?: string;
}

/**
 * Genera combinaciones de parlays para una fecha
 * Llama a v3-generate-parlay-combos (lógica combinatoria, no Gemini)
 */
export async function generateSmartParlays(date: string): Promise<GenerateParlaysResult> {
    try {
        console.log(`[Parlays] Generating combos for date: ${date}`);

        const { data, error } = await supabase.functions.invoke('v3-generate-parlay-combos', {
            body: { date }
        });

        if (error) {
            console.error('[Parlays] Function error:', error);
            throw new Error(error.message);
        }

        console.log('[Parlays] Result:', data);
        return data as GenerateParlaysResult;

    } catch (e: any) {
        console.error('[Parlays] Error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Obtiene los parlays almacenados para una fecha desde parlay_combos_v2
 */
export async function getSmartParlays(date: string): Promise<ParlayCombo[]> {
    try {
        const { data, error } = await supabase
            .from('parlay_combos_v2')
            .select('*')
            .eq('date', date)
            .order('combined_odds', { ascending: false });

        if (error) {
            console.error('[Parlays] Fetch error:', error);
            return [];
        }

        return (data || []) as ParlayCombo[];

    } catch (e) {
        console.error('[Parlays] Error fetching:', e);
        return [];
    }
}

/**
 * Actualiza el estado de un parlay combo
 */
export async function updateParlayStatus(
    parlayId: string,
    status: 'won' | 'lost' | 'partial' | 'void'
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('parlay_combos_v2')
            .update({
                status,
                verified_at: new Date().toISOString()
            })
            .eq('id', parlayId);

        if (error) {
            console.error('[Parlays] Update error:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('[Parlays] Error updating:', e);
        return false;
    }
}

/**
 * Traduce el nombre del mercado al español
 */
export function translateMarket(market: string): string {
    const translations: Record<string, string> = {
        'over_0.5_goals': 'Más de 0.5 Goles',
        'over_1.5_goals': 'Más de 1.5 Goles',
        'over_2.5_goals': 'Más de 2.5 Goles',
        'over_3.5_goals': 'Más de 3.5 Goles',
        'under_0.5_goals': 'Menos de 0.5 Goles',
        'under_1.5_goals': 'Menos de 1.5 Goles',
        'under_2.5_goals': 'Menos de 2.5 Goles',
        'under_3.5_goals': 'Menos de 3.5 Goles',
        'btts_yes': 'Ambos Anotan: Sí',
        'btts_no': 'Ambos Anotan: No',
        'home_win': 'Victoria Local',
        'away_win': 'Victoria Visitante',
        'draw': 'Empate',
        'double_chance_1x': 'Doble Oportunidad 1X',
        'double_chance_x2': 'Doble Oportunidad X2',
        'double_chance_12': 'Doble Oportunidad 12',
        'home_over_0.5': 'Local +0.5 Goles',
        'home_over_1.5': 'Local +1.5 Goles',
        'away_over_0.5': 'Visitante +0.5 Goles',
        'away_over_1.5': 'Visitante +1.5 Goles',
        '1t_over_0.5': '1T Más de 0.5',
        '1t_over_1.5': '1T Más de 1.5',
        '2t_over_0.5': '2T Más de 0.5',
        '2t_over_1.5': '2T Más de 1.5',
        'handicap_home': 'Hándicap Local',
        'handicap_away': 'Hándicap Visitante',
        'corners_over': 'Córners +',
        'corners_under': 'Córners -',
        'cards_over': 'Tarjetas +',
        'cards_under': 'Tarjetas -',
    };

    return translations[market] || market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Obtiene el color según el risk tier
 */
export function getRiskColor(tier: string): string {
    switch (tier) {
        case 'conservative': return 'from-emerald-500 to-green-600';
        case 'balanced': return 'from-amber-500 to-orange-600';
        case 'aggressive': return 'from-red-500 to-rose-600';
        default: return 'from-gray-500 to-gray-600';
    }
}

/**
 * Obtiene el label del risk tier
 */
export function getRiskLabel(tier: string): string {
    switch (tier) {
        case 'conservative': return 'Conservador';
        case 'balanced': return 'Equilibrado';
        case 'aggressive': return 'Agresivo';
        default: return tier;
    }
}

// Keep old names as aliases for backwards compatibility with SmartParlays component
export type SmartParlay = ParlayCombo;
export type SmartParlayPick = ParlayPick;
export const getConfidenceColor = getRiskColor;
export const getConfidenceLabel = getRiskLabel;
