
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.168.0/dotenv/load.ts";

const sbUrl = Deno.env.get('SUPABASE_URL')!;
const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(sbUrl, sbKey);

async function testAiTuning() {
    console.log("🧪 Testing AI Tuning (Statistical Dominance)...");

    const payload = {
        job_id: `test-tuning-${Date.now()}`,
        fixture_id: 999999, // Dummy ID
        payload: {
            match: {
                teams: {
                    home: { name: 'Manchester City' },
                    away: { name: 'Luton Town' }
                },
                competition: { name: 'Premier League' }
            },
            datasets: {
                home_team_last40: {
                    all: Array(5).fill({
                        was_home: true,
                        score_home: 3,
                        score_away: 0,
                        opponent_name: 'Weak Team',
                        date: '2024-02-01'
                    })
                },
                away_team_last40: {
                    all: Array(5).fill({
                        was_home: false,
                        score_home: 4,
                        score_away: 0, // They lose 4-0
                        opponent_name: 'Strong Team',
                        date: '2024-02-01'
                    })
                },
                h2h: [
                    {
                        date: '2023-12-10',
                        home_team: 'Luton Town',
                        away_team: 'Manchester City',
                        score_home: 1,
                        score_away: 2
                    },
                    {
                        date: '2023-04-10',
                        home_team: 'Manchester City',
                        away_team: 'Luton Town',
                        score_home: 5,
                        score_away: 1
                    }
                ]
            },
            odds: {
                MAIN: [{ lbl: '1', val: 1.10 }, { lbl: 'X', val: 9.00 }, { lbl: '2', val: 15.00 }]
            }
        }
    };

    const { data, error } = await supabase.functions.invoke('v3-ai-analyzer', {
        body: payload
    });

    if (error) {
        console.error("❌ Function Error:", error);
        return;
    }

    if (!data.success) {
        console.error("❌ Analysis Failed:", data.error);
        return;
    }

    const report = data.analysis;
    const picks = report.pronosticos || [];
    const mainPick = picks.find((p: any) => p.seleccion.includes('City') || p.mercado.includes('1X2'));

    console.log("\n📊 AI Analysis Result:");
    console.log(`Title: ${report.resumen_ejecutivo.titular}`);
    console.log(`Verdict: ${report.resumen_ejecutivo.veredicto}`);
    console.log(`Confidence: ${report.resumen_ejecutivo.confianza_global}`);

    if (mainPick) {
        console.log(`\n🎯 Main Pick: ${mainPick.seleccion} | Prob: ${mainPick.probabilidad_calculada_porcentaje}%`);
        if (mainPick.probabilidad_calculada_porcentaje >= 80) {
            console.log("✅ SUCCESS: Probability is >= 80% (System is accepting statistical dominance)");
        } else {
            console.log("⚠️ WARNING: Probability is < 80%. Tuning might need more aggression.");
        }
    } else {
        console.log("⚠️ No main pick found.");
    }
}

testAiTuning();
