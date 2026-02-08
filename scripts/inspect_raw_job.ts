
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const JOB_ID = "4fe24105-d1f1-4d72-9d66-84fd1b3ac3cd"; // From latest user screenshot

async function inspectJob() {
    console.log(`\n🔍 INSPECTING JOB: ${JOB_ID}`);

    const { data, error } = await supabase
        .from('reports_v2')
        .select('*')
        .eq('job_id', JOB_ID)
        .single();

    if (error) {
        console.error("❌ DB Error:", error);
        return;
    }

    if (!data) {
        console.error("❌ No report found for this Job ID.");
        return;
    }

    console.log("✅ Report Found!");
    console.log("---------------------------------------------------");
    console.log(JSON.stringify(data.report_packet, null, 2));
    console.log("---------------------------------------------------");
}

inspectJob();
