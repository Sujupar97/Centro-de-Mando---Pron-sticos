// supabase/functions/v2-generate-parlays/index.ts
// SMART PARLAYS ENGINE V4: AI META-ANALYST (GEMINI PRO)
// Trigger: Manual (botón) o Automático
// Description: Agente de IA que busca "Correlaciones Estratégicas" entre picks de alta confianza.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

const MODEL_NAME = 'gemini-1.5-pro-latest'; // Capacidad de razonamiento compleja superior
const ENGINE_VERSION = '4.0.0-AI-CORRELATION';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    const startTime = Date.now();

    try {
        const logs: string[] = [];
        const log = (msg: string) => { console.log(msg); logs.push(msg); };

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const geminiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiKey) throw new Error('Missing GEMINI_API_KEY');
        const supabase = createClient(sbUrl, sbKey);

        const { date, force_regenerate } = await req.json();
        if (!date) throw new Error('date is required (YYYY-MM-DD)');

        log(`[META-ANALYST] Starting analysis for date: ${date}`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 1: RECOLECTAR "INTELIGENCIA" (CRUCE DE DATOS)
        // ═══════════════════════════════════════════════════════════════

        // ... (skipping unchanged parts) ...

        // ═══════════════════════════════════════════════════════════════
        // PASO 2: LA LLAMADA AL META-ANALISTA (GEMINI)
        // ═══════════════════════════════════════════════════════════════

        // ... (skipping prompt definition) ...

        log(`Sending prompt to Gemini (${prompt.length} chars)...`);

        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiKey}`;
        const aiResp = await fetch(genUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!aiResp.ok) throw new Error(`Gemini API Error: ${aiResp.statusText}`);

        const aiResult = await aiResp.json();
        const aiText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiText) throw new Error('Empty response from AI Agent');

        // ROBUST JSON PARSING (Fix for 500 Errors)
        let metaAnalysis;
        try {
            const cleanText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            metaAnalysis = JSON.parse(cleanText);
        } catch (parseError) {
            console.error('JSON Parse failed. Raw text:', aiText);
            throw new Error('AI returned invalid JSON. Check logs.');
        }

        log(`AI Generated ${metaAnalysis.parlays?.length || 0} parlays.`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 3: PERSISTENCIA Y FORMATEO
        // ═══════════════════════════════════════════════════════════════

        // Limpiar anteriores
        await supabase.from('smart_parlays_v2').delete().eq('date', date);

        const parlaysToInsert = [];

        for (const p of metaAnalysis.parlays || []) {
            // Reconstruir objetos completos
            const pick1 = candidates.find(c => c?.id === p.picks_ids[0]);
            const pick2 = candidates.find(c => c?.id === p.picks_ids[1]);

            if (!pick1 || !pick2) continue;

            const combinedProb = (parseFloat(pick1.prob) + parseFloat(pick2.prob)) / 200; // Average numeric
            const impliedOdds = (pick1.odds * pick2.odds).toFixed(2);

            parlaysToInsert.push({
                date,
                name: p.nombre_estrategia || "Smart Parlay IA",
                description: p.tesis_meta_analisis, // New field for the meta-thesis
                picks: [
                    {
                        fixture_id: pick1.fixture_id,
                        market: pick1.pick, // Simplified for display
                        selection: pick1.pick.split('-')[1]?.trim() || pick1.pick,
                        p_model: parseFloat(pick1.prob) / 100,
                        home_team: pick1.home_team,
                        away_team: pick1.away_team,
                        league: pick1.league,
                        odds: pick1.odds
                    },
                    {
                        fixture_id: pick2.fixture_id,
                        market: pick2.pick,
                        selection: pick2.pick.split('-')[1]?.trim() || pick2.pick,
                        p_model: parseFloat(pick2.prob) / 100,
                        home_team: pick2.home_team,
                        away_team: pick2.away_team,
                        league: pick2.league,
                        odds: pick2.odds
                    }
                ],
                combined_probability: combinedProb,
                implied_odds: parseFloat(impliedOdds),
                pick_count: 2,
                confidence_tier: combinedProb > 0.85 ? 'ultra_safe' : 'safe',
                status: 'active'
            });
        }

        if (parlaysToInsert.length > 0) {
            await supabase.from('smart_parlays_v2').insert(parlaysToInsert);
        }

        // Fallback Singles
        const usedIds = new Set(metaAnalysis.parlays?.flatMap((x: any) => x.picks_ids));
        const singles = candidates
            .filter(c => !usedIds.has(c?.id))
            .filter(c => c?.odds >= 1.50) // High Value singles only
            .slice(0, 6)
            .map(c => ({
                id: c?.id,
                fixture_id: c?.fixture_id,
                job_id: c?.job_id,
                market: c?.pick, // simplified
                selection: c?.pick,
                p_model: parseFloat(c?.prob || '0') / 100,
                home_team: c?.home_team,
                away_team: c?.away_team,
                league: c?.league,
                odds: c?.odds
            }));

        const executionTime = Date.now() - startTime;

        return new Response(JSON.stringify({
            success: true,
            date,
            stats: { generated: parlaysToInsert.length },
            parlays: parlaysToInsert,
            singles: singles,
            debug_logs: logs,
            execution_time_ms: executionTime
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[META-ANALYST] Error:', e);
        // Returning 200 instead of 500 to allow the frontend to parse the "error" field
        // and display it to the user instead of a generic "FunctionsHttpError".
        return new Response(JSON.stringify({
            success: false,
            error: e.message || "Unknown error",
            parlays: [], // Return empty array so map() doesn't fail on frontend
            singles: [],
            debug_logs: [e.message]
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
