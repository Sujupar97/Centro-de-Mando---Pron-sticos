
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv/load.ts";

// MOCK CONSTANTS matching v3-ai-analyzer
const GEMINI_MODEL = 'gemini-3-pro-preview';
const ENGINE_VERSION = 'V4-MASTERMIND';

// Import fetchers from shared (we need to ensure they work in this script context)
// We'll reimplement the fetch logic locally to avoid relativity issues, checking the files.
// actually, let's use the local file paths if running with deno.
// We will mock the heavy lifting to ensure we produce the SAME string.

const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5';
const FIXTURE_ID = 19631548;

// ------------------------------------------------------------------
// 1. REPLICATE FETCH LOGIC (v2-create-job-sportmonks)
// ------------------------------------------------------------------

async function fetchTeamFixtures(teamId: number) {
    // V3 V4 Logic: Order DESC
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('participant_id', teamId.toString());
    url.searchParams.set('per_page', '20');
    url.searchParams.set('order', 'desc'); // CORRECTED SORTING
    url.searchParams.set('include', 'participants;scores;venue;league;statistics;lineups;events;formations');

    const res = await fetch(url.toString());
    const json = await res.json();
    return json.data || [];
}

async function fetchH2H(t1: number, t2: number) {
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${t1}/${t2}`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('include', 'participants;scores');
    const res = await fetch(url.toString());
    const json = await res.json();
    return json.data || [];
}

async function fetchFixture(id: number) {
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures/${id}`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('include', 'participants;lineups;statistics;events;scores;venue;odds.bookmaker');
    const res = await fetch(url.toString());
    const json = await res.json();
    return json.data;
}

// ------------------------------------------------------------------
// 2. REPLICATE NORMALIZATION LOGIC (sportmonks-normalizer.ts)
// ------------------------------------------------------------------
// Simplified for visual output consistency

function formatDeepStats(matches: any[], teamName: string, rootMatch: any) {
    if (!matches || matches.length === 0) return 'Sin datos detallados disponibles.';

    return matches.slice(0, 20).map((m: any, i: number) => {
        const venue = m.participants.find((p: any) => p.id === rootMatch.teams?.home?.id) ? '(LOCAL)' : '(VISITANTE)'; // Approx
        const score = m.scores?.find((s: any) => s.description === 'CURRENT')?.score?.participant === 'home'
            ? `${m.scores[0].score.goals}-${m.scores[1].score.goals}`
            : `${m.scores[0]?.score?.goals || 0}-${m.scores[1]?.score?.goals || 0}`; // Dirty score parsing for prompt dump

        // Try to find details 
        const stats = m.statistics || [];
        const poss = stats.find((s: any) => s.type?.name === 'Possession')?.value || '?';
        const shots = stats.find((s: any) => s.type?.name === 'Total Shots')?.value || '?';

        const details = `\n   > Formación: ${m.formations?.[0]?.formation || '?'} \n   > Stats: ${poss}% Posesión | ${shots} Tiros`;

        return `${i + 1}. ${m.starting_at} ${venue} vs ${m.name}: ${score} ${details}`;
    }).join('\n');
}

// ------------------------------------------------------------------
// 3. MAIN BUILDER
// ------------------------------------------------------------------

async function generatePrompt() {
    console.log("Fetching Data...");
    const match = await fetchFixture(FIXTURE_ID);
    if (!match) throw new Error("Match not found");

    const homeId = match.participants.find((p: any) => p.meta.location === 'home').id;
    const awayId = match.participants.find((p: any) => p.meta.location === 'away').id;
    const homeName = match.participants.find((p: any) => p.meta.location === 'home').name;
    const awayName = match.participants.find((p: any) => p.meta.location === 'away').name;
    const leagueName = match.league?.name || "League";

    console.log(`Teams: ${homeName} vs ${awayName}`);

    const [homeHist, awayHist, h2h] = await Promise.all([
        fetchTeamFixtures(homeId),
        fetchTeamFixtures(awayId),
        fetchH2H(homeId, awayId)
    ]);

    console.log(`History Loaded: ${homeHist.length} home, ${awayHist.length} away`);

    // --- RECONSTRUCT PROMPT STRING (From v3-ai-analyzer) ---
    const deepHome = formatDeepStats(homeHist, homeName, match);
    const deepAway = formatDeepStats(awayHist, awayName, match);

    // Odds Text
    let oddsText = 'SIN CUOTAS VIVAS (USAR FALLBACK)';
    const odds = match.odds?.find((o: any) => o.name?.includes("365")) || match.odds?.[0]; // Approx
    if (odds) oddsText = JSON.stringify(odds, null, 2);

    const prompt = `
════════════════════════════════════════════════════════════════════════════════
🧠 SISTEMA DERBIX V4 [MASTERMIND EDITION] - MOTOR DE ANÁLISIS DE ÉLITE
Modelo: ${GEMINI_MODEL}
Fecha Sistema: 2026
════════════════════════════════════════════════════════════════════════════════

ERES LA MENTE MAESTRA DE DERBIX.
No eres un simple asistente. Eres un estratega deportivo de clase mundial...
( ... Standard Instructions from v3 ... )

════════════════════════════════════════════════════════════════════════════════
DATOS DEL PARTIDO (DEEP DIVE INPUT)
════════════════════════════════════════════════════════════════════════════════

PARTIDO: ${homeName} vs ${awayName}
COMPETICIÓN: ${leagueName}

>>> HISTORIAL ULTIMOS 20 PARTIDOS (DETALLADO) - ${homeName}:
${deepHome}

>>> HISTORIAL ULTIMOS 20 PARTIDOS (DETALLADO) - ${awayName}:
${deepAway}

>>> ENFRENTAMIENTOS DIRECTOS (H2H):
${h2h.map((m: any) => `${m.starting_at}: ${m.name}`).join('\n')}

>>> CUOTAS DE MERCADO (Referencia):
${oddsText}

════════════════════════════════════════════════════════════════════════════════
FORMATO DE SALIDA (JSON)
... (The Explicit Schema I added) ...
`;

    // Write to file
    const outputPath = 'full_prompt_dump.txt';
    await Deno.writeTextFile(outputPath, prompt);
    console.log(`\n✅ Prompt reconstructed and saved to ${outputPath}`);
}

generatePrompt();
