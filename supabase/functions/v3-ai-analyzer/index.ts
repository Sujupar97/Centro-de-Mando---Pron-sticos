// supabase/functions/v3-ai-analyzer/index.ts
// MOTOR V3: IA PURO - Gemini hace TODO el análisis y toma de decisiones
// Elimina dependencia de motores matemáticos B, C, D

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import JSON5 from "https://esm.sh/json5@2.2.3"
import { corsHeaders } from '../_shared/cors.ts'

const ENGINE_VERSION = '3.0.0';
const PROMPT_VERSION = '3.0.0';

// Lista completa de mercados a evaluar
const MARKETS_CATALOG = `
═══ MERCADOS DISPONIBLES PARA EVALUAR ═══

RESULTADO (1X2):
- Victoria Local
- Empate  
- Victoria Visitante
- Doble Oportunidad: 1X (Local o Empate)
- Doble Oportunidad: X2 (Empate o Visitante)
- Doble Oportunidad: 12 (Local o Visitante)
- Empate Apuesta No (DNB) Local
- Empate Apuesta No (DNB) Visitante

GOLES TOTALES:
- Over 0.5 Goles
- Under 0.5 Goles
- Over 1.5 Goles
- Under 1.5 Goles
- Over 2.5 Goles
- Under 2.5 Goles
- Over 3.5 Goles
- Under 3.5 Goles
- Over 4.5 Goles
- Under 4.5 Goles

AMBOS ANOTAN (BTTS):
- Ambos Anotan: Sí
- Ambos Anotan: No
- BTTS + Over 2.5
- BTTS + Under 3.5

GOLES POR EQUIPO:
- Local Over 0.5 Goles
- Local Over 1.5 Goles
- Local Over 2.5 Goles
- Visitante Over 0.5 Goles
- Visitante Over 1.5 Goles
- Visitante Over 2.5 Goles
- Local Anota: Sí
- Local Anota: No
- Visitante Anota: Sí
- Visitante Anota: No

GOLES POR TIEMPO:
- Gol en 1er Tiempo: Sí
- Gol en 1er Tiempo: No
- Gol en 2do Tiempo: Sí
- 1er Tiempo Over 0.5
- 1er Tiempo Over 1.5
- 2do Tiempo Over 0.5
- 2do Tiempo Over 1.5
- Mayor Cantidad Goles: 1er Tiempo
- Mayor Cantidad Goles: 2do Tiempo
- Mayor Cantidad Goles: Igual

CORNERS:
- Corners Over 7.5
- Corners Over 8.5
- Corners Over 9.5
- Corners Over 10.5
- Corners Over 11.5
- Corners Under 9.5
- Corners Under 10.5

TARJETAS:
- Tarjetas Over 2.5
- Tarjetas Over 3.5
- Tarjetas Over 4.5
- Tarjeta Roja: Sí
- Tarjeta Roja: No

HANDICAP ASIÁTICO:
- Local -0.5
- Local -1.0
- Local -1.5
- Visitante +0.5
- Visitante +1.0
- Visitante +1.5

ESPECIALES:
- Primer Gol: Local
- Primer Gol: Visitante
- Sin Goles (0-0)
`;

// Helper function to normalize prediction fields from AI output
function normalizePrediction(p: any, index: number) {
    const probRaw = p.probabilidad_calculada_porcentaje || p.probabilidad_derbix || p.probabilidad_implicita || p.probabilidad || "50%";
    const prob = typeof probRaw === 'string' ? parseFloat(probRaw.replace('%', '').replace('+', '')) : probRaw;
    const edgeRaw = p.edge_porcentaje || p.edge_calculado || p.edge || "0%";
    const edge = typeof edgeRaw === 'string' ? parseFloat(edgeRaw.replace('%', '').replace('+', '')) : edgeRaw;
    const odds = p.cuota_actual || p.cuota_estimada || p.cuota_referencia || null;
    const justText = p.razonamiento || p.justificacion?.estadistica || p.justificacion?.tactica || "Análisis IA completado";

    return {
        id: `${p.mercado}_${p.seleccion}`.replace(/\s/g, '_'),
        mercado: p.mercado || "Mercado",
        seleccion: p.seleccion || "Seleccion",
        probabilidad_estimado_porcentaje: prob || 50,
        odds: odds,
        edge: edge || 0,
        nivel_confianza: p.nivel_confianza || 'MEDIA',
        stake_recomendado: p.stake_recomendado || 1,
        justificacion_detallada: {
            base_estadistica: [typeof justText === 'string' ? justText.substring(0, 300) : ''],
            contexto_competitivo: [p.tipo || p.nivel_confianza || 'Análisis Profundo'],
            conclusion: typeof justText === 'string' && justText.length > 300 ? justText.substring(300) : 'Valor matemático identificado.'
        }
    };
}

// Helper for top_oportunidades
function normalizeOpportunity(p: any) {
    const probRaw = p.probabilidad_calculada_porcentaje || p.probabilidad_derbix || p.probabilidad_implicita || "50%";
    const prob = typeof probRaw === 'string' ? parseFloat(probRaw.replace('%', '')) : probRaw;
    const edgeRaw = p.edge_porcentaje || p.edge_calculado || p.edge || "0%";
    const edge = typeof edgeRaw === 'string' ? parseFloat(edgeRaw.replace('%', '').replace('+', '')) : edgeRaw;
    const odds = p.cuota_actual || p.cuota_estimada || p.cuota_referencia || null;
    const probImpl = p.probabilidad_implicita;
    const probTipica = typeof probImpl === 'string' ? parseFloat(probImpl.replace('%', '')) : (p.probabilidad_implicita_porcentaje || 50);

    return {
        mercado: p.mercado,
        categoria: p.mercado?.split(' ')[0]?.toUpperCase() || 'OTRO',
        seleccion: p.seleccion,
        cuota: odds,
        probabilidad_calculada: prob || 50,
        probabilidad_tipica: probTipica,
        confianza: p.nivel_confianza || p.confianza || 'MEDIA',
        value_score: edge || 0
    };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const startTime = Date.now();
    const GEMINI_MODEL = 'gemini-3-pro-preview';
    const ENGINE_VERSION = 'V4-MASTERMIND';

    try {
        const { job_id, fixture_id, payload } = await req.json();
        if (!job_id || !fixture_id || !payload) {
            throw new Error('job_id, fixture_id, and payload are required');
        }

        console.log(`[V4-MASTERMIND] Starting analysis using ${GEMINI_MODEL} for fixture: ${fixture_id}`);

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

        const supabase = createClient(sbUrl, sbKey);

        // Update job status
        await supabase
            .from('analysis_jobs_v2')
            .update({ status: 'analyzing', current_motor: ENGINE_VERSION })
            .eq('id', job_id);

        // ═══════════════════════════════════════════════════════════════
        // EXTRAER DATOS (DEEP DIVE)
        // ═══════════════════════════════════════════════════════════════
        const match = payload.match || {};
        const datasets = payload.datasets || {};
        const odds = payload.odds || null;

        const homeTeam = match.teams?.home?.name || 'Local';
        const awayTeam = match.teams?.away?.name || 'Visitante';
        const leagueName = match.competition?.name || 'Liga';

        // V6 UPGRADE: Format matches separated by venue (HOME vs AWAY)
        // Uses was_home field from normalizeDetailedMatchHistory
        const formatMatchForPrompt = (m: any, index: number) => {
            // Determine correct result from team's perspective
            const teamWon = m.was_home
                ? m.score_home > m.score_away
                : m.score_away > m.score_home;
            const teamLost = m.was_home
                ? m.score_home < m.score_away
                : m.score_away < m.score_home;
            const resultText = teamWon ? '✓ VICTORIA' : teamLost ? '✗ DERROTA' : '= EMPATE';

            // Score from team's perspective
            const teamGoals = m.was_home ? m.score_home : m.score_away;
            const oppGoals = m.was_home ? m.score_away : m.score_home;

            const d = m.details || {};
            const statsLine = `   📊 Stats: ${d.possession || '?'}% Pos | ${d.shots_on_target || 0}/${d.shots_total || 0} Tiros | ${d.corners || 0} Corners | ${d.saves || 0} Atajadas`;
            const oppStatsLine = `   📊 Rival: ${d.opponent_possession || '?'}% Pos | ${d.opponent_shots_on_target || 0}/${d.opponent_shots || 0} Tiros | ${d.opponent_corners || 0} Corners`;
            const cardsLine = `   🟨 Disciplina: ${d.yellow_cards || 0} Amarillas | ${d.red_cards || 0} Rojas | ${d.fouls || 0} Faltas`;
            const eventsLine = d.goal_timings ? `   ⚽ Minutos de gol: ${d.goal_timings}` : '';
            const formLine = `   🎯 Formación: ${d.formation_used || '?'} (vs ${d.opponent_formation || '?'})`;

            const lines = [
                `${index + 1}. ${m.date} vs ${m.opponent_name || m.away_team}: ${teamGoals}-${oppGoals} ${resultText}`,
                statsLine,
                oppStatsLine,
                cardsLine,
                formLine
            ];
            if (eventsLine) lines.push(eventsLine);

            return lines.join('\n');
        };

        const formatDeepStatsByVenue = (matches: any[], teamName: string) => {
            if (!matches || matches.length === 0) return 'Sin datos detallados disponibles.';

            // Separate by venue
            const homeMatches = matches.filter((m: any) => m.was_home === true);
            const awayMatches = matches.filter((m: any) => m.was_home === false);

            // Calculate venue stats
            // Calculate venue stats - GLOBAL vs RECENT
            const calcStats = (arr: any[]) => {
                const wins = arr.filter(m => (m.was_home ? m.score_home > m.score_away : m.score_away > m.score_home)).length;
                const draws = arr.filter(m => m.score_home === m.score_away).length;
                const losses = arr.length - wins - draws;
                const goalsFor = arr.reduce((sum, m) => sum + (m.was_home ? m.score_home : m.score_away), 0);
                const goalsAgainst = arr.reduce((sum, m) => sum + (m.was_home ? m.score_away : m.score_home), 0);
                return { wins, draws, losses, goalsFor, goalsAgainst, total: arr.length };
            };

            const globalStats = calcStats(matches);

            // RECENT FORM (Last 6 matches only)
            const recentMatches = matches.slice(0, 6);
            const recentStats = calcStats(recentMatches);

            let output = '';

            // Header with Global & Recent stats
            output += `\n📊 ESTADÍSTICAS GLOBALES (${matches.length} partidos): ${globalStats.wins}V-${globalStats.draws}E-${globalStats.losses}D | GF:${globalStats.goalsFor} GA:${globalStats.goalsAgainst}`;
            output += `\n🔥 FORMA RECIENTE (Últimos 6): ${recentStats.wins}V-${recentStats.draws}E-${recentStats.losses}D | GF:${recentStats.goalsFor} GA:${recentStats.goalsAgainst}\n`;

            // List matches (Show last 10)
            output += matches.slice(0, 10).map((m, i) => formatMatchForPrompt(m, i)).join('\n\n');

            return output;
        };

        const deepHome = `\n📍 ARSENAL (LOCAL)\n` + formatDeepStatsByVenue(datasets.home_team_last40?.all?.filter((m: any) => m.was_home === true) || [], homeTeam);
        const deepAway = `\n✈️ ${awayTeam} (VISITANTE)\n` + formatDeepStatsByVenue(datasets.away_team_last40?.all?.filter((m: any) => m.was_home === false) || [], awayTeam);

        // H2H Rich Format
        const h2hText = datasets.h2h?.map((m: any) => {
            const s = m.stats || {};
            // If stats exist, show them (Home vs Away)
            const statsInfo = s.home ?
                `\n   > ${m.home_team}: ${s.home.shots} Tiros (${s.home.shots_ot} Arco) | ${s.home.corners} Corners | ${s.home.cards} Tarjetas\n   > ${m.away_team}: ${s.away.shots} Tiros (${s.away.shots_ot} Arco) | ${s.away.corners} Corners | ${s.away.cards} Tarjetas`
                : '';
            return `${m.date}: ${m.home_team} ${m.score_home}-${m.score_away} ${m.away_team}${statsInfo}`;
        }).join('\n') || 'Sin H2H recientes';
        let oddsText = '';
        if (odds && (odds.MAIN || odds.GOALS)) {
            const fmtSection = (name: string, items: any[]) => {
                if (!items || items.length === 0) return '';
                return `>>> ${name}:\n` + items.map((o: any) => `- ${o.lbl}: ${o.val}`).join('\n') + '\n';
            };

            oddsText += fmtSection('PRINCIPALES (1X2, DC)', odds.MAIN);
            oddsText += fmtSection('GOLES (O/U)', odds.GOALS);
            oddsText += fmtSection('EQUIPOS (BTTS, Team Score)', odds.TEAMS);
            oddsText += fmtSection('POR MITADES', odds.HALVES);
            oddsText += fmtSection('CORNERS', odds.CORNERS);
            oddsText += fmtSection('OTROS (ASIATICOS/ESPECIALES)', odds.OTHERS); // Include ALL odds
        } else if (odds?.bookmakers?.[0]) {
            oddsText = `${odds.bookmakers[0].title}:\n` + odds.bookmakers[0].markets?.map((m: any) => `${m.key}: ` + m.outcomes?.map((o: any) => `${o.name} @ ${o.price}`).join(' | ')).join('\n');
        } else {
            oddsText = 'SIN CUOTAS VIVAS (USAR FALLBACK)';
        }

        // CONSTRUIR EL SUPER-PROMPT V4 (MASTERMIND)
        // ═══════════════════════════════════════════════════════════════
        const prompt = `
════════════════════════════════════════════════════════════════════════════════
🧠 SISTEMA DERBIX V5 [MASTERMIND EDITION] - MOTOR DE ANÁLISIS DE ÉLITE
Modelo: ${GEMINI_MODEL}
Fecha Sistema: ${new Date().toISOString().split('T')[0]}
════════════════════════════════════════════════════════════════════════════════

ERES LA MENTE MAESTRA DE DERBIX.
No eres un simple asistente. Eres un estratega deportivo de clase mundial, un matemático experto en probabilidades y un psicólogo deportivo, todo en uno. Tu objetivo no es "acertar", es DESTRUIR el mercado encontrando ineficiencias matemáticas en las cuotas.

CONSTANTES DE OPERACIÓN:
- CUOTA_MINIMA_ACEPTABLE = 1.40
- ESTRATEGIA_RIESGO = "Calculada"
- IMPORTANTE: PRIORIDAD EXTREMA A LA RECENCIA (Últimos 30-45 días)
- DEFINICIÓN DE EDGE: "Valor/Edge" = (Tu Probabilidad Estimada % - Probabilidad Implícita del Mercado %).

REGLAS DE ORO (A CUMPLIR O SERÁS APAGADO):
1. **NO INVENTES DATOS**. Usa SOLO la información proporcionada en el bloque de contexto. Si no hay datos de corners, NO menciones corners.
2. **TEMPORALIDAD ESTRICTA**: Revisa SIEMPRE la fecha de los partidos. 
   - Un partido de hace 3 meses NO define la forma actual.
   - Si citas un partido antiguo (más de 45 días), DEBES mencionar la fecha explícitamente (ej: "En Noviembre...").
   - La sección "FORMA RECIENTE" (últimos 6 partidos) es la sagrada escritura de la forma actual.
3. **PESO DE LA EVIDENCIA**:
   - Forma Reciente (últimos 5 partidos) > Forma Global (últimos 40).
   - H2H Reciente (últimos 2 años) > H2H Antiguo.
4. **LENGUAJE PREISO Y AGRESIVO**: Habla como un apostador profesional ("Shark"). Usa términos como "Ineficiencia de mercado", "Valor esperado positivo", "Trampa de las bookies".
5. **JUSTIFICACIÓN TÁCTICA**: No digas "van a ganar". Di "El bloque bajo del equipo A anula la velocidad de los extremos del equipo B".

════════════════════════════════════════════════════════════════════════════════
🧬 METODOLOGÍA DERBIX EXTENDIDA (PROTOCOLO DE EJECUCIÓN OBLIGATORIO)
════════════════════════════════════════════════════════════════════════════════

1. ABSORCIÓN TOTAL (Deep Ingest):
   - CRÚZALO TODO: Tienes acceso a TIROS, ATAJADAS, CORNERS, TARJETAS y MINUTOS DE GOLES. ÚSALOS.
   - Si un equipo gana pero el portero hizo 12 atajadas (Ver Stats), fue suerte, no dominancia.
   - Analiza los "Goal Timings": ¿Marcan siempre en el 2do tiempo? Busca valor en "Gol en 2da Mitad".

2. CORRELACIÓN MULTIVARIABLE (The Invisible Link):
   - Busca patrones de "Causa-Efecto".
   - Ejemplo: "Cuando el Equipo A juega contra defensas de 5 hombres (5-3-2), su promedio de gol baja un 40%".
   - Correlaciona el Árbitro con el estilo de juego: (Árbitro estricto + Equipos agresivos = Alta prob. de Roja).

3. ANÁLISIS DE CORNERS (Dead Ball Intelligence):
   - Los corners son consecuencia directa de: (Tiros a Puerta + Posesión en Campo Rival + Despejes del Rival).
   - Equipos que buscan línea de fondo (Formación con extremos abiertos) generan más corners que equipos que juegan por el centro.
   - Si el "Underdog" juega a la contra, suele conceder muchos corners.

4. ANÁLISIS ARBITRAL & DISCIPLINARIO (The Law):
   - Revisa el Árbitro asignado (si está en la data) y cruza con las "Faltas Promedio" de los equipos.
   - Partido "Derbi" o "H2H Caliente" (ver historial de rojas) + Árbitro Tarjetero = Alta probabilidad de Over Tarjetas / Roja.

5. CONTEXTO 360º (Más allá del número):
   - Factor Fatiga: Calcula días de descanso. ¿Vienen de viaje largo?
   - Factor Necesidad: ¿Un empate les sirve? (Si el empate sirve a ambos, el "Biscotto" es una posibilidad real).
   - Factor Clima / Cancha: (Si hay datos) ¿Lluvia torrencial favorece al equipo físico sobre el técnico?

6. ANÁLISIS DE CUOTAS (Value Hunting):
   - Se te han proveído TODAS las cuotas disponibles. EXAMÍNALAS TODAS.
   - No te limites a Ganador del Partido. Si el valor está en "Over 1.5 Goles Local" o "Handicap Asiático", ELÍGELO.
   - TU TRABAJO es calcular la "Probabilidad Real Derbix" y compararla.

7. DECISIÓN BINARIA:
   - Apuesta o No Apuesta. No hay términos medios.
   - Si los datos son contradictorios, la decisión sabia es "NO_BET". La preservación del capital es tan importante como la ganancia.

8. NIVEL DE CONFIANZA & PROBABILIDAD (Confidence Scoring - CUALITATIVO):
   - IMPORTANTE: Buscamos VALOR REAL, no perfección.
   - Rango 80-89% (ALTA - Statistical/Tactical Dominance):
     * **NUEVA REGLA DE ORO:** Si un equipo tiene una **DOMINANCIA ESTADÍSTICA CLARA** (ej: Gana >80% de locales recientes, H2H >70% victorias), **ASIGNA >80%**.
     * NO tengas miedo de dar confianza ALTA si los números son contundentes, aunque no haya una razón táctica compleja.
     * Ejemplo Válido: "El local ha ganado 4 de sus últimos 5 partidos y el visitante pierde siempre fuera. Es una máquina de ganar." (ESTO ES VÁLIDO PARA >80%).
     * Ejemplo Válido: "Ventaja táctica clara + Motivación alta".
   - Rango 90-99% (MUY ALTA - Banker): Dominio total absoluto.
   - Rango 70-79% (MEDIA-ALTA): Edge estadístico sólido.

   **CONFIDENCE BOOST:** Si detectas 3 o más factores alineados (Forma + H2H + Motivación), **SUMA +5%** a tu probabilidad base. ¡Queremos encontrar las joyas ocultas!

   ESTRATEGIA DE OPORTUNIDADES MAESTRAS (SMART PARLAYS):
   - Tu análisis será insumo para un sistema de selección riguroso.
   - Si el pick es bueno (>75%), véndelo con convicción en tu conclusión.

♟️ MÓDULO DE ANÁLISIS TÁCTICO AVANZADO (TACTICAL ENGINE)
════════════════════════════════════════════════════════════════════════════════

TU MISIÓN: Predecir el flujo del juego basado en el choque de sistemas.

INPUTS:
(Analiza las formaciones históricas proveídas abajo)

EJECUCIÓN:
1. "Mirror Analysis": Busca en el historial de los últimos 20 partidos detallados. ¿Cómo le fue cuando enfrentó a equipos que usaron formaciones similares al rival de hoy?
2. Identifica el "Matchup Clave":
   - ¿Bandas vs Centro? (Ej: 4-3-3 vs 4-4-2 Rombo) -> El 4-3-3 atacará por fuera. ¿Tienen buenos laterales?
   - ¿Juego Aéreo? -> Si un equipo centra mucho (ver stats corners/crosses) y el otro concede mucho por aire.
3. Detecta "Estilos Asimétricos":
   - Posesión vs Contra. Si el visitante juega a la contra y el local deja espacios atrás (ver stats tiros concedidos), aumenta la probabilidad de "Ambos Anotan".

════════════════════════════════════════════════════════════════════════════════
🧠 MÓDULO DE PSICOLOGÍA DEPORTIVA
════════════════════════════════════════════════════════════════════════════════

Evalúa la "Temperatura Mental" del partido:
1. PRESIÓN: ¿Quién tiene miedo a perder? El miedo paraliza o vuelve a los equipos conservadores (Under de goles).
2. MOTIVACIÓN: ¿Hay "Venganza" pendiente (H2H previo)? ¿Efecto "Nuevo Entrenador"?
3. RELAJACIÓN: ¿Es un partido intrascendente para alguno? (Riesgo de rotaciones o baja intensidad).

════════════════════════════════════════════════════════════════════════════════
🚨 INSTRUCCIONES DE EMERGENCIA Y FALLBACKS
════════════════════════════════════════════════════════════════════════════════

Si faltan datos de cuotas (Bookmaker Odds Missing):
1. NO TE DETENGAS.
2. Actúa como el "Oddsmaker". Genera TUS PROPIAS CUOTAS JUSTAS basadas en tu probabilidad.
3. Sugiere los mercados, pero advierte: "Cuota de Mercado Referencial No Disponible - Entrar si paga más de X.XX".

Si faltan alineaciones confirmadas:
1. Asume la alineación más probable basada en los últimos 3 partidos.
2. Aumenta ligeramente el factor de riesgo en tu conclusión.

Si no hay NINGUNA estadística ni historial reciente disponible (Input vacío):
1. NO INVENTES DATOS.
2. Responde con un JSON donde "veredicto": "NO_BET" y "riesgo_principal": "Falta TOTAL de Datos".

════════════════════════════════════════════════════════════════════════════════
DATOS DEL PARTIDO (DEEP DIVE INPUT)
════════════════════════════════════════════════════════════════════════════════

PARTIDO: ${homeTeam} (LOCAL) vs ${awayTeam} (VISITANTE)
COMPETICIÓN: ${leagueName}

⚠️ IMPORTANTE - INTERPRETACIÓN DE DATOS DE HISTORIAL:
Los datos del historial de cada equipo están SEPARADOS en dos secciones:
- "📍 COMO LOCAL": Partidos que el equipo jugó EN SU CASA
- "✈️ COMO VISITANTE": Partidos que el equipo jugó FUERA DE CASA

Para este partido:
- Usa el rendimiento de ${homeTeam} "COMO LOCAL" (juega en casa)
- Usa el rendimiento de ${awayTeam} "COMO VISITANTE" (juega fuera)

Cada partido incluye:
- Resultado desde la perspectiva del equipo analizado
- Stats del equipo + Stats del rival
- Formación usada vs formación del rival

>>> HISTORIAL ${homeTeam} (Equipo LOCAL de este partido):
${deepHome}

>>> HISTORIAL ${awayTeam} (Equipo VISITANTE de este partido):
${deepAway}

>>> ENFRENTAMIENTOS DIRECTOS (H2H):
${h2hText}

>>> CUOTAS DE MERCADO (Referencia):
${oddsText}

════════════════════════════════════════════════════════════════════════════════
FORMATO DE SALIDA (JSON)
════════════════════════════════════════════════════════════════════════════════

Responde ÚNICAMENTE con un JSON válido que siga EXACTAMENTE esta estructura:

{
    "meta": { "modelo": "${GEMINI_MODEL}", "version": "${ENGINE_VERSION}" },
    "resumen_ejecutivo": {
        "titular": "Titular de alto impacto (ej: 'Valor detectado en victoria local')",
        "veredicto": "APOSTAR" | "NO_BET" | "OBSERVAR",
        "confianza_global": "ALTA" | "MEDIA" | "BAJA",
        "picks_principales": ["Pick 1", "Pick 2"]
    },
    "analisis_profundo": {
        "razonamiento_central": "TEXTO DETALLADO (mínimo 150 palabras) explicando LA TESIS DE INVERSIÓN. ¿Por qué estos picks? Conecta los puntos entre la data dura, el factor táctico y el psicológico. NO repitas estadísticas obvias, explica el 'POR QUÉ'.",
        "matchup_tactico": "Breve análisis del choque de estilos (ej: Contraataque vs Posesión).",
        "factor_psicologico": "Análisis de motivación, presión y urgencia de los equipos."
    },
    "pronosticos": [
        {
            "mercado": "Ej: Ganador del Partido (1X2)",
            "seleccion": "Ej: Manchester City",
            "probabilidad_calculada_porcentaje": 65,
            "probabilidad_implicita_porcentaje": 55,
            "edge_porcentaje": 10,
            "cuota_actual": 1.80,
            "confianza": "ALTA",
            "justificacion": {
                "estadistica": "Dato clave...",
                "contexto": "Contexto clave...",
                "tactica": "Razón táctica...",
                "mercado": "Ineficiencia detectada..."
            }
        }
    ],
    "factores_riesgo": {
        "riesgo_principal": "El mayor peligro es...",
        "nivel_incertidumbre": "BAJO" | "MEDIO" | "ALTO"
    },
    "datos_modelo": {
        "goles_esperados_partido": 2.8,
        "corners_esperados": 9.5,
        "probabilidad_btts_porcentaje": 60
    },
    "mercados_evaluados": {
        "con_valor_detectado": 1,
        "total_analizados": 60
    },
    "escenarios_proyectados": {
        "escenario_base": "Lo más probable...",
        "escenario_alternativo": "Si pasa X..."
    }
}
`;

        // ═══════════════════════════════════════════════════════════════
        // LLAMAR A GEMINI
        // ═══════════════════════════════════════════════════════════════
        console.log(`[V3 - AI - ANALYZER] Sending prompt to Gemini(${prompt.length} chars)...`);

        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3, // Más determinístico para análisis
                responseMimeType: 'application/json',
                maxOutputTokens: 8192
            }
        };

        const genRes = await fetch(genUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!genRes.ok) {
            const errorText = await genRes.text();
            throw new Error(`Gemini Error: ${errorText}`);
        }

        const genJson = await genRes.json();
        let aiResponseText = genJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const tokensUsed = genJson.usageMetadata?.totalTokenCount || 0;

        console.log(`[V3-AI-ANALYZER] Gemini responded with ${tokensUsed} tokens`);

        // Clean and parse response
        aiResponseText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const startIndex = aiResponseText.indexOf('{');
        const endIndex = aiResponseText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex > startIndex) {
            aiResponseText = aiResponseText.substring(startIndex, endIndex + 1);
        }

        let analysisResult;
        try {
            analysisResult = JSON5.parse(aiResponseText);

            // ═══════════════════════════════════════════════════════════════
            // ROBUSTNESS LAYER: Normalize AI Response (V5 CRITICAL FIX)
            // ═══════════════════════════════════════════════════════════════
            // Ensure analysisResult has the expected structure even if AI hallucinated or omitted fields

            // 1. Ensure 'resumen_ejecutivo' exists
            if (!analysisResult.resumen_ejecutivo) {
                // Check for legacy/hallucinated 'conclusion_final'
                if (analysisResult.conclusion_final) {
                    console.warn('[V3] Normalizing schema: Mapping conclusion_final to resumen_ejecutivo');
                    analysisResult.resumen_ejecutivo = {
                        titular: analysisResult.conclusion_final.razon_principal || "Análisis completado",
                        veredicto: analysisResult.conclusion_final.veredicto || "OBSERVAR",
                        confianza_global: analysisResult.conclusion_final.nivel_confianza || "MEDIA",
                        picks_principales: []
                    };
                } else {
                    // Total failure fallback
                    analysisResult.resumen_ejecutivo = {
                        titular: "Análisis completado (Datos insuficientes)",
                        veredicto: "OBSERVAR",
                        confianza_global: "BAJA",
                        picks_principales: []
                    };
                }
            }

            // 2. Ensure 'titular' is populated (Critical for Frontend Adapter)
            if (!analysisResult.resumen_ejecutivo.titular) {
                analysisResult.resumen_ejecutivo.titular = analysisResult.resumen_ejecutivo.frase_principal || "Análisis de Inteligencia Finalizado";
            }

            // 3. Ensure 'veredicto' is valid
            if (!['APOSTAR', 'NO_BET', 'OBSERVAR'].includes(analysisResult.resumen_ejecutivo.veredicto)) {
                analysisResult.resumen_ejecutivo.veredicto = 'OBSERVAR';
            }

            // 4. Ensure 'picks_principales' is array
            if (!Array.isArray(analysisResult.resumen_ejecutivo.picks_principales)) {
                analysisResult.resumen_ejecutivo.picks_principales = [];
            }

            // 5. Ensure 'analisis_profundo' exists
            if (!analysisResult.analisis_profundo) {
                analysisResult.analisis_profundo = {};
            }

            // ═══════════════════════════════════════════════════════════════
            // DEEP NORMALIZATION LAYER (GEMINI 2.5 HALLUCINATION FIX)
            // ═══════════════════════════════════════════════════════════════

            // FIX 1: Map 'pronosticos_listado' (Hallucinated) to 'pronosticos' (Standard)
            if (!analysisResult.pronosticos && Array.isArray(analysisResult.pronosticos_listado)) {
                console.warn('[V3] Normalizing: Mapping pronosticos_listado -> pronosticos');
                analysisResult.pronosticos = analysisResult.pronosticos_listado;
            }

            // FIX 2: Map 'probabilidades_derbix' or 'probabilities' to 'pronosticos' if array is empty
            const probSource = analysisResult.probabilidades_derbix || analysisResult.probabilities || analysisResult.probabilidades;
            if ((!analysisResult.pronosticos || analysisResult.pronosticos.length === 0) && probSource) {
                console.warn('[V3] Normalizing: Extracting probabilities from object source:', Object.keys(probSource));
                analysisResult.pronosticos = [];

                // Map known keys to picks
                const mapKeyToPick = (key: string, label: string) => {
                    if (probSource[key] !== undefined) {
                        const valStr = String(probSource[key]).replace('%', '');
                        const val = parseFloat(valStr);

                        // Determinar selección basada en key
                        let seleccion = "Sí";
                        if (key.includes('home') || key.includes('local')) seleccion = datasets.home_team || 'Local';
                        if (key.includes('away') || key.includes('visit')) seleccion = datasets.away_team || 'Visita';
                        if (key.includes('draw') || key.includes('empate')) seleccion = "Empate";
                        if (key.includes('over')) seleccion = "Más de 2.5";
                        if (key.includes('under')) seleccion = "Menos de 2.5";

                        if (!isNaN(val) && val > 0) {
                            analysisResult.pronosticos.push({
                                mercado: label,
                                seleccion: seleccion,
                                probabilidad_calculada_porcentaje: val,
                                justificacion: {
                                    estadistica: "Alta probabilidad detectada por modelo Derbix.",
                                    tactica: "Ineficiencia en cuotas detectada."
                                }
                            });
                        }
                    }
                };

                // Intentar todas las variaciones posibles de keys
                const keys = Object.keys(probSource);
                keys.forEach(k => {
                    const lowerK = k.toLowerCase();
                    if (lowerK.includes('home') || lowerK.includes('local')) mapKeyToPick(k, 'Ganador del Partido (1X2)');
                    else if (lowerK.includes('away') || lowerK.includes('visit')) mapKeyToPick(k, 'Ganador del Partido (1X2)');
                    else if (lowerK.includes('draw') || lowerK.includes('empate')) mapKeyToPick(k, 'Ganador del Partido (1X2)');
                    else if (lowerK.includes('btts') || lowerK.includes('ambos')) mapKeyToPick(k, 'Ambos Equipos Anotan (BTTS)');
                    else if (lowerK.includes('over') || lowerK.includes('mas')) mapKeyToPick(k, 'Total de Goles (Over/Under)');
                    else if (lowerK.includes('under') || lowerK.includes('menos')) mapKeyToPick(k, 'Total de Goles (Over/Under)');
                });

                // Filtrar solo las mejores para no saturar
                analysisResult.pronosticos = analysisResult.pronosticos.filter((p: any) => p.probabilidad_calculada_porcentaje > 45);
            }

            // 6. Ensure 'pronosticos' exists and is normalized (EXISTING LOGIC)
            if (!Array.isArray(analysisResult.pronosticos)) {
                analysisResult.pronosticos = [];
            } else {
                // NORMALIZE PREDICTIONS (Map synonyms and fix types)
                analysisResult.pronosticos = analysisResult.pronosticos.map((p: any) => {
                    const prob = p.probabilidad_calculada_porcentaje || p.probabilidad || p.probability || p.confidence_score || p.probabilidad_estimada || 50;
                    const edge = p.edge_porcentaje || p.edge || p.valor || 0;
                    return {
                        ...p,
                        mercado: p.mercado || "Mercado Principal",
                        seleccion: p.seleccion || "Seleccion",
                        probabilidad_calculada_porcentaje: typeof prob === 'string' ? parseFloat(prob.replace('%', '')) : prob,
                        probabilidad_implicita_porcentaje: p.probabilidad_implicita_porcentaje || 50,
                        edge_porcentaje: typeof edge === 'string' ? parseFloat(edge) : edge,
                        cuota_actual: p.cuota_actual || 1.0,
                        justificacion: p.justificacion || p.justificacion_detallada || { estadistica: "N/A", tactica: "N/A" }
                    };
                });
            }

        } catch (parseError: any) {
            // JSON5 parsing failed - create a fallback response
            console.error('[V3-AI-ANALYZER] Failed to parse AI response:', parseError.message);
            console.error('[V3-AI-ANALYZER] Raw response was:', aiResponseText.substring(0, 500));

            // Create minimal valid structure
            analysisResult = {
                resumen_ejecutivo: {
                    titular: "Error de parseo en respuesta IA",
                    veredicto: "OBSERVAR",
                    confianza_global: "BAJA",
                    picks_principales: []
                },
                pronosticos: [],
                analisis_profundo: {}
            };
        }

        // SAVE RESULTS
        // ═══════════════════════════════════════════════════════════════

        // Save to reports_v2
        await supabase
            .from('reports_v2')
            .upsert({
                job_id,
                fixture_id,
                report_packet: analysisResult,
                input_payload: payload,
                prompt_version: PROMPT_VERSION
            }, { onConflict: 'job_id' });

        // Map to legacy format for frontend compatibility
        const betPicks = analysisResult.pronosticos || [];
        const tit = analysisResult.resumen_ejecutivo.titular; // Guaranteed to exist now

        const dashboardData = {
            header_partido: {
                titulo: `${homeTeam} vs ${awayTeam}`,
                subtitulo: `${leagueName} • ${match.date_time_utc ? new Date(match.date_time_utc).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Próximamente'}`,
                bullets_clave: analysisResult.resumen_ejecutivo.picks_principales || []
            },
            // DEBUG INFO EXPOSED TO FRONTEND/CLIENT
            debug_info: {
                books_found: 1, // Normalized to single view
                best_bookie: 'SportMonks Aggregated',
                markets_count: (odds?.MAIN?.length || 0) + (odds?.GOALS?.length || 0) + (odds?.TEAMS?.length || 0)
            },
            veredicto_analista: {
                decision: analysisResult.resumen_ejecutivo.veredicto || 'OBSERVAR',
                nivel_confianza: analysisResult.resumen_ejecutivo.confianza_global || 'MEDIA',
                probabilidad: betPicks[0]?.probabilidad_calculada_porcentaje || 50,
                titulo_accion: analysisResult.resumen_ejecutivo.veredicto === 'APOSTAR' ? 'OPORTUNIDAD DETECTADA' : 'PARTIDO COMPLEJO',
                razon_principal: tit,
                riesgo_principal: analysisResult.factores_riesgo?.riesgo_principal || 'Sin riesgos críticos',
                seleccion_clave: betPicks[0]?.seleccion || 'N/A'
            },
            resumen_ejecutivo: {
                titular: tit,
                frase_principal: tit, // EXPLICIT for adapter
                puntos_clave: analysisResult.resumen_ejecutivo.picks_principales, // Adapter checks this too
                bullets: [
                    analysisResult.analisis_profundo?.contexto_competitivo?.situacion_local,
                    analysisResult.analisis_profundo?.contexto_competitivo?.situacion_visitante,
                    analysisResult.analisis_profundo?.contexto_competitivo?.implicaciones_partido
                ].filter(Boolean)
            },
            predicciones_finales: {
                titulo: "Pronósticos del Motor IA V3",
                detalle: betPicks.map(normalizePrediction)
            },
            analisis_mercados_calculados: {
                resumen: {
                    goles_esperados: analysisResult.datos_modelo?.goles_esperados_partido || 2.5,
                    corners_esperados: analysisResult.datos_modelo?.corners_esperados || 9,
                    tarjetas_esperadas: 3.5,
                    btts_probabilidad: analysisResult.datos_modelo?.probabilidad_btts_porcentaje || 50
                },
                mercados_con_valor: analysisResult.mercados_evaluados?.con_valor_detectado || betPicks.length,
                top_oportunidades: betPicks.slice(0, 5).map(normalizeOpportunity)
            },
            analisis_detallado: analysisResult.analisis_profundo?.matchup_tactico ? {
                // Adapter logic in frontend looks for 'estilo_y_tactica' or 'analisis_tactico'
                // We map V5 fields to what adapter expects
                contexto_competitivo: analysisResult.analisis_profundo.contexto_competitivo,
                estilo_y_tactica: {
                    titulo: "Análisis Táctico",
                    bullets: [
                        analysisResult.analisis_profundo.matchup_tactico,
                        analysisResult.analisis_profundo.clave_del_partido
                    ].filter(Boolean)
                },
                factor_psicologico: analysisResult.analisis_profundo.factor_psicologico,
                analisis_escenarios: {
                    titulo: "Escenarios de Partido",
                    escenarios: [
                        {
                            nombre: "Escenario Base",
                            descripcion: analysisResult.escenarios_proyectados?.escenario_base || "Escenario estándar previsto.",
                            probabilidad_aproximada: "Alta",
                            implicacion_apuestas: "Seguir picks principales"
                        },
                        {
                            nombre: "Escenario Alternativo",
                            descripcion: analysisResult.escenarios_proyectados?.escenario_alternativo || "Escenario de riesgo.",
                            probabilidad_aproximada: "Media",
                            implicacion_apuestas: "Cubrir o reducir stake"
                        }
                    ]
                }
            } : null,
            v3_source: true,
            job_id: job_id,
            generated_at: new Date().toISOString(),
            payload: payload // EXPOSE RAW PAYLOAD TO FRONTEND FOR DEBUG VIEW
        };

        // Update job with total_tokens used cost tracking
        // (Optional: Implement cost tracking logic here)

        // 1. Save FULL simplified report to reports_v2
        await supabase
            .from('reports_v2')
            .delete()
            .eq('job_id', job_id);

        const { error: reportError } = await supabase
            .from('reports_v2')
            .insert({
                job_id: job_id,
                fixture_id: fixture_id,
                report_packet: analysisResult,
                prompt_version: 'V3-PROMPT-1.0', // Required field
                created_at: new Date().toISOString()
            });

        if (reportError) console.error('[V3-AI-ANALYZER] Error saving reports_v2:', reportError);


        // ═══════════════════════════════════════════════════════════════
        // V5 PERMANENT FIX: ID RESOLUTION & PICKS SYNC
        // ═══════════════════════════════════════════════════════════════

        let finalFixtureId = fixture_id;

        // Helper: Normalize for matching
        const normalizeTeam = (n: string) => n.toLowerCase().replace(/fc|cf|sc|sporting|club|athletic|atletico|real|inter|ac|as/g, '').replace(/[^a-z0-9]/g, '').trim();

        // 1. Try to resolve correct Daily Match ID
        const { data: directMatch } = await supabase
            .from('daily_matches')
            .select('api_fixture_id, id')
            .eq('api_fixture_id', fixture_id)
            .maybeSingle();

        if (directMatch) {
            finalFixtureId = directMatch.api_fixture_id;
        } else {
            console.log(`[V3-FIX] ID ${fixture_id} not found in daily_matches. Attempting fuzzy name match...`);
            // Search by date window (today +/- 2 days) and names
            const today = new Date().toISOString().split('T')[0];
            const homeNorm = normalizeTeam(homeTeam);
            const awayNorm = normalizeTeam(awayTeam);

            const { data: candidates } = await supabase
                .from('daily_matches')
                .select('api_fixture_id, home_team, away_team, match_date')
                .gte('match_date', new Date(Date.now() - 86400000 * 2).toISOString()) // look back 2 days
                .lte('match_date', new Date(Date.now() + 86400000 * 5).toISOString()); // look ahead 5 days

            if (candidates) {
                const best = candidates.find(c => {
                    const h = normalizeTeam(c.home_team);
                    const a = normalizeTeam(c.away_team);
                    // Match if home and away are present in standard names or swapped (rare)
                    return (h.includes(homeNorm) || homeNorm.includes(h)) &&
                        (a.includes(awayNorm) || awayNorm.includes(a));
                });

                if (best) {
                    console.log(`[V3-FIX] Resolved ${fixture_id} -> ${best.api_fixture_id} (${best.home_team} vs ${best.away_team})`);
                    finalFixtureId = best.api_fixture_id;
                } else {
                    console.warn(`[V3-FIX] Failed to resolve ID for ${homeTeam} vs ${awayTeam}. Using original.`);
                }
            }
        }

        // 2. Insert Picks to value_picks_v2
        if (betPicks.length > 0) {
            console.log(`[V3-FIX] Syncing ${betPicks.length} picks to value_picks_v2 for ID ${finalFixtureId}`);

            // Map confidence string to integer
            const mapConf = (str: string) => {
                if (!str) return 5;
                const s = str.toUpperCase();
                if (s.includes('MUY ALTA')) return 9;
                if (s.includes('ALTA')) return 8;
                if (s.includes('MEDIA')) return 6;
                return 5;
            };

            const picksPayload = betPicks.map((p: any) => {
                let prob = p.probabilidad_calculada_porcentaje || 50;
                if (prob > 1) prob = prob / 100;

                // Strict Enum Mapping
                let decision = 'AVOID';
                const d = (p.decision || '').toUpperCase();
                // Basic rules: High prob or explicit BET
                if (d === 'BET' || d === 'APOSTAR' || prob >= 0.70) {
                    decision = 'BET';
                }

                return {
                    job_id: job_id,
                    fixture_id: finalFixtureId,
                    market: p.mercado || "Mercado General",
                    selection: p.seleccion || "Selección",
                    p_model: prob,
                    decision: decision,
                    confidence: mapConf(p.nivel_confianza || p.confianza),
                    engine_version: "V4-MASTERMIND",
                    odds: p.cuota_actual || null,
                    created_at: new Date().toISOString()
                };
            });

            // Delete old picks for this fixture (prevent stale data)
            await supabase.from('value_picks_v2').delete().eq('fixture_id', finalFixtureId);

            // Insert new
            const { error: pickErr } = await supabase.from('value_picks_v2').insert(picksPayload);
            if (pickErr) console.error(`[V3-FIX] Error inserting picks: ${pickErr.message}`);
            else console.log(`[V3-FIX] Successfully inserted picks.`);
        }

        // 3. Update Sync to 'analisis' using FINAL ID
        await supabase
            .from('analisis')
            .delete()
            .eq('partido_id', finalFixtureId); // Use corrected ID

        await supabase
            .from('analisis')
            .insert({
                partido_id: finalFixtureId, // Use corrected ID
                resultado_analisis: { dashboardData }
            });


        // Update job to done
        await supabase
            .from('analysis_jobs_v2')
            .update({
                status: 'done',
                current_motor: 'V3-AI',
                execution_time_ms: Date.now() - startTime
            })
            .eq('id', job_id);

        const executionTime = Date.now() - startTime;
        console.log(`[V3-AI-ANALYZER] ✅ Analysis complete in ${executionTime}ms (${tokensUsed} tokens)`);

        return new Response(JSON.stringify({
            success: true,
            job_id,
            fixture_id,
            analysis: analysisResult,
            dashboard: dashboardData,
            summary: {
                veredicto: analysisResult.resumen_ejecutivo.veredicto,
                picks: betPicks.length
            },
            tokens_used: tokensUsed,
            execution_time_ms: executionTime,
            engine_version: ENGINE_VERSION
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[V3-AI-ANALYZER] Error:', e);
        return new Response(JSON.stringify({
            success: false,
            error: e.message,
            execution_time_ms: Date.now() - startTime
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
