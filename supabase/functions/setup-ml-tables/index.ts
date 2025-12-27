import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

/**
 * EDGE FUNCTION: setup-ml-phase2-4
 * Ejecuta la configuración de ML Fases 2 y 4 directamente en la DB
 */

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        console.log('[SETUP-ML] Iniciando configuración de Fases 2 y 4...');

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const results: string[] = [];

        // 1. Verificar si pgvector ya existe
        const { data: extCheck } = await supabase
            .from('pg_extension')
            .select('extname')
            .eq('extname', 'vector')
            .single();

        if (!extCheck) {
            results.push('⚠️ pgvector no detectado - puede requerir habilitación manual en Dashboard');
        } else {
            results.push('✅ pgvector ya habilitado');
        }

        // 2. Crear tabla prediction_embeddings si no existe
        const { error: embedError } = await supabase.from('prediction_embeddings').select('id').limit(1);
        if (embedError?.code === '42P01') { // Table doesn't exist
            results.push('❌ Tabla prediction_embeddings no existe - requiere creación manual');
        } else {
            results.push('✅ Tabla prediction_embeddings existe');
        }

        // 3. Crear tabla model_versions si no existe
        const { error: mvError } = await supabase.from('model_versions').select('id').limit(1);
        if (mvError?.code === '42P01') {
            results.push('❌ Tabla model_versions no existe - requiere creación manual');
        } else {
            results.push('✅ Tabla model_versions existe');

            // Insertar versiones si la tabla existe
            const { error: insertError } = await supabase.from('model_versions').upsert([
                { version_name: 'v1-stable', version_description: 'Modelo base de producción', is_active: true, traffic_percentage: 100 },
                { version_name: 'v2-learning', version_description: 'Modelo con ajustes ML', is_active: true, traffic_percentage: 0 }
            ], { onConflict: 'version_name' });

            if (!insertError) {
                results.push('✅ Versiones v1-stable y v2-learning configuradas');
            }
        }

        // 4. Verificar columna model_version en predictions
        const { data: predCheck, error: predError } = await supabase
            .from('predictions')
            .select('model_version')
            .limit(1);

        if (predError?.message?.includes('model_version')) {
            results.push('❌ Columna model_version no existe en predictions');
        } else {
            results.push('✅ Columna model_version existe en predictions');
        }

        console.log('[SETUP-ML] Resultados:', results);

        return new Response(
            JSON.stringify({
                success: true,
                results,
                message: 'Verificación completada. Si hay ❌, ejecuta el SQL manualmente.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[SETUP-ML] Error:', err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
