
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fetchOddsFromEdge, findOddsForFixture, fastBatchOddsCheck } from '../services/oddsService'; // We can't import services directly in node usually due to browser deps or path aliases
// But we can recreate the logic to be 100% sure.
// actually, let's use the actual edge function call via supabase.

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// LOGIC REPLICATION FROM oddsService.ts
const normalizeName = (name: string): string => {
    return name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/fc|cf|sc|united|city|town|club|athletic|real|sporting|inter|ac|as/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
};

const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = normalizeName(str1);
    const s2 = normalizeName(str2);
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    const bigrams1 = new Set();
    for (let i = 0; i < s1.length - 1; i++) bigrams1.add(s1.substring(i, i + 2));
    const bigrams2 = new Set();
    for (let i = 0; i < s2.length - 1; i++) bigrams2.add(s2.substring(i, i + 2));
    const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
    const union = new Set([...bigrams1, ...bigrams2]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
};

async function main() {
    console.log("🔍 DEBUGGING ODDS MATCHING for Wolves vs Bournemouth (Jan 31)");

    const FIXTURE = {
        home: "Wolverhampton Wanderers", // Name from API-Football usually
        away: "Bournemouth",
        date: "2026-01-31T15:00:00+00:00" // Approximate
    };

    // 1. Fetch from Edge
    console.log(`\n1. Calling Edge Function 'fetch-odds' for soccer_epl...`);
    const { data: response, error } = await supabase.functions.invoke('fetch-odds', {
        body: { sport: 'soccer_epl', region: 'eu', markets: 'h2h' }
    });

    if (error) {
        console.error("❌ Edge Function Error:", error);
        return;
    }

    const events = response.data;
    console.log(`✅ Received ${events.length} events from The Odds API.`);

    // 2. Find Candidate
    console.log(`\n2. Searching for match: ${FIXTURE.home} vs ${FIXTURE.away} on ${FIXTURE.date}`);

    // FULL LOGIC FROM findOddsForFixture
    const fixtureDate = new Date(FIXTURE.date);

    // Filter Candidates
    const candidates = events.filter((e: any) => {
        const eventDate = new Date(e.commence_time);
        const diffHours = Math.abs(eventDate.getTime() - fixtureDate.getTime()) / 36e5;
        console.log(`   Candidate: ${e.home_team} vs ${e.away_team} (${e.commence_time}) -> Diff: ${diffHours.toFixed(1)}h`);
        return diffHours < 30; // 30h threshold
    });

    console.log(`\n   Found ${candidates.length} time-valid candidates.`);

    let bestMatch = null;
    let highestScore = 0;

    for (const event of candidates) {
        const homeSim = calculateSimilarity(FIXTURE.home, event.home_team);
        const awaySim = calculateSimilarity(FIXTURE.away, event.away_team);
        const totalScore = (homeSim + awaySim) / 2;

        console.log(`   Matching vs [${event.home_team} - ${event.away_team}]: Score ${totalScore.toFixed(2)} (H:${homeSim.toFixed(2)} A:${awaySim.toFixed(2)})`);

        if (totalScore > highestScore) {
            highestScore = totalScore;
            bestMatch = event;
        }
    }

    if (highestScore > 0.6) {
        console.log(`\n✅ MATCH FOUND! Score: ${highestScore}`);
        console.log(`   Event ID: ${bestMatch.id}`);
        console.log(`   Bookmakers: ${bestMatch.bookmakers.length}`);
    } else {
        console.log(`\n❌ NO MATCH FOUND. Highest Score: ${highestScore}`);

        // Check if date was the issue (force check without date)
        console.log("\n--- Forced check (ignoring date) ---");
        const forcedMatch = events.find((e: any) =>
            (normalizeName(e.home_team).includes(normalizeName(FIXTURE.home)) || normalizeName(FIXTURE.home).includes(normalizeName(e.home_team))) &&
            (normalizeName(e.away_team).includes(normalizeName(FIXTURE.away)) || normalizeName(FIXTURE.away).includes(normalizeName(e.away_team)))
        );
        if (forcedMatch) {
            const eventDate = new Date(forcedMatch.commence_time);
            const diffHours = Math.abs(eventDate.getTime() - fixtureDate.getTime()) / 36e5;
            console.log(`Found name match but discarded by time: ${forcedMatch.home_team} vs ${forcedMatch.away_team}`);
            console.log(`Time Diff: ${diffHours.toFixed(1)}h (Threshold is 30h)`);
        }
    }
}

main();
