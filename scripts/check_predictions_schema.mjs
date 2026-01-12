// Verificar schema REAL de predictions
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://nokejmhlpsaoerhddcyc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac'
);

// Obtener una prediction existente para ver qué columnas tiene
const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .limit(1);

if (error) {
    console.error('Error:', error);
} else if (data && data[0]) {
    console.log('Columnas existentes en predictions:');
    console.log(Object.keys(data[0]).sort().join('\n'));
} else {
    console.log('No hay predictions en la tabla');
}
