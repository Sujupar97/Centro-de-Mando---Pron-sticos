
// Script para invocar la Edge Function en PRODUCCIÓN y ver el error real
const fetch = require('node-fetch'); // Needs node-fetch or Node 18+

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
const FUNCTION_NAME = 'v2-create-job-sportmonks';
// Usamos la anon key pública (normalmente visible en frontend) o service role si la tenemos. 
// Como no tengo la anon key a mano fácil en las vars de entorno del usuario (están en .env pero no las he leído explícitamente recientemente), 
// usaré el token de usuario del chat anterior si sigue vivo, o pediré al usuario que lo ponga.
// Espera... el usuario proveyó un token sbp_...
// Ese token es para DEPLOY. Para invocar necesitamos la ANON KEY o un JWT válido de usuario.
// Voy a intentar leer el .env primero para sacar la ANON_KEY.

async function run() {
    console.log("Primero leeré .env para obtener la clave anon...");
}
run();
