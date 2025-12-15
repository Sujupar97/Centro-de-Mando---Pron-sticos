import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

// FIX: Declare global Deno
declare const Deno: any;

const API_BASE = 'https://v3.football.api-sports.io';

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { endpoint, params, fixtureId, homeTeamId, awayTeamId, leagueId, season } = await req.json();

    // 1. Obtener y parsear las claves
    const keysString = Deno.env.get('API_FOOTBALL_KEYS');
    if (!keysString) {
      throw new Error("Configuración del servidor incompleta: Faltan claves de API.");
    }
    const apiKeys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);

    // Función auxiliar para llamar a la API con rotación
    const fetchWithRotation = async (urlPath: string) => {
      let lastError = null;

      for (const key of apiKeys) {
        try {
            console.log(`Intentando con clave: ${key.substring(0, 4)}...`);
            const response = await fetch(`${API_BASE}/${urlPath}`, {
                headers: {
                    'x-apisports-key': key,
                    'Content-Type': 'application/json'
                }
            });

            // Si es 200 OK, verificar errores lógicos de la API (límites)
            if (response.ok) {
                const data = await response.json();
                
                // Verificar si la respuesta contiene errores de límite
                if (data.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0)) {
                    const errorStr = JSON.stringify(data.errors);
                    if (errorStr.includes("limit") || errorStr.includes("suspended")) {
                        console.warn(`Clave ${key.substring(0, 4)} agotada. Rotando...`);
                        continue; // Intentar siguiente clave
                    }
                    // Otros errores (ej: parámetros inválidos) no se resuelven rotando
                     throw new Error(`API Error: ${errorStr}`);
                }
                
                return data.response;
            } else if (response.status === 429) {
                 console.warn(`Clave ${key.substring(0, 4)} rate limited (429). Rotando...`);
                 continue;
            } else {
                 throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

        } catch (e) {
            lastError = e;
            // Si es un error de red o límite, seguimos iterando.
            // Si es un error fatal, podríamos decidir parar, pero por seguridad intentamos todas.
        }
      }
      throw lastError || new Error("Todas las claves API se han agotado o fallaron.");
    };

    let resultData;

    // MODO: FULL DOSSIER (Optimización para reducir round-trips desde el cliente)
    if (endpoint === 'full-dossier') {
        if (!fixtureId || !homeTeamId || !awayTeamId || !leagueId) throw new Error("Faltan parámetros para dossier.");
        
        // Ejecutar promesas en paralelo para velocidad
        const [fixture, stats, lineups, events, h2h, standings, teamStatsHome, teamStatsAway, lastHome, lastAway] = await Promise.all([
             fetchWithRotation(`fixtures?id=${fixtureId}`),
             fetchWithRotation(`fixtures/statistics?fixture=${fixtureId}`),
             fetchWithRotation(`fixtures/lineups?fixture=${fixtureId}`),
             fetchWithRotation(`fixtures/events?fixture=${fixtureId}`),
             fetchWithRotation(`fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`),
             fetchWithRotation(`standings?league=${leagueId}&season=${season}`),
             fetchWithRotation(`teams/statistics?league=${leagueId}&season=${season}&team=${homeTeamId}`),
             fetchWithRotation(`teams/statistics?league=${leagueId}&season=${season}&team=${awayTeamId}`),
             fetchWithRotation(`fixtures?team=${homeTeamId}&last=10`),
             fetchWithRotation(`fixtures?team=${awayTeamId}&last=10`),
        ]);

        resultData = {
            fixture: fixture?.[0]?.fixture,
            league: fixture?.[0]?.league,
            teams: fixture?.[0]?.teams,
            goals: fixture?.[0]?.goals,
            statistics: stats,
            lineups: lineups,
            events: events,
            h2h: h2h,
            standings: standings?.[0]?.league?.standings || null,
            teamStats: { home: teamStatsHome, away: teamStatsAway },
            lastMatches: { home: lastHome, away: lastAway }
        };

    } else {
        // MODO: PROXY SIMPLE (fixtures, live, etc)
        // Construir query string
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        resultData = await fetchWithRotation(url);
    }

    return new Response(JSON.stringify(resultData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error en proxy:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})