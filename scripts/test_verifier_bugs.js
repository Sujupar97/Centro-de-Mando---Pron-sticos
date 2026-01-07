// FASE 1: Script de Testing - Validar bugs ANTES del fix
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

// Casos de prueba del usuario
const testCases = [
    {
        name: "Baniyas Team Total",
        home: "Baniyas SC",
        away: "Al Nasr",
        homeScore: 1,
        awayScore: 0,
        market: "Total de Goles del Equipo Local",
        selection: "Baniyas Menos de 1.5 Goles",
        expected: true, // DEBE GANAR (1 < 1.5)
        date: "2026-01-02"
    },
    {
        name: "Brighton Team Corners",
        home: "Brighton",
        away: "Burnley",
        homeScore: null, // No importa para corners
        awayScore: null,
        homeCorners: 8, // Brighton tuvo 8 corners
        awayCorners: 4,
        market: "Corners",
        selection: "Brighton Más de 6.5 Corners",
        expected: true, // DEBE GANAR (8 > 6.5)
        date: "2026-01-02"
    }
];

// Función de evaluación ACTUAL (copiada del código)
function evaluatePredictionCurrent(prediction, match) {
    const { market: marketName, selection: predicted_outcome } = prediction;
    const m = (marketName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const o = (predicted_outcome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const { home_score: h, away_score: a, home_team: ht, away_team: at } = match;

    if (h === null || a === null) return null;

    const tot = h + a;
    const homeWin = h > a;
    const awayWin = a > h;
    const draw = h === a;

    // BTTS
    if (m.includes('ambos') || m.includes('btts') || m.includes('marcan')) {
        const both = h > 0 && a > 0;
        if (o.includes('no')) return !both;
        return both;
    }

    // Over/Under
    const ou = o.match(/(mas|menos|over|under|o\/u|\+|\-)\s*(de\s+)?(\d+(\.\d+)?)/i);
    if (ou) {
        const type = ou[1];
        const val = parseFloat(ou[3]);
        if (m.includes('corner')) return null; // ❌ BUG: Retorna null SIEMPRE para corners
        if (['mas', 'over', '+', 'más'].some(t => type.includes(t))) return tot > val;
        if (['menos', 'under', '-'].some(t => type.includes(t))) return tot < val;
    }

    // 1X2 / Double Chance
    if (o.includes('1x') || (o.includes('local') && o.includes('empate'))) return homeWin || draw;
    if (o.includes('x2') || (o.includes('visita') && o.includes('empate')) || (o.includes('visitante') && o.includes('empate'))) return awayWin || draw;
    if (o.includes('12')) return homeWin || awayWin;
    if (o.includes('local') || o.includes('home') || o === '1') return homeWin;
    if (o.includes('visita') || o.includes('visitante') || o.includes('away') || o === '2') return awayWin;
    if (o.includes('empate') || o.includes('draw') || o === 'x') return draw;

    // Team Name
    const cleanHT = (ht || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanAT = (at || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (cleanHT && o.includes(cleanHT)) return homeWin;
    if (cleanAT && o.includes(cleanAT)) return awayWin;

    return null;
}

async function runTests() {
    console.log('🧪 TESTING DEL BUG - Código ACTUAL\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        console.log(`📋 Test: ${test.name}`);
        console.log(`   Partido: ${test.home} vs ${test.away}`);
        console.log(`   Market: ${test.market}`);
        console.log(`   Selección: ${test.selection}`);

        if (test.homeScore !== null) {
            console.log(`   Resultado: ${test.homeScore}-${test.awayScore}`);
        }
        if (test.homeCorners) {
            console.log(`   Corners: ${test.homeCorners}-${test.awayCorners}`);
        }

        const prediction = {
            market: test.market,
            selection: test.selection
        };

        const match = {
            home_score: test.homeScore,
            away_score: test.awayScore,
            home_team: test.home,
            away_team: test.away
        };

        const result = evaluatePredictionCurrent(prediction, match);
        const resultStr = result === null ? 'null (pendiente)' : (result ? 'true (ganó)' : 'false (perdió)');
        const expectedStr = test.expected ? 'true (ganó)' : 'false (perdió)';

        console.log(`   Esperado: ${expectedStr}`);
        console.log(`   Obtenido: ${resultStr}`);

        if (result === test.expected) {
            console.log(`   ✅ CORRECTO\n`);
            passed++;
        } else {
            console.log(`   ❌ INCORRECTO (BUG CONFIRMADO)\n`);
            failed++;
        }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE TESTING\n');
    console.log(`Total tests: ${testCases.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('');

    if (failed > 0) {
        console.log('🚨 BUGS CONFIRMADOS:');
        console.log('   1. Team Totals (goles de un equipo) - NO detectado');
        console.log('   2. Team Corners - Retorna null SIEMPRE');
        console.log('');
        console.log('💡 Proceder con FASE 2: Aplicar Fix');
    } else {
        console.log('✅ NO hay bugs (inesperado)');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    return { passed, failed, total: testCases.length };
}

runTests().then(result => {
    console.log('✅ Testing completado');
    console.log(`   Bugs encontrados: ${result.failed}/${result.total}`);
    process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
