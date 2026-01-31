// scripts/list_sports.cjs
const https = require('https');

const ODDS_API_KEY = "527a97a0d2316436a0bacf71c7b93eb5";

async function fetchSports() {
    const url = `https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_API_KEY}`;
    console.log(`Fetching sports list...`);

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
                    resolve([]);
                }
            });
        });
    });
}

async function main() {
    const sports = await fetchSports();
    if (!Array.isArray(sports)) {
        console.log("Error fetching sports:", sports);
        return;
    }

    console.log(`\nFound ${sports.length} active sports.`);

    const colombia = sports.filter(s => s.key.includes('colombia') || s.title.includes('Colombia') || s.group.includes('Soccer'));

    console.log("\n--- POTENTIAL MATCHES (Soccer/Colombia) ---");
    colombia.forEach(s => {
        console.log(`Key: ${s.key.padEnd(40)} | Title: ${s.title}`);
    });
}

main();
