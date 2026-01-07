
// Script para re-verificar manualmente el día con errores
// Uso: node reverify_dec29.js

const API_ENDPOINT = "https://sujupar97.supabase.co/functions/v1/daily-results-verifier"; // Ajustar si es local o prod
// NOTA: Para ejecución local necesitamos la URL local o simular el evento. 
// Asumiremos que el usuario puede correr esto contra su instancia local o remota.
// Como no tengo la URL de producción exacta ni las keys a mano en el environment de node "puro" sin dotenv,
// crearé un script Deno que use las variables de entorno si se corre con `deno run`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Faltan variables de entorno SUPABASE_URL o CODE_SERVICE_KEY")
    Deno.exit(1)
}

console.log("🚀 Iniciando reparación de datos para el 29 de Diciembre 2025...")

// Podemos invocar la función directamente vía fetch si está servida, 
// o si estamos en dev local podemos simplemente invocar el endpoint local.
// Asumiremos endpoint local por defecto para desarrollo:
const LOCAL_URL = "http://localhost:54321/functions/v1/daily-results-verifier"

try {
    const res = await fetch(LOCAL_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            date: '2025-12-29'
        })
    })

    const text = await res.text()
    console.log("Status:", res.status)
    console.log("Response:", text)

    if (res.ok) {
        console.log("✅ Reparación completada con éxito.")
    } else {
        console.error("❌ Falló la reparación.")
    }

} catch (e) {
    console.error("Error al conectar con la función edge:", e)
    console.log("Asegúrate de que Supabase local (functions) esté corriendo.")
}
