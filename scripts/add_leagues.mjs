// Script para agregar ligas adicionales a Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(supabaseUrl, supabaseKey);

// Lista completa de ligas a agregar
const newLeagues = [
    // Turquía
    { api_league_id: 203, name: 'Süper Lig', country: 'Turkey', tier: 'major', risk_level: 'low' },
    { api_league_id: 204, name: '1. Lig', country: 'Turkey', tier: 'secondary', risk_level: 'medium' },

    // Portugal
    { api_league_id: 94, name: 'Primeira Liga', country: 'Portugal', tier: 'top', risk_level: 'low' },
    { api_league_id: 95, name: 'Liga Portugal 2', country: 'Portugal', tier: 'secondary', risk_level: 'medium' },
    { api_league_id: 96, name: 'Taça de Portugal', country: 'Portugal', tier: 'cup', risk_level: 'low' },

    // Copa África
    { api_league_id: 6, name: 'Africa Cup of Nations', country: 'Africa', tier: 'cup', risk_level: 'low' },
    { api_league_id: 12, name: 'CAF Champions League', country: 'Africa', tier: 'cup', risk_level: 'medium' },

    // Arabia Saudita
    { api_league_id: 307, name: 'Saudi Pro League', country: 'Saudi-Arabia', tier: 'major', risk_level: 'low' },

    // Qatar
    { api_league_id: 305, name: 'Stars League', country: 'Qatar', tier: 'major', risk_level: 'low' },
    { api_league_id: 726, name: 'Emir Cup', country: 'Qatar', tier: 'cup', risk_level: 'low' },

    // UAE
    { api_league_id: 301, name: 'Pro League', country: 'UAE', tier: 'major', risk_level: 'low' },

    // Grecia
    { api_league_id: 197, name: 'Super League 1', country: 'Greece', tier: 'major', risk_level: 'medium' },

    // Holanda
    { api_league_id: 88, name: 'Eredivisie', country: 'Netherlands', tier: 'top', risk_level: 'low' },
    { api_league_id: 89, name: 'Eerste Divisie', country: 'Netherlands', tier: 'secondary', risk_level: 'low' },

    // Bélgica
    { api_league_id: 144, name: 'Pro League', country: 'Belgium', tier: 'top', risk_level: 'low' },

    // Austria
    { api_league_id: 218, name: 'Bundesliga', country: 'Austria', tier: 'major', risk_level: 'low' },

    // Suiza
    { api_league_id: 207, name: 'Super League', country: 'Switzerland', tier: 'major', risk_level: 'low' },

    // Australia
    { api_league_id: 188, name: 'A-League', country: 'Australia', tier: 'major', risk_level: 'low' },

    // Japón
    { api_league_id: 98, name: 'J1 League', country: 'Japan', tier: 'major', risk_level: 'low' },
    { api_league_id: 99, name: 'J2 League', country: 'Japan', tier: 'secondary', risk_level: 'low' },

    // Corea del Sur
    { api_league_id: 292, name: 'K League 1', country: 'South-Korea', tier: 'major', risk_level: 'low' },

    // China
    { api_league_id: 169, name: 'Super League', country: 'China', tier: 'major', risk_level: 'medium' },

    // Escocia
    { api_league_id: 179, name: 'Premiership', country: 'Scotland', tier: 'major', risk_level: 'low' },

    // Dinamarca
    { api_league_id: 119, name: 'Superliga', country: 'Denmark', tier: 'major', risk_level: 'low' },

    // Noruega
    { api_league_id: 103, name: 'Eliteserien', country: 'Norway', tier: 'major', risk_level: 'low' },

    // Suecia
    { api_league_id: 113, name: 'Allsvenskan', country: 'Sweden', tier: 'major', risk_level: 'low' },

    // Croacia
    { api_league_id: 210, name: 'HNL', country: 'Croatia', tier: 'major', risk_level: 'medium' },

    // Serbia
    { api_league_id: 286, name: 'Super Liga', country: 'Serbia', tier: 'major', risk_level: 'medium' },

    // Ucrania
    { api_league_id: 333, name: 'Premier League', country: 'Ukraine', tier: 'major', risk_level: 'medium' },

    // República Checa
    { api_league_id: 345, name: 'First League', country: 'Czech-Republic', tier: 'major', risk_level: 'low' },

    // Israel
    { api_league_id: 384, name: "Ligat Ha'al", country: 'Israel', tier: 'major', risk_level: 'medium' },

    // Irán
    { api_league_id: 290, name: 'Persian Gulf Pro League', country: 'Iran', tier: 'major', risk_level: 'medium' },

    // Marruecos (seguro, liga profesional)
    { api_league_id: 200, name: 'Botola Pro', country: 'Morocco', tier: 'major', risk_level: 'low' },

    // Egipto (seguro, liga profesional)
    { api_league_id: 233, name: 'Premier League', country: 'Egypt', tier: 'major', risk_level: 'low' },

    // Sudáfrica (seguro, liga profesional)
    { api_league_id: 288, name: 'Premier Soccer League', country: 'South-Africa', tier: 'major', risk_level: 'low' },

    // Túnez (seguro, liga profesional)
    { api_league_id: 202, name: 'Ligue 1', country: 'Tunisia', tier: 'major', risk_level: 'medium' },

    // Argelia
    { api_league_id: 186, name: 'Ligue 1', country: 'Algeria', tier: 'major', risk_level: 'medium' },

    // Polonia
    { api_league_id: 106, name: 'Ekstraklasa', country: 'Poland', tier: 'major', risk_level: 'low' },

    // Hungría
    { api_league_id: 271, name: 'NB I', country: 'Hungary', tier: 'major', risk_level: 'medium' },

    // Rumania
    { api_league_id: 283, name: 'Liga I', country: 'Romania', tier: 'major', risk_level: 'medium' },

    // Bulgaria
    { api_league_id: 172, name: 'First League', country: 'Bulgaria', tier: 'major', risk_level: 'medium' },
];

async function addLeagues() {
    console.log('🌍 AGREGANDO LIGAS PERMITIDAS\n');
    console.log(`Total a agregar: ${newLeagues.length}\n`);

    let added = 0;
    let skipped = 0;

    for (const league of newLeagues) {
        const { error } = await supabase
            .from('allowed_leagues')
            .upsert(league, { onConflict: 'api_league_id', ignoreDuplicates: true });

        if (error) {
            console.log(`❌ Error en ${league.name}: ${error.message}`);
        } else {
            added++;
        }
    }

    console.log(`\n✅ Ligas procesadas: ${added}`);

    // Verificar total
    const { data: count } = await supabase
        .from('allowed_leagues')
        .select('*', { count: 'exact' });

    console.log(`📊 Total ligas en base de datos: ${count?.length || 0}`);

    // Mostrar por país
    const byCountry = {};
    count?.forEach(l => {
        byCountry[l.country] = (byCountry[l.country] || 0) + 1;
    });

    console.log('\n📍 Ligas por país:');
    Object.entries(byCountry).sort((a, b) => b[1] - a[1]).forEach(([country, num]) => {
        console.log(`   ${country}: ${num}`);
    });
}

addLeagues().catch(console.error);
