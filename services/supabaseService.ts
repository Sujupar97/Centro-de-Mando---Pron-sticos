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

// FIX: Forzamos el uso de las credenciales "quemadas" que sabemos que funcionan, ignorando las variables de entorno de Netlify
// ya que el usuario reporta que en local (con estas credenciales) funciona bien, pero en Netlify (con variables posiblemente erróneas) falla.
const supabaseUrl = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

// (Bloque de advertencia eliminado ya que las credenciales son válidas y forzadas)

export const supabase = createClient(supabaseUrl, supabaseAnonKey);