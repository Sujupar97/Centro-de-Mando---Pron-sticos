// Verificar partidos del 29 dic
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('📊 VERIFICANDO ANÁLISIS DEL 29 DIC\n');

    // Partidos del 29
    const { data: matches29, error: err29 } = await supabase
        .from('daily_matches')
        .select('*')
        .eq('match_date', '2025-12-29')
        .order('match_time');

    if (err29) {
        console.error('Error:', err29);
        return;
    }

    const total29 = matches29?.length || 0;
    const analyzed29 = matches29?.filter(m => m.is_analyzed).length || 0;
    const pending29 = total29 - analyzed29;

    console.log(`\n=== PARTIDOS DEL 29 DIC ===`);
    console.log(`Total: ${total29}`);
    console.log(`Analizados: ${analyzed29}  ✅`);
    console.log(`Pendientes: ${pending29}  ⏳\n`);

    if (pending29 > 0) {
        console.log('Partidos pendientes:');
        matches29?.filter(m => !m.is_analyzed).forEach(m => {
            console.log(`  - ${m.home_team} vs ${m.away_team}`);
        });
    }

    // Partidos del 30
    const { data: matches30 } = await supabase
        .from('daily_matches')
        .select('*')
        .eq('match_date', '2025-12-30')
        .order('match_time');

    const total30 = matches30?.length || 0;
    const analyzed30 = matches30?.filter(m => m.is_analyzed).length || 0;
    const pending30 = total30 - analyzed30;

    console.log(`\n=== PARTIDOS DEL 30 DIC ===`);
    console.log(`Total: ${total30}`);
    console.log(`Analizados: ${analyzed30}  ✅`);
    console.log(`Pendientes: ${pending30}  ⏳\n`);
}

verify().catch(console.error);
