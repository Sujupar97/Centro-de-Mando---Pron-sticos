
const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5';
const FIXTURE_ID = 19431963;

async function checkState() {
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures/${FIXTURE_ID}`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('include', 'state;league');

    try {
        const res = await fetch(url.toString());
        const json = await res.json();
        const data = json.data;

        console.log(`\n--- STATE CHECK ---`);
        console.log(`Fixture: ${data.name}`);
        console.log(`State Code: ${data.state?.state}`);
        console.log(`State Name: ${data.state?.name}`);
        console.log(`Starting At: ${data.starting_at}`);

        const isLiveOrFinished = ['LIVE', 'FT', 'AET', 'FT_PEN'].includes(data.state?.state);
        console.log(`Is Live/Finished? ${isLiveOrFinished}`);

    } catch (e) { console.error(e); }
}

checkState();
