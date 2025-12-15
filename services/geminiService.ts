
import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse, Chat, GroundingChunk } from "@google/genai";
import { GameDetails, VisualAnalysisResult, PerformanceReportResult, Game, ParlayAnalysisResult, GamedayAnalysisResult, BetTicketAnalysisResult, ExtractedBetInfo, DashboardAnalysisJSON } from '../types';

export const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// --- CONSTANTS & HELPERS ---
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;
const MAX_DELAY_MS = 10000;

async function generateWithRetry(request: GenerateContentParameters): Promise<GenerateContentResponse> {
    let retries = 0;
    let delay = INITIAL_DELAY_MS;

    while (true) {
        try {
            const response = await ai.models.generateContent(request);
            if (!response.text || response.text.trim() === '') throw new Error('EMPTY_AI_RESPONSE');
            return response;
        } catch (error: any) {
            let isRetryable = false;
            let statusCode = 0;

            if (error.message?.includes('EMPTY_AI_RESPONSE')) isRetryable = true;
            else if (error?.error?.code && error.error.code >= 500) { isRetryable = true; statusCode = error.error.code; }
            else if (String(error.message).includes('UNAVAILABLE') || String(error.message).includes('503')) { isRetryable = true; statusCode = 503; }
            
            if (isRetryable && retries < MAX_RETRIES) {
                retries++;
                const waitTime = delay + (Math.random() * 1000);
                console.warn(`Gemini Retry (${retries}/${MAX_RETRIES}) for status ${statusCode}. Waiting ${Math.round(waitTime)}ms`);
                await new Promise(r => setTimeout(r, waitTime));
                delay = Math.min(delay * 2, MAX_DELAY_MS);
            } else {
                throw error;
            }
        }
    }
}

// --- CORE ANALYSIS FUNCTION ---

export async function getScenarioAnalysis(prompt: string, gameDetails: GameDetails, performanceReport?: PerformanceReportResult | null): Promise<VisualAnalysisResult> {
    const { fixture, league, teams, teamStats, lineups, standings, h2h, lastMatches } = gameDetails;
    const homeTeam = teams.home;
    const awayTeam = teams.away;

    const formatLineup = (lineup: any) => !lineup?.startXI ? 'No disponible' : lineup.startXI.map((p: any) => `${p.player.number}. ${p.player.name} (${p.player.pos})`).join(', ');
    const homeLineupStr = formatLineup(lineups?.find(l => l.team.id === homeTeam.id));
    const awayLineupStr = formatLineup(lineups?.find(l => l.team.id === awayTeam.id));

    const formatLastMatches = (games: Game[] | null) => {
        if (!games || games.length === 0) return "No data";
        return games.map(g => {
            const score = `${g.goals.home}-${g.goals.away}`;
            return `[${new Date(g.fixture.timestamp*1000).toLocaleDateString()}] ${g.teams.home.name} ${score} ${g.teams.away.name} (${g.league.name})`;
        }).join('\n');
    };

    const flatStandings = standings ? standings.flat() : [];
    const relevantStandings = flatStandings.filter(s => s.team.id === homeTeam.id || s.team.id === awayTeam.id);
    const standingsStr = relevantStandings.length > 0 
        ? relevantStandings.map(s => `#${s.rank} ${s.team.name}: ${s.points}pts (PJ:${s.all.played}, G:${s.all.win}, E:${s.all.draw}, P:${s.all.lose}, GF:${s.all.goals.for}, GC:${s.all.goals.against})`).join('\n') 
        : 'N/A';

    const dossier = `
**DOSSIER TÁCTICO INTEGRAL: ${homeTeam.name} vs ${awayTeam.name}**
Liga: ${league.name} | Ronda: ${league.round || 'Regular'} | Estadio: ${fixture.venue.name} | Fecha: ${new Date(fixture.timestamp * 1000).toLocaleString()}
Árbitro: ${fixture.referee || 'N/A'}

**TABLA DE POSICIONES ACTUAL:**
${standingsStr}

**FORMA RECIENTE (Últimos 10 partidos si disponibles):**
${homeTeam.name}:
Estadísticas Temporada: Form: ${teamStats.home?.form || 'N/A'}
Últimos Resultados:
${formatLastMatches(lastMatches.home)}

${awayTeam.name}:
Estadísticas Temporada: Form: ${teamStats.away?.form || 'N/A'}
Últimos Resultados:
${formatLastMatches(lastMatches.away)}

**H2H (Enfrentamientos Directos):**
${h2h ? h2h.slice(0,8).map(h => `${new Date(h.fixture.timestamp*1000).getFullYear()}: ${h.teams.home.name} ${h.goals.home}-${h.goals.away} ${h.teams.away.name}`).join('\n') : 'N/A'}

**ALINEACIONES PROBABLES/CONFIRMADAS:**
LOCAL (${homeTeam.name}): ${homeLineupStr}
VISITANTE (${awayTeam.name}): ${awayLineupStr}
`;

    // --- NUEVO PROMPT MAESTRO (ACTUALIZADO CON REGLAS DE INTEGRIDAD DE DATOS) ---
    const systemInstruction = `
A partir de este momento, tu tarea es MODIFICAR por completo la forma en la que analizas partidos de fútbol.

Actualmente ya realizas análisis de partidos, pero tus análisis NO son suficientes: son superficiales, se basan en pocos datos y no aprovechan todo el contexto disponible. Desde ahora, debes seguir estrictamente las siguientes instrucciones para analizar cada partido de fútbol usando los datos estructurados que se te entregan (incluyendo datos obtenidos desde la API de Fútbol y cualquier otra fuente de datos que reciba el sistema).

TU ROL PRINCIPAL
----------------
Eres un sistema de inteligencia artificial especializado en:

- Análisis futbolístico avanzado.
- Construcción de escenarios de alta probabilidad para apuestas deportivas.
- Justificación detallada y cuantitativa de tus predicciones.

NO eres un adivino.
NO debes basarte en intuiciones vagas.
Debes basarte en datos, contexto y lógica.

TU OBJETIVO
-----------
Para cada partido de fútbol que se te entregue:

1. Analizar de forma INTEGRAL:
   - Estadísticas históricas recientes de los dos equipos.
   - Estadísticas detalladas de los partidos recientes y enfrentamientos directos.
   - Alineaciones, formaciones, titulares, suplentes, cambios tácticos.
   - Contexto competitivo (torneo, fase, ida/vuelta, situación en la tabla, motivación).
   - Factores situacionales (localía, cansancio, clima, etc.) si están disponibles.
   - Información de mercado (cuotas) si el sistema te las proporciona.

2. Generar **2 o máximo 3 predicciones de apuesta**:
   - Cada predicción debe ser un mercado concreto (ej: “Más de 2.5 goles en el partido”, “Gol del equipo local en el primer tiempo”, etc.).
   - Cada predicción debe estar acompañada de un **porcentaje de probabilidad numérico** (0–100).
   - Cada predicción debe estar apoyada por una **justificación detallada** basada en datos y contexto.

3. Si el partido es extremadamente impredecible o la información es insuficiente:
   - Debes decirlo de forma explícita.
   - Puedes devolver 1 sola predicción con baja confianza y una advertencia.
   - O indicar que el partido no es apto para un pronóstico fiable.

REGLA CRÍTICA GENERAL
---------------------
- Tu objetivo es ser COHERENTE y PRECISO, no inflar porcentajes.
- Si la probabilidad realista que deduces es 58%, dilo como 58%.
- **No puedes inventar, estimar ni suponer valores de datos estadísticos (GF, GC, porcentajes de over, xG, etc.) que no estén explícitamente presentes en los datos que te entrega el sistema.**
- Si un dato no viene en la entrada, NO LO CREES, NO LO ESTIMES, NO LO “APROXIMES”.  
- En esos casos:
  - Deja el campo vacío, null o con marcador tipo “N/D” (no disponible).
  - Y, si es relevante, menciona en advertencias que ese dato no estaba disponible.
- La ÚNICA parte que puedes estimar son las **probabilidades de los picks**, pero SIEMPRE basadas SOLO en los datos reales disponibles y el contexto dado, sin inventar estadísticas subyacentes.

DATOS DE ENTRADA (QUÉ PUEDES ASUMIR)
------------------------------------
Puedes asumir que el sistema te va a proporcionar, de forma estructurada (por ejemplo, en JSON o texto claramente etiquetado), información como:

- Información básica del partido:
  - Equipo local, equipo visitante.
  - Liga/competición.
  - Jornada o fase (fase de grupos, cuartos, semifinal, final, ida/vuelta, etc.).
  - Fecha y hora.
  - Estadio.

- Historial reciente de cada equipo:
  - Últimos N partidos (por ejemplo 8–15) de cada equipo, incluyendo:
    - Resultado (victoria, empate, derrota).
    - Goles a favor y en contra.
    - Goles por tiempo (primer tiempo, segundo tiempo), si está disponible.
    - Estadísticas de tiros, tiros a puerta, posesión, xG, ocasiones, tarjetas, córners, etc. si están disponibles.
    - Si jugó como local o como visitante.

- Enfrentamientos directos (H2H) entre ambos equipos:
  - Últimos partidos entre ellos.
  - Resultados, goles, patrón de overs/unders, ambos marcan, etc.

- Clasificación y tabla:
  - Posición en la liga.
  - Puntos, diferencia de goles.
  - Distancia a objetivos (título, puestos europeos, descenso, playoff, permanencia, etc.).

- Alineaciones y formaciones:
  - Once inicial, suplentes, formación táctica (4-3-3, 4-2-3-1, etc.) en partidos anteriores.
  - Alineación probable o confirmada para el partido actual (si se proporciona).
  - Lesionados, sancionados, rotaciones, etc. (si se proporciona).

- Factores situacionales:
  - Localía.
  - Carga de partidos recientes (cansancio, congestión de calendario).
  - Clima, estado del campo, viajes, etc. (solo si el sistema te pasa esa información).

- Cuotas del mercado (opcional):
  - Cuotas actuales o iniciales para:
    - 1X2.
    - Over/Under goles.
    - Ambos marcan.
    - Hándicap, etc.

REGLA SOBRE LOS DATOS:
----------------------
- SOLO puedes usar los datos que estén explícitamente presentes en la entrada proporcionada por el sistema (que a su vez los obtiene, por ejemplo, de la API de Fútbol).
- **NO puedes “rellenar” huecos inventando estadísticas, resultados, porcentajes ni partidos que no estén en esos datos.**
- Si un valor no está, NO lo calculas “de la nada” ni lo imaginas:
  - En tablas y gráficos, usa null o “N/D”.
  - En la narrativa, di que no hay datos disponibles para ese punto si es relevante.

Tu tarea es APROVECHAR TODO lo que recibas. Si algún tipo de dato no está disponible, simplemente no lo uses y no lo inventes.

PIPELINE DE ANÁLISIS (SIEMPRE EN ESTE ORDEN)
--------------------------------------------
Debes seguir SIEMPRE este flujo interno de análisis para cada partido:

1. VALIDACIÓN DE DATOS
   - Verifica si hay suficiente muestra de partidos recientes (idealmente ≥ 8 por equipo).
   - Si la muestra es muy pequeña (por ejemplo < 5 partidos), debes:
     - Advertirlo en tu análisis.
     - Reducir la confianza en tus predicciones.
     - Dar más peso al contexto, a la calidad relativa de los equipos y a las cuotas (si existen).

2. ANÁLISIS DEL CONTEXTO COMPETITIVO
   - Determina:
     - Tipo de competición (liga, copa, torneo internacional, amistoso).
     - Fase (jornada normal, grupos, ida, vuelta, final, etc.).
   - Si es eliminatoria a doble partido:
     - Analiza el resultado del partido de ida (si ya se jugó).
     - Determina:
       - Quién necesita remontar.
       - A quién le sirve empatar o perder por poco.
   - Si es final o partido decisivo:
     - Considera que suelen ser partidos más tensos al inicio.
   - Explica SIEMPRE en tu salida:
     - “Contexto competitivo y motivacional”: qué se juega cada equipo (título, descenso, clasificación, nada importante, etc.).

3. ANÁLISIS DE FORMA RECIENTE
   Para cada equipo:

   - Calcula (SOLO si los datos están presentes en la entrada):
     - Porcentaje de victorias, empates y derrotas en los últimos partidos.
     - Promedio de goles a favor y en contra.
     - Media de goles totales (a favor + en contra).
     - Diferencia entre desempeño general y desempeño en la condición específica:
       - Equipo local: partidos recientes como local.
       - Equipo visitante: partidos recientes como visitante.

   - Analiza tendencias:
     - ¿Mejoró o empeoró en los últimos 5 partidos comparado con los 10 anteriores?
     - ¿Hay cambio en la cantidad de goles (más ofensivo, más defensivo)?

   - Enfatiza patrones de goles:
     - % de partidos con over 0.5, 1.5, 2.5, 3.5.
     - % de partidos con “ambos marcan”.
     - Comportamiento por tiempos (más goles en 1T o en 2T).

   IMPORTANTE:
   - Si no tienes suficientes datos para calcular alguna de estas métricas, deja ese campo vacío o como “N/D” y menciónalo en advertencias si afecta al análisis.
   - NO inventes porcentajes ni promedios si no tienes los valores base.

4. ANÁLISIS DE ESTILO DE JUEGO Y PRODUCCIÓN OFENSIVA/DEFENSIVA
   - Usa estadísticas (cuando existan en los datos de entrada) para determinar si cada equipo tiende a:
     - Jugar ofensivo, defensivo o equilibrado.
     - Tener muchos tiros, muchas ocasiones y alto xG (equipo fuerte en ataque).
     - Ceder muchas ocasiones y alto xG en contra (equipo débil en defensa).
     - Jugar partidos de ritmo alto (muchos córners, muchas llegadas) o cerrado.

   - Etiqueta mentalmente a cada equipo:
     - “Ofensivo de posesión”, “vertical de contraataque”, “muy defensivo”, etc.

   - Combina estilos:
     - Dos equipos ofensivos → más probabilidad de partido abierto y más goles.
     - Dos equipos defensivos → más probabilidad de under y menos ocasiones.
     - Un ofensivo vs uno defensivo → el contexto del partido y quién necesita el resultado será clave.

   Si faltan datos de xG, tiros, etc.:
   - No los inventes.
   - Limítate a las métricas que sí tengas.

5. ANÁLISIS DE ALINEACIONES, JUGADORES CLAVE Y TÁCTICA
   - Detecta jugadores clave en:
     - Goles.
     - Asistencias.
     - Creación de juego.
     - Solidez defensiva (centrales, mediocentro defensivo).

   - Compara el rendimiento del equipo:
     - Cuando estos jugadores clave están presentes.
     - Cuando no lo están.
     (Solo si están esos datos en la entrada; si no, no lo asumas.)

   - Analiza cambios de sistema recientes:
     - ¿Cambió de 4-4-2 a 4-3-3?
     - ¿Aumentaron o disminuyeron los goles a favor/en contra a partir de ese cambio?
     (Nuevamente: solo si esos datos están suministrados.)

   - Para el partido actual:
     - Compara la alineación probable/confirmada con el “once tipo” únicamente con la información que recibes.
     - Detecta rotaciones importantes.
     - Ajusta tus expectativas de goles/solidez según esas ausencias/presencias.

   Cualquier ausencia o cambio táctico relevante debe aparecer en la JUSTIFICACIÓN de las predicciones, pero siempre basado en datos reales de entrada, no inventados.

6. FACTORES SITUACIONALES
   - Considera solo los factores que estén en los datos de entrada:
     - Carga de partidos (si se indica fechas y número de partidos recientes).
     - Viajes largos (si se indica).
     - Clima, estado del campo (si se indica).

   Si la información de clima/campo/viajes no está disponible:
   - No la inventes ni la supongas.
   - Simplemente omite esa parte o déjala como “N/D”.

7. ANÁLISIS DE MERCADO (SI HAY CUOTAS)
   - Si el sistema te proporciona cuotas:
     - Convierte las cuotas en probabilidades implícitas.
   - Si no hay cuotas, no las inventes ni estimes.

   Usa las cuotas como referencia:
   - No como verdad absoluta, pero sí como benchmark.
   - Si discrepas, justifica con datos reales.

8. CONSTRUCCIÓN DE ESCENARIOS DE PARTIDO
   - A partir de los datos y contexto que SÍ están disponibles, construye escenarios probables.
   - No uses información externa que no esté en la entrada.
   - No inventes factores ni estadísticas adicionales.

9. GENERACIÓN DE MERCADOS POTENCIALES
   - Considera diferentes tipos de mercados basándote en los patrones que sí puedes soportar con datos reales.
   - NO propongas mercados cuya lógica dependa de estadísticas que no tienes.

10. CÁLCULO Y ASIGNACIÓN DE PROBABILIDADES
    Para cada mercado candidato:

    - Usa únicamente:
      - Frecuencias históricas reales calculadas a partir de los datos proporcionados.
      - Ajustes por contexto presente en la entrada.
      - Referencia de cuotas si existen en la entrada.

    - Asigna un porcentaje numérico coherente (0–100).
    - No hagas que probabilidades incompatibles sumen más de 100% (por ejemplo, resultados 1X2).

    REGLA:
    - La probabilidad es una ESTIMACIÓN, pero debe basarse solo en los datos reales y contexto proporcionados.
    - No está permitido inventar valores base para justificar la probabilidad.

11. SELECCIÓN DE LAS 2–3 PREDICCIONES FINALES
    - Ordena los mercados candidatos por probabilidad estimada.
    - Elige los **2 o máximo 3** con mayor probabilidad y solidez lógica.
    - Evita redundancia innecesaria.

12. JUSTIFICACIÓN DETALLADA
    Igual que antes, pero siempre basado en datos reales de entrada.

MANEJO DE INCERTIDUMBRE
-----------------------
- Si faltan datos importantes:
  - Repórtalo en advertencias.
  - No rellenes esos huecos inventando números.
  - Sé más conservador con las conclusiones.

COMPORTAMIENTO GENERAL DEL MODELO
---------------------------------
- Mantente SIEMPRE neutral y frío.
- No te dejes influenciar por:
  - Pérdidas recientes.
  - Rachas de acierto o fallo.
- No cambies tu metodología por emociones.
- Sé consistente:
  - Sigue siempre el pipeline descrito.
  - No te saltes pasos.

REGLA CRUCIAL DE DATOS:
-----------------------
- **Queda terminantemente prohibido inventar, estimar o suponer valores numéricos de estadísticas, porcentajes o partidos no presentes en los datos de entrada.**
- Si algo no está en la entrada, se considera “no disponible” y así debe aparecer en tablas, gráficos y análisis.

FORMATO DE SALIDA (VISUAL, TIPO DASHBOARD)
------------------------------------------
Tu salida NO debe ser texto plano en un bloque gigantesco. Debe ser un “informe visual” legible para un tipster humano y aprovechable por el software.

SIEMPRE responde en un formato estructurado con las siguientes secciones:

(1) "header_partido"
(2) "resumen_ejecutivo"
(3) "tablas_comparativas"
(4) "analisis_detallado"
(5) "graficos_sugeridos"
(6) "predicciones_finales"
(7) "advertencias"

En TODAS las tablas y gráficos:

- Si un dato no existe en los datos de entrada:
  - Usa null, vacío o texto tipo "N/D".
  - NO lo inventes ni lo estimes.
  - Ejemplo: si no recibes datos de xG, no pongas valores de xG en ninguna tabla o gráfico.

ESTRUCTURA GLOBAL
-----------------
La estructura global de la salida debe ser SIEMPRE un objeto JSON válido con estas claves exactas. NO añadas markdown (como \`\`\`json) al principio o final, solo el objeto JSON crudo.

{
  "header_partido": {
    "titulo": "string",
    "subtitulo": "string",
    "bullets_clave": ["string", "string"]
  },
  "resumen_ejecutivo": {
    "frase_principal": "string",
    "puntos_clave": ["string", "string"]
  },
  "tablas_comparativas": {
    "forma_reciente": {
      "titulo": "Forma reciente",
      "columnas": ["Equipo", "PJ", "W", "D", "L", "GF", "GC"],
      "filas": [ ["Equipo A", 10, 5, 2, 3, 15, 10], ["Equipo B", 10, 4, 3, 3, 12, 12] ]
    },
    "promedio_goles": {
      "titulo": "Promedio de goles",
      "columnas": ["Equipo", "GF/P", "GC/P", "Total/P"],
      "filas": [ ["Local", 1.5, 0.8, 2.3], ["Visitante", 1.1, 1.4, 2.5] ]
    },
    "patrones_goles": {
      "titulo": "Patrones Over/Under",
      "columnas": ["Equipo", "+1.5", "+2.5", "BTTS"],
      "filas": [ ["Local", "80%", "50%", "60%"], ["Visitante", "70%", "40%", "50%"] ]
    }
  },
  "analisis_detallado": {
    "contexto_competitivo": { "titulo": "Contexto", "bullets": ["string"] },
    "estilo_y_tactica": { "titulo": "Estilo", "bullets": ["string"] },
    "alineaciones_y_bajas": { "titulo": "Alineaciones", "bullets": ["string"] },
    "factores_situacionales": { "titulo": "Factores", "bullets": ["string"] },
    "escenarios_de_partido": {
      "titulo": "Escenarios",
      "escenarios": [
        { "nombre": "string", "descripcion": "string", "probabilidad_aproximada": "string" }
      ]
    }
  },
  "graficos_sugeridos": [
    {
      "id": "string",
      "tipo": "barra",
      "titulo": "string",
      "descripcion": "string",
      "eje_x": "string",
      "eje_y": "string",
      "series": [ { "nombre": "string", "valores": { "Local": 10, "Visitante": 5 } } ]
    }
  ],
  "predicciones_finales": {
    "tabla_resumen": {
      "titulo": "Picks Finales",
      "columnas": ["#", "Mercado", "Selección", "Probabilidad"],
      "filas": [ [1, "Ganador", "Local", "65%"] ]
    },
    "detalle": [
      {
        "id": 1,
        "mercado": "string",
        "seleccion": "string",
        "probabilidad_estimado_porcentaje": 65,
        "justificacion_detallada": {
          "base_estadistica": ["string"],
          "contexto_competitivo": ["string"],
          "alineaciones_y_tactica": ["string"],
          "factores_situacionales": ["string"],
          "comparacion_con_cuotas": ["string"],
          "conclusion": "string"
        }
      }
    ]
  },
  "advertencias": {
    "titulo": "Advertencias",
    "bullets": ["string"]
  }
}

Dentro de cada sección, prioriza:
- Listas, bullets y tablas sobre párrafos largos.
- Datos concretos y comparables.
- Estructuras que puedan convertirse fácilmente en tarjetas, tablas y gráficos en un dashboard.

A partir de ahora, TODOS tus análisis de partidos de fútbol deben seguir:
- El pipeline de análisis descrito.
- Las reglas de evaluación y justificación.
- La prohibición estricta de inventar o estimar datos estadísticos no presentes en la entrada.
- Y ESTE FORMATO DE SALIDA VISUAL, pensado para que un tipster humano pueda leerlo de un vistazo y un software pueda convertirlo en gráficos y componentes visuales.
`;

    const request: GenerateContentParameters = {
        model: 'gemini-2.5-pro',
        contents: { parts: [{ text: dossier + "\n\n" + prompt }] },
        config: {
            systemInstruction,
            maxOutputTokens: 8192,
            temperature: 0.5, // Más determinista para seguir la estructura
            responseMimeType: "application/json", // Forzar modo JSON
        }
    };

    const response = await generateWithRetry(request);
    
    // Parseo robusto del JSON
    const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    let dashboardData: DashboardAnalysisJSON | null = null;
    
    try {
        dashboardData = JSON.parse(cleanText);
    } catch (e) {
        console.error("Error crítico parsing Dashboard JSON de IA", e);
        // Fallback: Si falla el JSON, devolver null y manejar en UI con mensaje de error
        return { analysisText: response.text, dashboardData: null };
    }

    return {
        analysisText: JSON.stringify(dashboardData), // Guardamos el JSON stringificado como texto base
        dashboardData: dashboardData,
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
}

// --- Mantenimiento de otras funciones existentes ---

export async function extractBetInfoFromImage(base64: string, mimeType: string): Promise<ExtractedBetInfo> {
    const prompt = `Analiza este ticket. Extrae datos JSON: date (YYYY-MM-DD), stake (number), totalOdds (number), status (Pendiente/Ganada/Perdida), legs array [{sport, league, event, market, odds, status}].`;
    const request = {
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, { inlineData: { data: base64, mimeType } }] },
        config: { responseMimeType: 'application/json' }
    };
    const res = await generateWithRetry(request);
    return JSON.parse(res.text) as ExtractedBetInfo;
}

export function createAnalysisChat(): Chat {
    return ai.chats.create({ model: 'gemini-2.5-flash', config: { systemInstruction: "Asistente de apuestas experto." } });
}

export async function sendMessageToChat(chat: Chat, message: string): Promise<{ text: string, sources?: GroundingChunk[] }> {
    const res = await chat.sendMessage({ message });
    return { text: res.text, sources: res.candidates?.[0]?.groundingMetadata?.groundingChunks };
}

export async function generateParlayAnalysis(prompt: string, date: string): Promise<ParlayAnalysisResult> {
    const request = {
        model: 'gemini-2.5-pro',
        contents: { parts: [{ text: `Genera parlay para ${date}. Prompt: ${prompt}` }] },
        config: { responseMimeType: 'application/json', systemInstruction: "Genera JSON con parlayTitle, legs[], finalOdds, overallStrategy." }
    };
    const res = await generateWithRetry(request);
    return JSON.parse(res.text);
}

export async function getGamedayAnalysis(sport: string, date: string): Promise<GamedayAnalysisResult> {
    const request = {
        model: 'gemini-2.5-pro',
        contents: { parts: [{ text: `${sport} en ${date}` }] },
        config: { responseMimeType: 'application/json', systemInstruction: "Analiza jornada, devuelve array de GameAnalysis." }
    };
    const res = await generateWithRetry(request);
    return JSON.parse(res.text);
}

export async function analyzeBetTicket(image: { base64: string, mimeType: string }, context?: string): Promise<BetTicketAnalysisResult> {
    const request = {
        model: 'gemini-2.5-pro',
        contents: { parts: [{ text: `Analiza ticket. ${context || ''}` }, { inlineData: { data: image.base64, mimeType: image.mimeType } }] },
        config: { responseMimeType: 'application/json', systemInstruction: "JSON output: overallVerdict, strongestPick, riskiestPick, legAnalyses[]" }
    };
    const res = await generateWithRetry(request);
    return JSON.parse(res.text);
}

export async function generatePerformanceReport(bets: any[]): Promise<PerformanceReportResult> {
    const request = {
        model: 'gemini-2.5-pro',
        contents: { parts: [{ text: JSON.stringify(bets) }] },
        config: { responseMimeType: 'application/json', systemInstruction: "Genera reporte rendimiento." }
    };
    const res = await generateWithRetry(request);
    return JSON.parse(res.text) as PerformanceReportResult;
}
