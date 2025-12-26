/**
 * Script de migración: Extrae predicciones de análisis existentes
 * 
 * Este script lee todos los análisis de la tabla 'analisis' y extrae
 * las predicciones individuales para guardarlas en la tabla 'predictions'.
 * 
 * Ejecutar con: node migrate_predictions.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('❌ Error: Falta SUPABASE_SERVICE_ROLE_KEY');
    console.log('Ejecutar así: SUPABASE_SERVICE_ROLE_KEY="tu-key" node migrate_predictions.mjs');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migratePredictions() {
    console.log('🔄 Iniciando migración de predicciones...\n');

    // 1. Obtener todos los análisis existentes
    const { data: analyses, error: fetchError } = await supabase
        .from('analisis')
        .select('partido_id, resultado_analisis');

    if (fetchError) {
        console.error('❌ Error al obtener análisis:', fetchError.message);
        return;
    }

    if (!analyses || analyses.length === 0) {
        console.log('⚠️ No hay análisis para migrar.');
        return;
    }

    console.log(`📊 Encontrados ${analyses.length} análisis para procesar.\n`);

    let totalPredictions = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const analysis of analyses) {
        const fixtureId = analysis.partido_id;
        const dashboardData = analysis.resultado_analisis?.dashboardData;

        if (!dashboardData) {
            console.log(`⏭️ Partido ${fixtureId}: Sin dashboardData, saltando...`);
            continue;
        }

        const predictions = dashboardData.predicciones_finales?.detalle || [];

        if (predictions.length === 0) {
            console.log(`⏭️ Partido ${fixtureId}: Sin predicciones, saltando...`);
            continue;
        }

        // Verificar si ya existen predicciones para este partido
        const { data: existing } = await supabase
            .from('predictions')
            .select('id')
            .eq('fixture_id', fixtureId)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`⏭️ Partido ${fixtureId}: Ya tiene predicciones, saltando...`);
            continue;
        }

        // Preparar predicciones para insertar
        const predictionsToInsert = predictions.map((p) => ({
            fixture_id: fixtureId,
            market: p.mercado || 'Mercado',
            selection: p.seleccion || 'Selección',
            probability: p.probabilidad_estimado_porcentaje || 50,
            confidence: (p.probabilidad_estimado_porcentaje || 50) >= 70 ? 'Alta' : 'Media',
            reasoning: p.justificacion_detallada?.conclusion || ''
        }));

        // Insertar predicciones
        const { error: insertError } = await supabase
            .from('predictions')
            .insert(predictionsToInsert);

        if (insertError) {
            console.error(`❌ Partido ${fixtureId}: Error - ${insertError.message}`);
            errorCount++;
        } else {
            console.log(`✅ Partido ${fixtureId}: ${predictionsToInsert.length} predicciones migradas`);
            successCount++;
            totalPredictions += predictionsToInsert.length;
        }
    }

    console.log('\n📈 RESUMEN DE MIGRACIÓN:');
    console.log(`   ✅ Partidos exitosos: ${successCount}`);
    console.log(`   ❌ Partidos con error: ${errorCount}`);
    console.log(`   📊 Total predicciones migradas: ${totalPredictions}`);
}

migratePredictions().catch(console.error);
