
// Script para invocar v3-ai-analyzer DIRECTAMENTE en Producción y ver si acepta la Service Role Key (ESM Valid)
import { writeFileSync } from 'fs';

// Datos extraídos del entorno del usuario
const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
// SUPABASE_SERVICE_ROLE_KEY extraído del .env
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgxNjAwNywiZXhwIjoyMDgxMzkyMDA3fQ.x1icf0Wbkp1xb6h1500HeTvyNykBAAnlqz1udv2AaX4';

async function invokeFunction() {
    console.log(`Invoking v3-ai-analyzer directly on ${SUPABASE_URL}...`);

    const url = `${SUPABASE_URL}/functions/v1/v3-ai-analyzer`;
    // Payload mínimo válido para v3
    const body = {
        job_id: 'debug-script-local',
        fixture_id: 19622078,
        payload: { match: { id: 19622078 }, datasets: {} } // Dummy payload
    };

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
        console.log(`Body: ${text}`);

        writeFileSync('scripts/output_invoke.txt', `Status: ${response.status} ${response.statusText}\nBody: ${text}`);

    } catch (error) {
        console.error('Network Error:', error);
        writeFileSync('scripts/output_invoke.txt', `Network Error: ${error.toString()}`);
    }
}

invokeFunction();
