// Este servicio es un wrapper simple para ser usado exclusivamente por ApiTestRunner.
// Ayuda a mantener la lógica de la herramienta de prueba separada de la lógica principal de la aplicación.

const API_KEY = 'a3d4bac8651cbd3811496ea680bb3ead'; // Clave de API-Football (debe coincidir con la primera de la lista en liveDataService)
const API_BASE = 'https://v3.football.api-sports.io';

/**
 * Llama a un endpoint de API-Football y devuelve la respuesta JSON.
 * Diseñado para la herramienta de prueba para que pueda obtener datos brutos.
 * @param endpoint El endpoint a llamar (ej: 'fixtures?id=12345')
 * @returns La respuesta JSON parseada o null si hay un error.
 */
export const callApiV1ForTest = async <T>(endpoint: string): Promise<T | null> => {
    const url = `${API_BASE}/${endpoint}`;
    const headers = { 'x-apisports-key': API_KEY };
    
    console.log(`[API Test Runner] Llamando a: ${url}`);
    
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[API Test Runner] Error de red para ${url}: ${response.status} ${response.statusText}`, errorText);
            return null;
        }
        const data = await response.json();
        if (data.errors && Object.keys(data.errors).length > 0) {
            console.error('[API Test Runner] Errores de API:', data.errors);
            return null;
        }
        return data.response as T;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`[API Test Runner] Fallo en la llamada o parseo desde ${endpoint}:`, errorMessage);
        return null;
    }
};