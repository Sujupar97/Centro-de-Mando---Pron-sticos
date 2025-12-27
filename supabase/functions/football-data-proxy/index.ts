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
    const { endpoint, params, fixtureId, homeTeamId, awayTeamId, leagueId, season, fixtureDate, ...otherParams } = await req.json();

    // Compatibilidad: Si 'params' viene explícito, úsalo. Si no, usa el resto de propiedades del body.
    const finalParams = params || otherParams;

    // 1. Obtener y parsear las claves
    const keysString = Deno.env.get('API_FOOTBALL_KEYS');
    if (!keysString) {
      throw new Error("Configuración del servidor incompleta: Faltan claves de API.");
    }
    const apiKeys = keysString.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);

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

      // --- SEASON CALCULATION LOGIC ---
      let calculatedSeason = season; // Fallback to passed param if available
      const dateToCheck = fixtureDate ? new Date(fixtureDate) : (params?.fixtureDate ? new Date(params.fixtureDate) : new Date());

      try {
        console.log(`[PROXY] Calculating season for League ${leagueId} @ ${dateToCheck.toISOString()}`);
        // Fetch League Seasons directly (Single call, fast enough)
        const leagueRes = await fetchWithRotation(`leagues?id=${leagueId}`);

        if (leagueRes && leagueRes.length > 0 && leagueRes[0].seasons) {
          const seasonsList = leagueRes[0].seasons;

          // 1. Precise Match
          const matched = seasonsList.find((s: any) => {
            return dateToCheck >= new Date(s.start) && dateToCheck <= new Date(s.end);
          });

          if (matched) {
            calculatedSeason = matched.year;
            console.log(`[PROXY] Found EXACT season: ${calculatedSeason}`);
          } else {
            // 2. Current fallback
            const current = seasonsList.find((s: any) => s.current);
            if (current) {
              calculatedSeason = current.year;
              console.log(`[PROXY] Using CURRENT season: ${calculatedSeason}`);
            }
          }
        }
      } catch (e) {
        console.warn("[PROXY] Season calc failed, using fallback:", calculatedSeason, e);
      }

      const targetSeason = calculatedSeason || season || 2024; // Ultimate fallback

      // Helper: Soft Fail Wrapper
      const safeFetch = async (path: string) => {
        try {
          return await fetchWithRotation(path);
        } catch (e) {
          console.warn(`[PROXY-SOFT-FAIL] Failed to fetch ${path}:`, e);
          return null;
        }
      };

      // Ejecutar promesas en paralelo para velocidad (usando safeFetch para datos no críticos)
      const [fixture, stats, lineups, events, h2h, standings, teamStatsHome, teamStatsAway, lastHome, lastAway] = await Promise.all([
        fetchWithRotation(`fixtures?id=${fixtureId}`), // Critical: Must succeed
        safeFetch(`fixtures/statistics?fixture=${fixtureId}`),
        safeFetch(`fixtures/lineups?fixture=${fixtureId}`),
        safeFetch(`fixtures/events?fixture=${fixtureId}`),
        safeFetch(`fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`),
        safeFetch(`standings?league=${leagueId}&season=${targetSeason}`),
        safeFetch(`teams/statistics?league=${leagueId}&season=${targetSeason}&team=${homeTeamId}`),
        safeFetch(`teams/statistics?league=${leagueId}&season=${targetSeason}&team=${awayTeamId}`),
        safeFetch(`fixtures?team=${homeTeamId}&last=10`),
        safeFetch(`fixtures?team=${awayTeamId}&last=10`),
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
      const queryString = new URLSearchParams(finalParams).toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;
      resultData = await fetchWithRotation(url);
    }

    return new Response(JSON.stringify(resultData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[PROXY ERROR] Endpoint: ${req.url}`);
    console.error(`[PROXY ERROR] Message: ${error.message}`);
    if (error.stack) console.error(`[PROXY ERROR] Stack: ${error.stack}`);

    return new Response(JSON.stringify({
      error: error.message,
      details: "Check Supabase logs for full stack trace."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})