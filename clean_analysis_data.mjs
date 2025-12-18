
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Manual env parsing since dotenv might not be present
const envContent = fs.readFileSync('.env', 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        envConfig[key] = val;
    }
});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
// Usamos la Service Role Key si está disponible, sino la Anon Key (aunque DELETE puede requerir Service Role o RLS permisivo)
// Intentaremos leer la SERVICE_ROLE del archivo .env si existe, o usar la anon key y esperar que policies funcionen,
// pero para TRUNCATE/DELETE masivo es mejor Service Role.
// Como no tengo la service role en .env (solo VITE_), asumo que el usuario proveerá o usare la anon con RLS policies.
// REVISIÓN: El usuario NO tiene la service role en .env local usualmente.
// Pero puedo intentar usar la VITE_SUPABASE_ANON_KEY con la funcion RPC si existiera, o intentar delete normal.

// Sin embargo, para no complicar, voy a intentar borrar usando la librería supabase standard.
// Si falla por permisos, le pediré al usuario que corra el SQL en el dashboard.

// MEJOR ESTRATEGIA: Crear un archivo .sql que el usuario pueda ver, pero intentar ejecutarlo via script si tengo credenciales.
// Como vi antes, `apply_rls_policies.mjs` funcionó, voy a ver qué key usó.

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan variables de entorno SUPABASE_URL o KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDatabase() {
    console.log('🧹 Iniciando limpieza de análisis antiguos...');

    try {
        // 1. Borrar analysis_runs (depende de jobs)
        const { error: errorRuns } = await supabase.from('analysis_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (errorRuns) console.error('Error borrando runs:', errorRuns);
        else console.log('✅ Analysis Runs eliminados.');

        // 2. Borrar api_request_logs (depende de jobs)
        const { error: errorLogs } = await supabase.from('api_request_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (errorLogs) console.error('Error borrando logs:', errorLogs);
        else console.log('✅ API Logs eliminados.');

        // 3. Borrar analysis_jobs
        const { error: errorJobs } = await supabase.from('analysis_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (errorJobs) console.error('Error borrando jobs:', errorJobs);
        else console.log('✅ Analysis Jobs eliminados.');

        // 4. Borrar analisis (tabla de caché visual)
        const { error: errorAnalisis } = await supabase.from('analisis').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (errorAnalisis) console.error('Error borrando tabla analisis:', errorAnalisis);
        else console.log('✅ Tabla Analisis eliminada.');

        console.log('🎉 Limpieza completada. Puedes recargar la app.');

    } catch (e) {
        console.error('Excepción:', e);
    }
}

cleanDatabase();
