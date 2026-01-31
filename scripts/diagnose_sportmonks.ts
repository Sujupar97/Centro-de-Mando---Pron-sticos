
// Scripts para diagnósticar SportMonks
import { getFixtureComplete } from './supabase/functions/_shared/sportmonks-client.ts';
import "https://deno.land/x/dotenv/load.ts";

const FIXTURE_ID = 19622078; // ID real visto en el screenshot

async function diagnose() {
    console.log(`Diagnosing SportMonks API for fixture ${FIXTURE_ID}...`);
    try {
        const data = await getFixtureComplete(FIXTURE_ID);
        if (!data) {
            console.error('❌ Data is null');
        } else {
            console.log('✅ Data received!');
            console.log('Participants:', data.participants?.length);
            console.log('Season ID:', data.season_id);
            console.log('Includes present:', Object.keys(data).filter(k =>
                ['participants', 'lineups', 'odds', 'predictions', 'xGFixture'].includes(k)
            ));
        }
    } catch (e) {
        console.error('❌ Error fetching:', e);
    }
}

diagnose();
