import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testInsert() {
    console.log('Probando inserción manual en reports_v2...');

    // UUID dummy válido
    const dummyJobId = '00000000-0000-0000-0000-000000000000';

    const dummyData = {
        job_id: dummyJobId,
        fixture_id: 12345,
        report_packet: { test: true, reason: "debug_insert_check" },
        created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('reports_v2').insert(dummyData).select();

    if (error) {
        console.error('❌ ERROR INSERTANDO:', error);
    } else {
        console.log('✅ INSERCIÓN EXITOSA:', data);

        // Clean up
        const { error: delError } = await supabase.from('reports_v2').delete().eq('job_id', dummyJobId);
        if (delError) console.error('Error cleanup:', delError);
        else console.log('✅ Clean up exitoso');
    }
}

testInsert();
