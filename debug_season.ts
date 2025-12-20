
// debug_season.ts
// Run with: deno run --allow-net --allow-env debug_season.ts

const API_KEY = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyDg85u-LTuSTKby1sq_FFj_v-XpbiaikLg'; // Using the known active key for football test if needed? 
// Wait, football API key is in API_FOOTBALL_KEYS. Need to read .env or hardcode for test.
// I'll grab it from .env logic if possible, or just expect it.

const FOOTBALL_API_KEY = Deno.env.get('API_FOOTBALL_KEYS')?.split(',')[0];

console.log("Testing API with key:", FOOTBALL_API_KEY ? "Found" : "Missing");

async function checkLeague(id: number, name: string) {
    console.log(`\n--- Checking League: ${name} (ID: ${id}) ---`);

    // 1. Get Current
    try {
        const res = await fetch(`https://v3.football.api-sports.io/leagues?id=${id}&current=true`, {
            headers: { 'x-apisports-key': '075191f630800b3e6423c4578b73360b' } // Hardcoded fallback for immediate debug, or use env
        });
        const json = await res.json();
        console.log("Current=true Response:", JSON.stringify(json.response, null, 2));
    } catch (e) { console.error(e); }

    // 2. Get All Seasons (last 3)
    try {
        const res = await fetch(`https://v3.football.api-sports.io/leagues?id=${id}`, {
            headers: { 'x-apisports-key': '075191f630800b3e6423c4578b73360b' }
        });
        const json = await res.json();
        const seasons = json.response?.[0]?.seasons || [];
        console.log("Last 3 seasons:", JSON.stringify(seasons.slice(-3), null, 2));
    } catch (e) { console.error(e); }
}

// IDs based on API-Football docs common IDs or context:
// 144 = Jupiler Pro League (Belgium)? 
// 239 = Copa Division Profesional (Bolivia)? (From screenshot potentially)

// Let's test a few.
await checkLeague(144, "Jupiler Pro League (Belgium)");
await checkLeague(39, "Premier League");
