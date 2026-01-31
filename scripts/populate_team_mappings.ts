
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { load } from 'https://deno.land/std@0.168.0/dotenv/mod.ts'
import { LEAGUE_MAPPING } from '../supabase/functions/_shared/league-mapping.ts'
import { areTeamsEqual, normalizeName } from '../supabase/functions/_shared/team-normalization.ts'

const env = await load()

// CONFIG
const SUPABASE_URL = env['SUPABASE_URL'] || Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const FOOTBALL_API_KEY = env['API_FOOTBALL_KEY'] || Deno.env.get('API_FOOTBALL_KEY')
const ODDS_API_KEY = "527a97a0d2316436a0bacf71c7b93eb5" // Hardcoded as per discovery, ideally env

if (!SUPABASE_URL || !SUPABASE_KEY || !FOOTBALL_API_KEY) {
    console.error("❌ Missing .env variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or API_FOOTBALL_KEY")
    Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
    const args = Deno.args
    const leagueIdArg = args[0]

    if (!leagueIdArg) {
        console.error("❌ Please provide a league_id argument. Example: deno run -A scripts/populate_team_mappings.ts 39")
        Deno.exit(1)
    }

    const LEAGUE_ID = parseInt(leagueIdArg)
    const SPORT_KEY = LEAGUE_MAPPING[LEAGUE_ID]

    if (!SPORT_KEY) {
        console.error(`❌ League ${LEAGUE_ID} is not mapped in league-mapping.ts`)
        Deno.exit(1)
    }

    console.log(`\n⚽ STARTING AUTO-MAPPING for League ${LEAGUE_ID} -> ${SPORT_KEY}`)

    // 1. Fetch API Football Teams
    console.log(`\n📡 Fetching teams from API Football (Season 2024/2025/Current)...`)
    let teamsFootball = []
    // Try current season then previous if fails or empty? No, just try '2024' or assume current.
    // Better: Get current season for league first? For simplicity, we use 2024.
    const season = 2024

    const resFb = await fetch(`https://v3.football.api-sports.io/teams?league=${LEAGUE_ID}&season=${season}`, {
        headers: { 'x-apisports-key': FOOTBALL_API_KEY }
    })

    if (!resFb.ok) {
        console.error("API Football Error:", resFb.statusText)
        Deno.exit(1)
    }

    const jsonFb = await resFb.json()
    teamsFootball = jsonFb.response.map((t: any) => ({
        id: t.team.id,
        name: t.team.name,
        code: t.team.code,
        normalized: normalizeName(t.team.name)
    }))

    console.log(`✅ Loaded ${teamsFootball.length} teams from API Football.`)

    // 2. Fetch Odds API Teams (via Odds Endpoint)
    console.log(`\n📡 Fetching active odds from The Odds API...`)
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h`
    const resOdds = await fetch(oddsUrl)

    if (!resOdds.ok) {
        console.error("Odds API Error:", resOdds.statusText)
        Deno.exit(1)
    }

    const jsonOdds = await resOdds.json()
    // Extract unique team names
    const oddsTeamsSet = new Set<string>()
    jsonOdds.forEach((ev: any) => {
        oddsTeamsSet.add(ev.home_team)
        oddsTeamsSet.add(ev.away_team)
    })

    const teamsOdds = Array.from(oddsTeamsSet).map(name => ({
        name,
        normalized: normalizeName(name)
    }))

    console.log(`✅ Loaded ${teamsOdds.length} active teams from The Odds API (from ${jsonOdds.length} matches).`)

    if (teamsOdds.length === 0) {
        console.warn("⚠️ No active matches found in Odds API. Cannot map teams without active matches. Try again when matches are scheduled.")
        Deno.exit(0)
    }

    // 3. Matching Process
    console.log(`\n🧩 Matching Teams...`)

    const updates = []
    const matchesFound = []
    const missing = []

    for (const tf of teamsFootball) {
        // Find best match
        let match = teamsOdds.find(to => areTeamsEqual(tf.name, to.name))

        if (match) {
            matchesFound.push(`${tf.name}  -->  ${match.name}`)
            updates.push({
                api_football_id: tf.id,
                team_name_api_football: tf.name,
                team_name_odds_api: match.name,
                league_id: LEAGUE_ID,
                is_verified: true,
                confidence_score: 1.0 // Script generated
            })
        } else {
            missing.push(tf.name)
        }
    }

    // 4. Upsert to Supabase
    if (updates.length > 0) {
        console.log(`\n💾 Upserting ${updates.length} mappings to Supabase...`)

        const { error } = await supabase
            .from('team_mappings')
            .upsert(updates, { onConflict: 'api_football_id, team_name_odds_api' })

        if (error) {
            console.error("❌ Supabase Error:", error)
        } else {
            console.log("✅ Success!")
        }
    }

    // 5. Report
    console.log(`\n📊 REPORT:`)
    console.log(`   Mapped: ${matchesFound.length}`)
    console.log(`   Unmapped: ${missing.length}`)

    if (missing.length > 0) {
        console.log(`\n⚠️ UNMAPPED TEAMS (Could not find in current Odds API list):`)
        missing.forEach(m => console.log(`   - ${m}`))
        console.log(`\n💡 Note: Unmapped teams might not have active matches today.`)
    }
}

main()
