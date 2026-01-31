
import dotenv from 'dotenv';
dotenv.config();

const ODDS_API_KEY = "527a97a0d2316436a0bacf71c7b93eb5";

async function listActiveSports() {
    try {
        console.log("Fetching active sports...");
        const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_API_KEY}`);

        if (!res.ok) {
            console.log("Error:", res.statusText);
            return;
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
            console.log("Response is not an array:", data);
            return;
        }

        console.log("Active Sports found:", data.length);
        const argentina = data.filter((s: any) => s.key.includes('argentina') || s.title.toLowerCase().includes('argentina'));
        console.log("Argentina Markets:", jsonData(argentina));

        // Also log soccer keys just in case
        const soccer = data.filter((s: any) => s.key.includes('soccer') && s.group === 'Soccer');
        console.log("Soccer Keys Sample:", jsonData(soccer.slice(0, 10)));

    } catch (e) {
        console.error(e);
    }
}

function jsonData(data: any) {
    return JSON.stringify(data, null, 2);
}

listActiveSports();
