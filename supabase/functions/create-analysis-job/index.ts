import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenerativeAI } from "https://esm.sh/@google/genai@0.1.2" // Versión compatible edge
import { corsHeaders } from '../_shared/cors.ts'

// FIX: Declare global Deno
declare const Deno: any;

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { api_fixture_id, timezone } = await req.json();

    // 1. Configuración de Clientes
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 2. Crear el Job en DB (Estado: Ingesting)
    const { data: job, error: jobError } = await supabase
      .from('analysis_jobs')
      .insert({
        api_fixture_id,
        status: 'ingesting',
        progress_jsonb: { step: 'Iniciando ingestión de datos...', completeness_score: 5, fetched_items: 0, total_items: 0 }
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // --- LÓGICA DE ROTACIÓN DE CLAVES (Compartida conceptualmente) ---
    const keysString = Deno.env.get('API_FOOTBALL_KEYS');
    if (!keysString) throw new Error("Faltan claves de API Football");
    const apiKeys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);

    const fetchFootballData = async (path: string) => {
       for (const key of apiKeys) {
           try {
               const res = await fetch(`${API_FOOTBALL_BASE}/${path}`, { headers: { 'x-apisports-key': key } });
               if (res.ok) {
                   const json = await res.json();
                   if (!json.errors || Object.keys(json.errors).length === 0) return json.response;
                   // Si hay errores de límite, continuar loop
               }
           } catch(e) { continue; }
       }
       return null; // Fallo total
    };

    // 3. Ingesta de Datos (Paralela)
    const [fixtureData, statsData, lineupsData, h2hData] = await Promise.all([
        fetchFootballData(`fixtures?id=${api_fixture_id}`),
        fetchFootballData(`fixtures/statistics?fixture=${api_fixture_id}`),
        fetchFootballData(`fixtures/lineups?fixture=${api_fixture_id}`),
        // Nota: Necesitamos los IDs de equipos para H2H, lo hacemos en cascada simple o asumimos riesgo
        // Para simplificar esta demo, hacemos un fetch preliminar si es necesario, pero aquí asumimos flujo optimista.
        // En prod real, primero obtenemos fixtureData, leemos IDs y luego lanzamos el resto.
        Promise.resolve(null) 
    ]);

    if (!fixtureData || fixtureData.length === 0) {
        await supabase.from('analysis_jobs').update({ status: 'failed', last_error: 'No se encontró el partido' }).eq('id', job.id);
        throw new Error("Partido no encontrado en API externa");
    }

    const game = fixtureData[0];
    const homeId = game.teams.home.id;
    const awayId = game.teams.away.id;

    // Fetch dependiente de IDs
    const [h2hReal, lastHome, lastAway, standings] = await Promise.all([
        fetchFootballData(`fixtures/headtohead?h2h=${homeId}-${awayId}`),
        fetchFootballData(`fixtures?team=${homeId}&last=10`),
        fetchFootballData(`fixtures?team=${awayId}&last=10`),
        fetchFootballData(`standings?league=${game.league.id}&season=${game.league.season}`)
    ]);

    // Actualizar progreso
    await supabase.from('analysis_jobs').update({ 
        status: 'analyzing', 
        completeness_score: 85,
        progress_jsonb: { step: 'Datos listos. Consultando IA...', completeness_score: 85 }
    }).eq('id', job.id);

    // 4. Preparar Prompt para Gemini
    const dossier = {
        game, stats: statsData, lineups: lineupsData, h2h: h2hReal, 
        lastHome, lastAway, standings: standings?.[0]?.league?.standings
    };
    
    // (Aquí iría la lógica de construcción del prompt gigante que tenías en el frontend, resumida)
    const prompt = `Analiza este partido JSON y devuelve un JSON con estructura DashboardAnalysisJSON. Datos: ${JSON.stringify(dossier).substring(0, 30000)}`; 
    // Nota: Recortamos JSON para evitar límites de tokens si es gigante, o usamos Gemini 1.5 Pro que aguanta más.

    // 5. Llamar a Gemini
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Usamos Flash para velocidad en Edge Functions
    
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });
    
    const aiText = result.response.text();
    const aiJson = JSON.parse(aiText);

    // 6. Guardar Resultados
    await supabase.from('analysis_runs').insert({
        job_id: job.id,
        fixture_id: api_fixture_id.toString(),
        summary_pre_text: "Análisis generado por Edge Function",
        report_pre_jsonb: aiJson
    });

    await supabase.from('analysis_jobs').update({ 
        status: 'done', 
        completeness_score: 100,
        progress_jsonb: { step: 'Finalizado', completeness_score: 100 }
    }).eq('id', job.id);

    // Guardar en tabla principal de análisis (caché visual)
    await supabase.from('analisis').upsert({
        partido_id: api_fixture_id,
        resultado_analisis: { dashboardData: aiJson, analysisText: "Generado vía Job System" }
    });

    return new Response(JSON.stringify({ job_id: job.id }), { headers: corsHeaders });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})