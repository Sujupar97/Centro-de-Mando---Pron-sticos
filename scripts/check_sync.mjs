// Verificar desincronización entre jobs y daily_matches
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://nokejmhlpsaoerhddcyc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac');

// Jobs del 8 enero
const { data: jobs } = await supabase.from('analysis_jobs').select('api_fixture_id').gte('created_at', '2026-01-08T00:00:00').lt('created_at', '2026-01-09T00:00:00');
const jobFixtures = new Set(jobs?.map(j => j.api_fixture_id));

// daily_matches del 8 enero
const { data: dm } = await supabase.from('daily_matches').select('api_fixture_id').gte('match_time', '2026-01-08T00:00:00').lt('match_time', '2026-01-08T23:59:59');
const dmFixtures = new Set(dm?.map(m => m.api_fixture_id));

console.log('Jobs tienen', jobFixtures.size, 'fixtures únicos');
console.log('daily_matches tiene', dmFixtures.size, 'fixtures únicos');

// Intersección
const both = [...jobFixtures].filter(f => dmFixtures.has(f));
console.log('Fixtures en AMBOS:', both.length);

// Solo en jobs
const onlyJobs = [...jobFixtures].filter(f => !dmFixtures.has(f));
console.log('Solo en jobs (no en daily_matches):', onlyJobs.length);
if (onlyJobs.length > 0) console.log('Sample:', onlyJobs.slice(0, 3));
