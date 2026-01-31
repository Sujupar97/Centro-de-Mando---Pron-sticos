
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { normalizeName, areTeamsEqual } from '../supabase/functions/_shared/team-normalization';

// Load env
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseKey && !supabaseServiceKey)) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey!);

const ODDS_API_KEY = "527a97a0d2316436a0bacf71c7b93eb5";
const ODDS_API_URL = "https://api.the-odds-api.com/v4/sports";

const LEAGUES = [
    { id: 39, key: 'soccer_epl', name: 'Premier League' },
    { id: 140, key: 'soccer_spain_la_liga', name: 'La Liga' },
    { id: 135, key: 'soccer_italy_serie_a', name: 'Serie A' },
    { id: 78, key: 'soccer_germany_bundesliga', name: 'Bundesliga' },
    { id: 61, key: 'soccer_france_ligue_one', name: 'Ligue 1' },
    { id: 2, key: 'soccer_uefa_champions_league', name: 'Champions League' },
    { id: 128, key: 'soccer_argentina_primera_division', name: 'Liga Profesional Argentina' }
];

async function fetchOddsTeams(sportKey: string) {
    try {
        const url = `${ODDS_API_URL}/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Failed to fetch odds for ${sportKey}: ${res.statusText}`);
            return [];
        }
        const data = await res.json();
        const teams = new Set<string>();
        data.forEach((match: any) => {
            teams.add(match.home_team);
            teams.add(match.away_team);
        });
        return Array.from(teams);
    } catch (e) {
        console.error(`Error fetching odds for ${sportKey}:`, e);
        return [];
    }
}

async function fetchAppTeams(leagueId: number) {
    // Look at past 30 days and future 14 days to catch all teams
    const nextWeek = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const pastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: matches, error } = await supabase
        .from('daily_matches')
        .select('home_team, away_team, api_fixture_id')
        .eq('league_id', leagueId)
        .gte('match_date', pastMonth)
        .lt('match_date', nextWeek);

    if (error) {
        console.error(`Error fetching from daily_matches for league ${leagueId}:`, error.message);
        return [];
    }

    // We only have names here, no IDs.
    // However, team_mappings requires 'api_football_id'.
    // WITHOUT IDs, we cannot insert into team_mappings correctly if the column is NOT NULL.
    // The migration said: api_football_id INTEGER NOT NULL.

    // WORKAROUND: Query 'fixtures' table for IDs if possible, OR
    // Query 'analysis_jobs' -> report payload? Too slow.
    // Fetch from API-Football?

    // Let's try to fetch a map of TeamName -> TeamID from 'daily_match_scanner' logs or similar?
    // No.

    // Let's assume we can fetch from 'fixtures' table but using the JSONB column 'teams'.
    // Previous error was "column fixtures.home_team does not exist".
    // This implies the table 'fixtures' exists but the column is different.
    // Let's try querying 'teams' column (JSONB).

    const { data: fixtures, error: fixError } = await supabase
        .from('fixtures')
        .select('teams')
        .eq('league_id', leagueId)
        .gte('date', pastMonth)
        .limit(100);

    if (!fixError && fixtures && fixtures.length > 0) {
        console.log(`Using 'fixtures' table with JSONB column for League ${leagueId}`);
        const appTeams = new Map<number, string>();
        fixtures.forEach((f: any) => {
            if (f.teams?.home?.id) appTeams.set(f.teams.home.id, f.teams.home.name);
            if (f.teams?.away?.id) appTeams.set(f.teams.away.id, f.teams.away.name);
        });
        return Array.from(appTeams.entries()).map(([id, name]) => ({ id, name }));
    }

    if (fixError) {
        console.log(`Fixtures table access failed: ${fixError.message}`);
    }

    // Fallback: If we only have daily_matches (text), we can't insert ID.
    // We will just log the matches found for now, but skipping insert.
    console.log("⚠️ Could not retrieve Team IDs. Skipping insert for this league.");
    return [];
}

async function seedMappings() {
    console.log("🌱 STARTING TEAM MAPPING SEEDING...");

    for (const league of LEAGUES) {
        console.log(`\nProcessing ${league.name} (${league.key})...`);

        const oddsTeams = await fetchOddsTeams(league.key);
        console.log(`Found ${oddsTeams.length} unique teams in Odds API.`);

        const appTeams = await fetchAppTeams(league.id);
        console.log(`Found ${appTeams.length} unique teams in App.`);

        if (oddsTeams.length === 0 || appTeams.length === 0) continue;

        let mappedCount = 0;

        for (const appTeam of appTeams) {
            const { data: existing } = await supabase
                .from('team_mappings')
                .select('id')
                .eq('api_football_id', appTeam.id)
                .single();

            if (existing) continue;

            let bestMatch: string | null = null;
            const normApp = normalizeName(appTeam.name);

            for (const oddsTeam of oddsTeams) {
                if (oddsTeam === appTeam.name) { bestMatch = oddsTeam; break; }
                if (normalizeName(oddsTeam) === normApp) { bestMatch = oddsTeam; break; }
                if (areTeamsEqual(appTeam.name, oddsTeam)) { bestMatch = oddsTeam; break; }
            }

            if (bestMatch) {
                console.log(`✅ MATCH: ${appTeam.name} -> ${bestMatch}`);
                const { error: insertError } = await supabase
                    .from('team_mappings')
                    .insert({
                        api_football_id: appTeam.id,
                        team_name_api_football: appTeam.name,
                        team_name_odds_api: bestMatch,
                        league_id: league.id,
                        is_verified: false
                    });
                if (insertError) console.error(`Failed to insert: ${insertError.message}`);
                else mappedCount++;
            }
        }
        console.log(`Saved ${mappedCount} new mappings.`);
    }
    console.log("\n🌱 SEEDING COMPLETE.");
}

seedMappings();
