// services/smartParlayService.ts
// Servicio para gestionar Smart Parlays (combinaciones multi-partido)

import { supabase } from './supabaseService';

export interface SmartParlayPick {
    fixture_id: number;
    market: string;
    selection: string;
    p_model: number;
    home_team: string;
    away_team: string;
    league: string;
}

export interface SmartParlay {
    id: string;
    date: string;
    name: string;
    picks: SmartParlayPick[];
    combined_probability: number;
    implied_odds: number;
    pick_count: number;
    confidence_tier: 'ultra_safe' | 'safe' | 'balanced';
    status: 'pending' | 'won' | 'lost' | 'partial' | 'void';
    created_at: string;
}

export interface GenerateParlaysResult {
    success: boolean;
    date?: string;
    stats?: {
        jobs_found: number;
        picks_found: number;
        picks_enriched: number;
        parlays_2_picks: number;
        parlays_3_picks: number;
        total_generated: number;
    };
    parlays?: SmartParlay[];
    message?: string;
    error?: string;
}

/**
 * Genera Smart Parlays para una fecha específica
 * @param date Fecha en formato YYYY-MM-DD
 */
export async function generateSmartParlays(date: string): Promise<GenerateParlaysResult> {
    try {
        console.log(`[SmartParlays] Generating for date: ${date}`);

        const { data, error } = await supabase.functions.invoke('v2-generate-parlays', {
            body: { date }
        });

        if (error) {
            console.error('[SmartParlays] Function error:', error);
            throw new Error(error.message);
        }

        console.log('[SmartParlays] Result:', data);
        return data as GenerateParlaysResult;

    } catch (e: any) {
        console.error('[SmartParlays] Error:', e);
        return {
            success: false,
            error: e.message
        };
    }
}

/**
 * Obtiene los Smart Parlays almacenados para una fecha
 * @param date Fecha en formato YYYY-MM-DD
 */
export async function getSmartParlays(date: string): Promise<SmartParlay[]> {
    try {
        const { data, error } = await supabase
            .from('smart_parlays_v2')
            .select('*')
            .eq('date', date)
            .order('combined_probability', { ascending: false });

        if (error) {
            console.error('[SmartParlays] Fetch error:', error);
            return [];
        }

        return (data || []) as SmartParlay[];

    } catch (e) {
        console.error('[SmartParlays] Error fetching:', e);
        return [];
    }
}

/**
 * Actualiza el estado de un parlay (para verificación de resultados)
 * @param parlayId ID del parlay
 * @param status Nuevo estado
 */
export async function updateParlayStatus(
    parlayId: string,
    status: 'won' | 'lost' | 'partial' | 'void'
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('smart_parlays_v2')
            .update({
                status,
                verified_at: new Date().toISOString()
            })
            .eq('id', parlayId);

        if (error) {
            console.error('[SmartParlays] Update error:', error);
            return false;
        }

        return true;

    } catch (e) {
        console.error('[SmartParlays] Error updating:', e);
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
    };

    return translations[market] || market.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Obtiene el color del badge según el tier de confianza
 */
export function getConfidenceColor(tier: string): string {
    switch (tier) {
        case 'ultra_safe': return 'from-emerald-500 to-green-600';
        case 'safe': return 'from-blue-500 to-cyan-600';
        case 'balanced': return 'from-amber-500 to-orange-600';
        default: return 'from-gray-500 to-gray-600';
    }
}

/**
 * Obtiene el label del tier de confianza
 */
export function getConfidenceLabel(tier: string): string {
    switch (tier) {
        case 'ultra_safe': return 'Ultra Seguro';
        case 'safe': return 'Seguro';
        case 'balanced': return 'Equilibrado';
        default: return tier;
    }
}
