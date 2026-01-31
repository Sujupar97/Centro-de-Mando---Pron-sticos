
const https = require('https');

const API_KEY = '527a97a0d2316436a0bacf71c7b93eb5';
const SPORT = 'soccer_england_league1'; // Using a lower tier or active league. Or 'upcoming'.
// Let's list sports first to be sure or just fetch upcoming odds.
const URL = `https://api.the-odds-api.com/v4/sports/upcoming/odds/?regions=eu&markets=h2h&apiKey=${API_KEY}`;

console.log(`Fetching from: ${URL}`);

https.get(URL, (resp) => {
    let data = '';

    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("Status:", resp.statusCode);
            if (resp.statusCode === 200) {
                console.log("Events found:", json.length);
                if (json.length > 0) {
                    console.log("Sample Event:", json[0].home_team, "vs", json[0].away_team);
                    console.log("Bookmakers:", JSON.stringify(json[0].bookmakers[0]?.title));
                }
            } else {
                console.log("Error Body:", json);
            }
        } catch (e) {
            console.error("Parse Error:", e);
            console.log("Raw:", data);
        }
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});
