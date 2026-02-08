
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

// POLYFILLS for Node.js if needed (Node 18+ has fetch built-in)
if (!global.fetch) {
    throw new Error("Node.js 18+ required for fetch support.");
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_TOKEN = process.env.SPORTMONKS_API_TOKEN; // Need this from somewhere, usually .env

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials in environment.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const FIXTURE_ID = 19631548; // Man City vs Newcastle

// Mocking SportMonks Client logic roughly to verify data availability
async function fetchSportMonksData() {
    if (!API_TOKEN) {
        console.warn("⚠️ No SPORTMONKS_API_TOKEN found in process.env. Skipping direct API check.");
        return null;
    }
    const url = `https://api.sportmonks.com/v3/football/fixtures/${FIXTURE_ID}?api_token=${API_TOKEN}&include=participants;scores;statistics;lineups;events;odds.bookmaker`;

    console.log(`[1] Fetching raw data from SportMonks: ${url.replace(API_TOKEN, '***')}`);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        const json = await res.json();
        return json.data;
    } catch (e) {
        console.error("Failed to fetch SportMonks data:", e);
        return null;
    }
}

async function runAudit() {
    console.log(`\n🕵️‍♂️ STARTING V5 DEEP AUDIT for Fixture ${FIXTURE_ID} (Node.js Mode)...\n`);

    // 1. Check DB for existing report
    console.log(`[1] Checking 'reports_v2' DB...`);
    const { data: report, error } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('fixture_id', FIXTURE_ID)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error("DB Error:", error);
    }

    if (report) {
        console.log(`✅ REPORT FOUND (Job: ${report.job_id})`);
        console.log(`   - Created: ${report.created_at}`);
        console.log(`   - Prompt Version: ${report.prompt_version}`);

        const packet = report.report_packet;
        if (!packet) {
            console.error("❌ 'report_packet' is NULL!");
        } else {
            console.log(`\n[2] INSPECTING SAVED CONTENT:`);
            console.log(`   - Headline: "${packet.resumen_ejecutivo?.titular || 'UNDEFINED'}"`);
            console.log(`   - Verdict: "${packet.resumen_ejecutivo?.veredicto || 'UNDEFINED'}"`);

            const picks = packet.pronosticos || [];
            console.log(`   - Picks Found: ${picks.length}`);
            if (picks.length === 0) {
                console.warn(`⚠️ ZERO PICKS CONFIRMED. The AI returned an empty array.`);
            } else {
                picks.forEach((p: any, i: number) => {
                    console.log(`     ${i + 1}. ${p.mercado}: ${p.seleccion} (${p.probabilidad_calculada_porcentaje}%)`);
                });
            }

            console.log(`   - Detailed Analysis:`);
            console.log(`     - Context: ${packet.analisis_profundo?.contexto_competitivo ? 'YES' : 'NO'}`);
            console.log(`     - Tactics: ${packet.analisis_profundo?.matchup_tactico ? 'YES' : 'NO'}`);

            if (packet.analisis_profundo?.contexto_competitivo) {
                console.log(`     - Context Preview: ${JSON.stringify(packet.analisis_profundo.contexto_competitivo).substring(0, 100)}...`);
            }
        }
    } else {
        console.log(`❌ No report found in DB.`);
    }

    // 2. Fetch API Data (if token available)
    const fixtureData = await fetchSportMonksData();
    if (fixtureData) {
        console.log(`\n[3] RAW DATA AUDIT:`);
        console.log(`   - Stats entries: ${fixtureData.statistics?.length || 0}`);
        console.log(`   - Lineups: ${fixtureData.lineups?.length > 0 ? 'YES' : 'NO'}`);
        console.log(`   - Formations: ${fixtureData.formations?.length > 0 ? 'YES' : 'NO'}`);

        if (fixtureData.statistics?.length === 0) {
            console.warn(`⚠️ The SportMonks API has NO STATISTICS for this fixture yet.`);
            console.warn(`   This implies the match hasn't started or IDs are wrong.`);
        }
    } else {
        console.log(`Skipped API check (no token).`);
    }

    console.log(`\n🏁 AUDIT COMPLETE.`);
}

runAudit();
