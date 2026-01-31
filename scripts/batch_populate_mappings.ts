import { execSync } from 'child_process'

const LEAGUES = [
    39, // EPL
    140, // La Liga
    135, // Serie A
    78, // Bundesliga
    61, // Ligue 1
    2, // UCL
    3, // UEL
    848, // Conf
    253, // MLS
    71, // Brasileirao
    128, // Argentina
    239, // Colombia B
    88, // Eredivisie
    94, // Portugal
    144, // Belgium
    179, // Scotland
    113, // Sweden
    119, // Denmark
    169, // China
    307 // Saudi
]

console.log("🚀 STARTING BATCH POPULATION for " + LEAGUES.length + " leagues...")

for (const id of LEAGUES) {
    console.log(`\n---------------------------------------------------`)
    console.log(`>>> PROCESSING LEAGUE ID: ${id}`)
    try {
        execSync(`npx tsx scripts/populate_team_mappings_node.ts ${id}`, { stdio: 'inherit' })
    } catch (e) {
        console.error(`❌ FAILED for League ${id}`)
    }
}

console.log("\n✅ BATCH COMPLETED.")
