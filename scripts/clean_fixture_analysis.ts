import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanFixture(fixtureId: number) {
    console.log(`🧹 Limpiando análisis para fixture ${fixtureId}...`);

    // Delete from analysis_jobs_v2
    const { error: e1, count: c1 } = await supabase
        .from('analysis_jobs_v2')
        .delete()
        .eq('fixture_id', fixtureId);
    console.log('analysis_jobs_v2:', e1 ? `Error: ${e1.message}` : 'Eliminado');

    // Delete from analisis
    const { error: e2 } = await supabase
        .from('analisis')
        .delete()
        .eq('partido_id', fixtureId);
    console.log('analisis:', e2 ? `Error: ${e2.message}` : 'Eliminado');

    // Delete from reports_v2
    const { error: e3 } = await supabase
        .from('reports_v2')
        .delete()
        .eq('fixture_id', fixtureId);
    console.log('reports_v2:', e3 ? `Error: ${e3.message}` : 'Eliminado');

    console.log(`\n✅ Fixture ${fixtureId} limpiado. Ahora puedes analizarlo con V3.`);
}

// Porto vs Rangers - fixture 1451285
cleanFixture(1451285);
