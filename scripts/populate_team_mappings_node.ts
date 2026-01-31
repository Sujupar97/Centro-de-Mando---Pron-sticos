
// scripts/populate_team_mappings_node.ts
// Node.js version of the mapping script

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { LEAGUE_MAPPING } from '../supabase/functions/_shared/league-mapping.ts' // Make sure this is importable or copy logic
import { areTeamsEqual, normalizeName } from '../supabase/functions/_shared/team-normalization.ts'

dotenv.config()

// Hardcode import if TS path aliasing fails, or just copy the mapping constant here for safety
// Copying LEAGUE_MAPPING to ensure execution without complex TS config
const LOCAl_LEAGUE_MAPPING: Record<number, string> = {
    39: 'soccer_epl',
    140: 'soccer_spain_la_liga',
    135: 'soccer_italy_serie_a',
    78: 'soccer_germany_bundesliga',
    61: 'soccer_france_ligue_one',
    2: 'soccer_uefa_champs_league',
    3: 'soccer_uefa_europa_league',
    848: 'soccer_uefa_conf_league',
    253: 'soccer_usa_mls',
    71: 'soccer_brazil_campeonato',
    128: 'soccer_argentina_primera_division',
    239: 'soccer_colombia_primera_b',
    88: 'soccer_netherlands_eredivisie',
    94: 'soccer_portugal_primeira_liga',
    144: 'soccer_belgium_first_div',
    179: 'soccer_scotland_premiership',
    113: 'soccer_sweden_allsvenskan',
    119: 'soccer_denmark_superliga',
    169: 'soccer_china_superleague',
    307: 'soccer_saudi_pro_league',
};

const ODDS_API_KEY = "527a97a0d2316436a0bacf71c7b93eb5"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FOOTBALL_API_KEY = process.env.API_FOOTBALL_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !FOOTBALL_API_KEY) {
    console.error("❌ Missing .env variables. Make sure .env exists in root.")
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
    const args = process.argv.slice(2)
    const leagueIdArg = args[0]

    if (!leagueIdArg) {
        console.error("❌ Please provide a league_id argument. Example: npx tsx scripts/populate_team_mappings_node.ts 39")
        process.exit(1)
    }

    const LEAGUE_ID = parseInt(leagueIdArg)
    const SPORT_KEY = LOCAl_LEAGUE_MAPPING[LEAGUE_ID]

    if (!SPORT_KEY) {
        console.error(`❌ League ${LEAGUE_ID} is not mapped.`)
        process.exit(1)
    }

    console.log(`\n⚽ STARTING AUTO-MAPPING for League ${LEAGUE_ID} -> ${SPORT_KEY}`)
    console.log(`\n📡 Fetching teams from API Football (Season 2024)...`)

    // API FOOTBALL
    let teamsFootball: any[] = []
    const season = 2025 // Current season for Jan 2026 is 2025/2026

    try {
        const resFb = await fetch(`https://v3.football.api-sports.io/teams?league=${LEAGUE_ID}&season=${season}`, {
            headers: { 'x-apisports-key': FOOTBALL_API_KEY }
        })
        const jsonFb = await resFb.json()

        if (jsonFb.errors && Object.keys(jsonFb.errors).length > 0) {
            console.error("API Football Error Body:", jsonFb.errors)
            // If 2024 fails (e.g. season not started), try 2025 or 2023?
            // For now, fail hard so user knows.
        }

        teamsFootball = (jsonFb.response || []).map((t: any) => ({
            id: t.team.id,
            name: t.team.name,
            normalized: normalizeName(t.team.name)
        }))
    } catch (e) {
        console.error("Fetch Error API Football:", e)
        process.exit(1)
    }

    console.log(`✅ Loaded ${teamsFootball.length} teams from API Football.`)
    if (teamsFootball.length === 0) {
        console.warn("⚠️ No teams found in API Football. Check season or league ID.");
    }

    // ODDS API
    console.log(`\n📡 Fetching active odds from The Odds API...`)
    let teamsOdds: any[] = []
    try {
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`
        const resOdds = await fetch(oddsUrl)
        const jsonOdds = await resOdds.json()

        const oddsTeamsSet = new Set<string>()
        if (Array.isArray(jsonOdds)) {
            jsonOdds.forEach((ev: any) => {
                oddsTeamsSet.add(ev.home_team)
                oddsTeamsSet.add(ev.away_team)
            })
        } // else error usually

        teamsOdds = Array.from(oddsTeamsSet).map(name => ({
            name,
            normalized: normalizeName(name)
        }))
        console.log(`✅ Loaded ${teamsOdds.length} active teams from The Odds API.`)

    } catch (e) {
        console.error("Fetch Error Odds API:", e)
        process.exit(1)
    }

    if (teamsOdds.length === 0) {
        console.warn("⚠️ No active matches found in Odds API. Cannot map teams without active matches.")
        process.exit(0)
    }

    // MATCHING
    console.log(`\n🧩 Matching Teams...`)
    const updates = []
    const matchesFound = []
    const missing = []

    for (const tf of teamsFootball) {
        let match = teamsOdds.find(to => areTeamsEqual(tf.name, to.name))
        if (match) {
            matchesFound.push(`${tf.name}  -->  ${match.name}`)
            updates.push({
                api_football_id: tf.id,
                team_name_api_football: tf.name,
                team_name_odds_api: match.name,
                league_id: LEAGUE_ID,
                is_verified: true,
                confidence_score: 1.0
            })
        } else {
            missing.push(tf.name)
        }
    }

    // UPSERT
    if (updates.length > 0) {
        console.log(`\n💾 Upserting ${updates.length} mappings to Supabase...`)
        const { error } = await supabase
            .from('team_mappings')
            .upsert(updates, { onConflict: 'api_football_id, team_name_odds_api' })

        if (error) console.error("❌ Supabase Error:", error)
        else console.log("✅ Success!")
    }

    console.log(`\n📊 REPORT: Mapped: ${matchesFound.length} | Unmapped: ${missing.length}`)
    if (missing.length > 0) {
        console.log(`\n⚠️ UNMAPPED TEAMS (Sample):`)
        missing.slice(0, 10).forEach(m => console.log(`   - ${m}`))

        console.log(`\n🔍 AVAILABLE ODDS NAMES (for manual matching):`)
        teamsOdds.forEach(t => console.log(`   "${t.name}"`))
    }
}

main()
