// Script para verificar tablas y probar el sistema de automatización
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    console.log('🧪 PRUEBAS DEL SISTEMA DE AUTOMATIZACIÓN\n');
    console.log('='.repeat(50));

    // 1. Verificar ligas permitidas
    console.log('\n📋 1. LIGAS PERMITIDAS (allowed_leagues)');
    const { data: leagues, error: leaguesError } = await supabase
        .from('allowed_leagues')
        .select('*')
        .limit(10);

    if (leaguesError) {
        console.log('❌ Error:', leaguesError.message);
    } else {
        console.log(`✅ Total ligas encontradas: ${leagues?.length || 0}`);
        if (leagues && leagues.length > 0) {
            console.log('\n   Primeras 5 ligas:');
            leagues.slice(0, 5).forEach(l => {
                console.log(`   - ${l.name} (${l.country}) - Tier: ${l.tier}`);
            });
        }
    }

    // 2. Verificar logs de automatización
    console.log('\n📊 2. LOGS DE AUTOMATIZACIÓN (automation_logs)');
    const { data: logs, error: logsError } = await supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (logsError) {
        console.log('❌ Error:', logsError.message);
    } else {
        console.log(`✅ Logs encontrados: ${logs?.length || 0}`);
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                console.log(`   - [${log.job_type}] ${log.status} - ${log.execution_date}`);
                console.log(`     Procesados: ${log.items_processed}, Éxitos: ${log.items_success}`);
            });
        }
    }

    // 3. Verificar partidos diarios
    console.log('\n⚽ 3. PARTIDOS ESCANEADOS (daily_matches)');
    const { data: matches, error: matchesError } = await supabase
        .from('daily_matches')
        .select('*')
        .limit(10);

    if (matchesError) {
        console.log('❌ Error:', matchesError.message);
    } else {
        console.log(`✅ Partidos encontrados: ${matches?.length || 0}`);
        if (matches && matches.length > 0) {
            matches.slice(0, 3).forEach(m => {
                console.log(`   - ${m.home_team} vs ${m.away_team} (${m.league_name})`);
            });
        }
    }

    // 4. Verificar parlays automáticos
    console.log('\n🎰 4. PARLAYS AUTOMÁTICOS (daily_auto_parlays)');
    const { data: parlays, error: parlaysError } = await supabase
        .from('daily_auto_parlays')
        .select('*')
        .limit(5);

    if (parlaysError) {
        console.log('❌ Error:', parlaysError.message);
    } else {
        console.log(`✅ Parlays encontrados: ${parlays?.length || 0}`);
    }

    // 5. Contar total de ligas
    const { count: totalLeagues } = await supabase
        .from('allowed_leagues')
        .select('*', { count: 'exact', head: true });

    console.log('\n' + '='.repeat(50));
    console.log('📈 RESUMEN:');
    console.log(`   - Total ligas seguras: ${totalLeagues}`);
    console.log(`   - Logs de ejecución: ${logs?.length || 0}`);
    console.log(`   - Partidos escaneados: ${matches?.length || 0}`);
    console.log(`   - Parlays generados: ${parlays?.length || 0}`);
    console.log('='.repeat(50));
}

runTests().catch(console.error);
