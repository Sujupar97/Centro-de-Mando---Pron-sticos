
const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5';
const FIXTURE_ID = 19439462;
const BASE_URL = 'https://api.sportmonks.com/v3/football';

console.log(`Verifying API Key for Fixture: ${FIXTURE_ID}`);

try {
    const url = `${BASE_URL}/fixtures/${FIXTURE_ID}?api_token=${API_KEY}`;
    console.log(`URL: ${url.replace(API_KEY, '***')}`);

    const response = await fetch(url);
    console.log(`Status: ${response.status}`);

    if (response.ok) {
        const json = await response.json();
        if (json.data && json.data.id === FIXTURE_ID) {
            console.log('✅ SUCCESS: Key is valid and fixture found.');
            console.log('Match:', json.data.name);
            console.log('Date:', json.data.starting_at);
        } else {
            console.error('❌ KEY SEEMS VALID BUT FIXTURE NOT FOUND IN DATA');
            console.log(JSON.stringify(json, null, 2));
        }
    } else {
        console.error('❌ REQUEST FAILED (Likely invalid key or quota)');
        console.log(await response.text());
    }

} catch (e) {
    console.error('Network Error:', e);
}
