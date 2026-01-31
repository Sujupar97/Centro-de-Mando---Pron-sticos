
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const API_KEY = process.env.API_FOOTBALL_KEY
const LEAGUE_ID = 39 // EPL
const SEASON = 2025 // 25/26

async function findFixture() {
    // Buscar partidos de la próxima semana o recientes
    // Hoy es 27 Enero 2026.
    // Busquemos los de fin de mes, ej. 31 Enero.
    const date = '2026-01-31'
    console.log(`Searching fixtures for ${date}...`)

    const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=${LEAGUE_ID}&season=${SEASON}&date=${date}`, {
        headers: {
            'x-apisports-key': API_KEY!
        }
    })

    const json = await res.json()
    if (!json.response || json.response.length === 0) {
        console.log("No matches found on this date. Trying wider range...")
        // Try 'next 10'
        const res2 = await fetch(`https://v3.football.api-sports.io/fixtures?league=${LEAGUE_ID}&season=${SEASON}&next=5`, {
            headers: { 'x-apisports-key': API_KEY! }
        })
        const json2 = await res2.json()
        if (json2.response && json2.response.length > 0) {
            printFixtures(json2.response)
        } else {
            console.error("No fixtures found.")
        }
        return
    }

    printFixtures(json.response)
}

function printFixtures(list: any[]) {
    console.log(`\nFound ${list.length} fixtures:`)
    list.forEach(f => {
        console.log(`[${f.fixture.id}] ${f.teams.home.name} vs ${f.teams.away.name} (${f.fixture.date})`)
    })

    // Suggest command
    if (list.length > 0) {
        console.log(`\nTo test analysis, run:`)
        console.log(`npx tsx scripts/trigger_analysis_direct_create.ts ${list[0].fixture.id}`)
    }
}

findFixture()
