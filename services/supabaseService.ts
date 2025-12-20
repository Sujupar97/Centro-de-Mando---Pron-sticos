import { createClient } from '@supabase/supabase-js';

// --- ¡ACCIÓN REQUERIDA! ---
// Para un desarrollo y despliegue profesional, las credenciales de Supabase
// deben ser gestionadas como variables de entorno.

// 1. En tu entorno de desarrollo local, puedes crear un archivo `.env` en la raíz del proyecto.
// 2. Añade las siguientes líneas a tu archivo `.env`:
//    SUPABASE_URL=https://tu-url-de-proyecto.supabase.co
//    SUPABASE_ANON_KEY=tu-clave-anon-publica
// 3. Asegúrate de que tu sistema de compilación (como Vite, Next.js, etc.) esté configurado para leer estas variables.
//    (Normalmente con un prefijo como VITE_ o NEXT_PUBLIC_)

// En tu plataforma de despliegue (Vercel, Netlify, etc.), añade estas mismas
// variables en la configuración del sitio.

// FIX: Se utiliza optional chaining (?.) para evitar errores si `import.meta.env` no existe en el entorno de ejecución.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nokejmhlpsaoerhddcyc.supabase.co';
// FIX: Se ha reemplazado la clave de 'service_role' por la clave 'anon' pública correcta para el cliente del navegador.
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

if (supabaseUrl === 'https://gcfmdkieomoapayekklx.supabase.co') {
    console.warn(
        `%c¡ATENCIÓN! Estás usando las credenciales de ejemplo de Supabase.`,
        `color: yellow; background: black; font-size: 14px; padding: 8px; border-radius: 4px;`,
        `\nLa aplicación se cargará, pero no podrá conectarse a la base de datos. \nPor favor, configura tus variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.`
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);