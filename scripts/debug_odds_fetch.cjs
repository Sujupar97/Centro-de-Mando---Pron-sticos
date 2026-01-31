// scripts/debug_odds_fetch.cjs
const https = require('https');

const ODDS_API_KEY = "527a97a0d2316436a0bacf71c7b93eb5";
const SPORT_KEY = 'soccer_epl';
const HOME_TEAM = "Chelsea";
const AWAY_TEAM = "Wolves";

// --- BETTER MATCHING LOGIC (Simulating _shared/team-normalization.ts) ---

const KNOWN_ALIASES = {
    'wolverhamptonwanderers': ['wolves'],
    'wolves': ['wolverhamptonwanderers'],
    'tottenhamhotspur': ['spurs'],
    'spurs': ['tottenhamhotspur', 'tottenham'],
    'manchesterunited': ['manutd'],
    'manutd': ['manchesterunited']
};

function normalizeName(name) {
    return name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\b(fc|cf|sc|cd|ac|as|sv|vfb|borussia|sporthera|club|deportiva|atletico|real|sporting|olympique|inter)\b/g, '')
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

function getSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.length < 2 || str2.length < 2) return 0.0;
    const bigrams1 = new Map();
    for (let i = 0; i < str1.length - 1; i++) {
        const bigram = str1.substring(i, i + 2);
        bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
    }
    let intersection = 0;
    for (let i = 0; i < str2.length - 1; i++) {
        const bigram = str2.substring(i, i + 2);
        const count = bigrams1.get(bigram);
        if (count && count > 0) {
            bigrams1.set(bigram, count - 1);
            intersection++;
        }
    }
    return (2.0 * intersection) / (str1.length + str2.length - 2);
}

function areTeamsEqual(nameA, nameB) {
    const normA = nameA.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const normB = nameB.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

    if (normA === normB) return true;
    if (KNOWN_ALIASES[normA]?.includes(normB)) return true;
    if (KNOWN_ALIASES[normB]?.includes(normA)) return true;

    const coreA = normalizeName(nameA);
    const coreB = normalizeName(nameB);
    return getSimilarity(coreA, coreB) >= 0.65;
}

async function fetchOdds() {
    const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;
    console.log(`Fetching: ${url}`);

    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    console.error("JSON Parse Error:", e);
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            console.error("Network Error:", e);
            resolve(null);
        });
    });
}

async function main() {
    console.log(`--- DEBUGGING MATCH: ${HOME_TEAM} vs ${AWAY_TEAM} ---`);
    const data = await fetchOdds();

    if (!Array.isArray(data)) {
        console.log("Response is not an array:", data);
        return;
    }

    console.log(`\nFound ${data.length} matches in ${SPORT_KEY}:`);

    let found = false;
    data.forEach(ev => {
        const isHomeMatch = areTeamsEqual(ev.home_team, HOME_TEAM);
        const isAwayMatch = areTeamsEqual(ev.away_team, AWAY_TEAM);

        const isMatch = isHomeMatch && isAwayMatch;
        const prefix = isMatch ? "✅ MATCH" : "❌";

        if (isMatch) found = true;

        console.log(`${prefix} ${ev.home_team} vs ${ev.away_team}`);
        if (isMatch) console.log("   --> MATCHED!");
    });

    if (!found) {
        console.log("\n⚠️ MATCH NOT FOUND");
    }
}

main();
