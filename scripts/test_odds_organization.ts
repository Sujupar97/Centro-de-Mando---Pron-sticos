
// scripts/test_odds_organization.ts
import { organizeOddsForAI } from '../supabase/functions/_shared/sportmonks-normalizer.ts';

// Mock Raw Odds based on the audit findings
const mockOdds = [
    {
        market_id: 2, // Double Chance (approx context)
        label: "Fortuna Dusseldorf or Draw",
        value: "1.53",
        bookmaker_id: 2
    },
    {
        market_id: 6, // Team To Score (approx) OR could be "Away Team Score"
        label: "Away",
        value: "1.28",
        bookmaker_id: 16
    },
    {
        market_id: 12, // Over/Under 2.5
        label: "Over 2.5",
        value: "1.60",
        bookmaker_id: 1
    },
    {
        market_id: 1, // 1x2
        label: "Home",
        value: "2.10",
        bookmaker_id: 1
    }
];

console.log("Testing organizeOddsForAI with mock data...");
const organized = organizeOddsForAI(mockOdds);

console.log(JSON.stringify(organized, null, 2));

// Validation Logic
const dc = organized.MAIN.find((o: any) => o.val === "1.53");
const teamScore = organized.TEAMS.find((o: any) => o.val === "1.28");

if (dc && dc.canon.includes('dc_')) {
    console.log("PASS: 1.53 classified as MAIN / Double Chance");
} else {
    console.error("FAIL: 1.53 classification issue", dc);
}

if (teamScore && teamScore.canon.includes('away_team_score_yes')) {
    console.log("PASS: 1.28 classified as TEAMS / Away Score");
} else if (teamScore) {
    console.log("WARN: 1.28 classified as TEAMS but canonical ID might be generic", teamScore.canon);
} else {
    console.error("FAIL: 1.28 classification issue", teamScore);
}
