import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(sbUrl, sbKey);

    try {
        console.log('🔄 Iniciando migración de predicciones...');

        // 1. Obtener todos los análisis existentes
        const { data: analyses, error: fetchError } = await supabase
            .from('analisis')
            .select('partido_id, resultado_analisis');

        if (fetchError) throw fetchError;

        if (!analyses || analyses.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No hay análisis para migrar',
                migrated: 0
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        let totalPredictions = 0;
        let successCount = 0;
        const errors: string[] = [];

        for (const analysis of analyses) {
            const fixtureId = analysis.partido_id;
            const dashboardData = analysis.resultado_analisis?.dashboardData;

            if (!dashboardData) continue;

            const predictions = dashboardData.predicciones_finales?.detalle || [];

            if (predictions.length === 0) continue;

            // Verificar si ya existen predicciones para este partido
            const { data: existing } = await supabase
                .from('predictions')
                .select('id')
                .eq('fixture_id', fixtureId)
                .limit(1);

            if (existing && existing.length > 0) continue;

            // Preparar predicciones para insertar
            const predictionsToInsert = predictions.map((p: any) => ({
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
                errors.push(`Partido ${fixtureId}: ${insertError.message}`);
            } else {
                successCount++;
                totalPredictions += predictionsToInsert.length;
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Migración completada`,
            totalAnalyses: analyses.length,
            successCount,
            totalPredictions,
            errors
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({
            success: false,
            error: err.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
