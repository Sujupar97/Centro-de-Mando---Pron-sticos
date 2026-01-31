
// Script para reproducir el análisis del partido Liverpool vs Newcastle (19427690)
// Validará si la optimización de "Smart Odds" permite generar pronósticos
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
// Using the Known Service Key you injected or just reuse one
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.x1icf0Wbkp1xb6h1500HeTvyNykBAAnlqz1udv2AaX4';

async function reproduce() {
    console.log(`Testing Analysis for Liverpool-Newcastle (19427690) on ${SUPABASE_URL}...`);

    const url = `${SUPABASE_URL}/functions/v1/v2-create-job-sportmonks`;
    const body = {
        fixture_id: 19427690,
        user_id: 'test-smart-odds-verification'
    };

    console.log("Payload:", JSON.stringify(body));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_KEY}`
            },
            body: JSON.stringify(body)
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();

        // Try to parse JSON to inspect if predictions exist
        try {
            const json = JSON.parse(text);
            const picks = json.analysis?.pronosticos || [];
            console.log(`Success! Found ${picks.length} predictions.`);
            if (picks.length > 0) {
                console.log('Prediction 1:', picks[0].mercado, '-', picks[0].seleccion);
            } else {
                console.warn('Still 0 predictions... Check logs.');
            }
        } catch (e) {
            console.log(`Body (Text): ${text.substring(0, 500)}...`);
        }

        writeFileSync('scripts/output_smart_odds.txt', `Status: ${response.status} ${response.statusText}\nBody: ${text}`);

    } catch (error) {
        console.error('Network Error:', error);
        writeFileSync('scripts/output_smart_odds.txt', `Network Error: ${error.toString()}`);
    }
}

reproduce();
