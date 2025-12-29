// Verificar análisis creados
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('📊 VERIFICANDO ANÁLISIS GENERADOS\n');

    // Análisis jobs
    const { data: jobs, error: jobsError } = await supabase
        .from('analysis_jobs')
        .select('id, api_fixture_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (jobsError) {
        console.log('Error jobs:', jobsError.message);
    } else {
        console.log(`✅ Analysis Jobs: ${jobs?.length || 0}`);
        jobs?.forEach(j => {
            console.log(`   - Fixture ${j.api_fixture_id}: ${j.status} (${new Date(j.created_at).toLocaleString()})`);
        });
    }

    // Daily matches
    console.log('\n');
    const { data: matches } = await supabase
        .from('daily_matches')
        .select('home_team, away_team, is_analyzed, match_date')
        .eq('match_date', '2025-12-29')
        .limit(10);

    console.log(`⚽ Partidos del 29 dic:`);
    matches?.forEach(m => {
        const status = m.is_analyzed ? '✅' : '⏳';
        console.log(`   ${status} ${m.home_team} vs ${m.away_team}`);
    });
}

check();
