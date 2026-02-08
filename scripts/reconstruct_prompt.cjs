
const fs = require('fs');

const API_KEY = 'RhgNCasAS67wuJtawFoMrkokCP51r89L7dMKQIpXoGVv67BKfnWOcKHcjEG5';
const FIXTURE_ID = 19631548;
const GEMINI_MODEL = 'gemini-3-pro-preview';
const ENGINE_VERSION = 'V5-MASTERMIND';

// ------------------------------------------------------------------
// 1. REPLICATE FETCH LOGIC (With V5 Includes: Referees, etc)
// ------------------------------------------------------------------

async function fetchTeamFixtures(teamId) {
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('participant_id', teamId.toString());
    url.searchParams.set('per_page', '20');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('include', 'participants;scores;venue;league;statistics;lineups;events;formations;referees');

    try {
        const res = await fetch(url.toString());
        const json = await res.json();
        return json.data || [];
    } catch (e) { console.error(e); return []; }
}

async function fetchH2H(t1, t2) {
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${t1}/${t2}`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('include', 'participants;scores;statistics;events;lineups;referees');
    try {
        const res = await fetch(url.toString());
        const json = await res.json();
        return json.data || [];
    } catch (e) { console.error(e); return []; }
}

async function fetchFixture(id) {
    const url = new URL(`https://api.sportmonks.com/v3/football/fixtures/${id}`);
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('include', 'participants;lineups;statistics;events;scores;venue;odds.bookmaker;referees');
    try {
        const res = await fetch(url.toString());
        const json = await res.json();
        return json.data;
    } catch (e) { console.error(e); return null; }
}

// ------------------------------------------------------------------
// 2. REPLICATE FORMATTING (V5 "Deep Data")
// ------------------------------------------------------------------

function formatDeepStats(matches, teamName, rootMatch) {
    if (!matches || matches.length === 0) return 'Sin datos detallados disponibles.';

    return matches.slice(0, 20).map((m, i) => {
        const rootHomeId = rootMatch.participants?.find(p => p.meta.location === 'home')?.id;
        const currentHomeId = m.participants?.find(p => p.meta.location === 'home')?.id;
        const venue = (rootHomeId === currentHomeId) ? '(LOCAL)' : '(VISITANTE)';

        const homeScore = m.scores?.find(s => s.description === 'CURRENT' && s.score.participant === 'home')?.score?.goals || 0;
        const awayScore = m.scores?.find(s => s.description === 'CURRENT' && s.score.participant === 'away')?.score?.goals || 0;
        const result = homeScore > awayScore ? 'Gana Home' : homeScore < awayScore ? 'Gana Away' : 'Empate';

        // Extract Stats
        const findStat = (typeId, team) => {
            const stat = m.statistics?.find(s => s.participant_id === team && s.type_id === typeId);
            return stat?.data?.value || 0;
        };
        const teamId = m.participants?.find(p => p.name === teamName)?.id || m.participants?.[0]?.id; // approximation

        // 45=Pos, 86=ShotsOT, 42=ShotsTot, 83=Corners, 57=Yellow, 58=Red, 56=Fouls, 34=Saves
        const poss = findStat(45, teamId);
        const shots = findStat(42, teamId);
        const shotsOT = findStat(86, teamId);
        const corners = findStat(83, teamId);
        const saves = findStat(34, teamId);
        const yellow = findStat(57, teamId);
        const red = findStat(58, teamId);
        const fouls = findStat(56, teamId);
        const formation = m.formations?.find(f => f.participant_id === teamId)?.formation || '?';
        const oppFormation = m.formations?.find(f => f.participant_id !== teamId)?.formation || '?';
        const referee = m.referees?.[0]?.common_name || '?';

        // Goal Timings
        const goalTimings = m.events
            ?.filter(e => e.participant_id === teamId && (e.type?.name === 'Goal' || e.type_id === 14))
            .map(e => e.minute + (e.extra_minute ? `+${e.extra_minute}` : ''))
            .join(', ') || 'Sin goles';

        const statsLine = `   > Stats: ${poss}% Pos | ${shotsOT}/${shots} Tiros | ${corners} Corners | ${saves} Atajadas`;
        const cardsLine = `   > Disciplina: ${yellow} Amarillas | ${red} Rojas | ${fouls} Faltas | Ref: ${referee}`;
        const eventsLine = `   > Goles (Minutos): ${goalTimings}`;
        const formLine = `   > Formación: ${formation} (vs ${oppFormation})`;

        return `${i + 1}. ${m.starting_at} ${venue} vs ${m.name}: ${homeScore}-${awayScore} (${result})\n${statsLine}\n${cardsLine}\n${eventsLine}\n${formLine}`;
    }).join('\n');
}

function formatH2HRich(matches) {
    if (!matches || matches.length === 0) return 'Sin H2H recientes.';
    return matches.map(m => {
        const homeId = m.participants?.find(p => p.meta.location === 'home')?.id;
        const awayId = m.participants?.find(p => p.meta.location === 'away')?.id;
        const homeName = m.participants?.find(p => p.meta.location === 'home')?.name || 'Home';
        const awayName = m.participants?.find(p => p.meta.location === 'away')?.name || 'Away';

        const scoreHome = m.scores?.find(s => s.description === 'CURRENT')?.score?.home || 0;
        const scoreAway = m.scores?.find(s => s.description === 'CURRENT')?.score?.away || 0;

        const findStat = (typeId, team) => {
            const stat = m.statistics?.find(s => s.participant_id === team && s.type_id === typeId);
            return stat?.data?.value || 0;
        };

        const statsHome = `${findStat(42, homeId)} Tiros | ${findStat(83, homeId)} Corners | ${findStat(57, homeId)} Amarillas`;
        const statsAway = `${findStat(42, awayId)} Tiros | ${findStat(83, awayId)} Corners | ${findStat(57, awayId)} Amarillas`;

        return `${m.starting_at}: ${homeName} ${scoreHome}-${scoreAway} ${awayName}\n   > ${homeName}: ${statsHome}\n   > ${awayName}: ${statsAway}`;
    }).join('\n');
}

// ------------------------------------------------------------------
// 3. MAIN BUILDER
// ------------------------------------------------------------------

async function generatePrompt() {
    console.log("Fetching Data...");
    const match = await fetchFixture(FIXTURE_ID);
    if (!match) throw new Error("Match not found");

    const homeP = match.participants.find(p => p.meta.location === 'home');
    const awayP = match.participants.find(p => p.meta.location === 'away');
    const homeId = homeP.id;
    const awayId = awayP.id;
    const homeName = homeP.name;
    const awayName = awayP.name;
    const leagueName = match.league?.name || "League";

    console.log(`Teams: ${homeName} vs ${awayName}`);

    const [homeHist, awayHist, h2h] = await Promise.all([
        fetchTeamFixtures(homeId),
        fetchTeamFixtures(awayId),
        fetchH2H(homeId, awayId)
    ]);

    console.log(`History Loaded: ${homeHist.length} home, ${awayHist.length} away`);

    // --- RECONSTRUCT PROMPT ---
    const deepHome = formatDeepStats(homeHist, homeName, match);
    const deepAway = formatDeepStats(awayHist, awayName, match);
    const h2hText = formatH2HRich(h2h);

    let oddsText = 'SIN CUOTAS VIVAS (USAR FALLBACK)';
    const odds = match.odds;
    if (odds && odds.length > 0) {
        oddsText = `>>> ODDS BOOKMAKER ${odds[0].bookmaker_id}:\n`;
        oddsText += odds.map(o => `- ${o.label}: ${o.value} (${o.market?.name || 'Unknown'})`).join('\n');
    }

    const prompt = `
════════════════════════════════════════════════════════════════════════════════
🧠 SISTEMA DERBIX V5 [MASTERMIND EDITION] - MOTOR DE ANÁLISIS DE ÉLITE
Modelo: ${GEMINI_MODEL}
Fecha Sistema: 2026/02/04
════════════════════════════════════════════════════════════════════════════════

ERES LA MENTE MAESTRA DE DERBIX.
No eres un simple asistente. Eres un estratega deportivo de clase mundial, un matemático experto en probabilidades y un psicólogo deportivo, todo en uno. Tu objetivo no es "acertar", es DESTRUIR el mercado encontrando ineficiencias matemáticas en las cuotas.

CONSTANTES DE OPERACIÓN:
- CUOTA_MINIMA_ACEPTABLE = 1.40
- ESTRATEGIA_RIESGO = "Calculada"
- DEFINICIÓN DE EDGE: "Valor/Edge" = (Tu Probabilidad Estimada % - Probabilidad Implícita del Mercado %).
  * Si Edge > 0: HAY VALOR (Considerar Apuesta).
  * Si Edge <= 0: NO HAY VALOR (Descartar, NO FORZAR).

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
   - Equpos que buscan línea de fondo (Formación con extremos abiertos) generan más corners que equipos que juegan por el centro.
   - Si el "Underdog" juega a la contra, suele conceder muchos corners.

4. ANÁLISIS ARBITRAL & DISCIPLINARIO (The Law):
   - Revisa el Árbitro asignado (si está en la data) y cruza con las "Faltas Promedio" de los equipos.
   - Partido "Derbi" o "H2H Caliente" (ver historial de rojas) + Árbitro Tarjetero = Alta probabilidad de Over Tarjetas/Roja.

5. CONTEXTO 360º (Más allá del número):
   - Factor Fatiga: Calcula días de descanso. ¿Vienen de viaje largo?
   - Factor Necesidad: ¿Un empate les sirve? (Si el empate sirve a ambos, el "Biscotto" es una posibilidad real).
   - Factor Clima/Cancha: (Si hay datos) ¿Lluvia torrencial favorece al equipo físico sobre el técnico?

6. ANÁLISIS DE CUOTAS (Value Hunting):
   - Se te han proveído TODAS las cuotas disponibles. EXAMÍNALAS TODAS.
   - No te limites a Ganador del Partido. Si el valor está en "Over 1.5 Goles Local" o "Handicap Asiático", ELÍGELO.
   - TU TRABAJO es calcular la "Probabilidad Real Derbix" y compararla.

7. DECISIÓN BINARIA:
   - Apuesta o No Apuesta. No hay términos medios.
   - Si los datos son contradictorios, la decisión sabia es "NO BET". La preservación del capital es tan importante como la ganancia.

8. NIVEL DE CONFIANZA (Confidence Scoring):
   - BAJA: Edge marginal, riesgo alto (Stake 0.5 - 1)
   - MEDIA: Edge claro, escenario estándar (Stake 1.5 - 2)
   - ALTA: Ineficiencia de mercado detectada, escenario muy favorable (Stake 3 - 5)
   - ULTRA (Raro): Error flagrante del bookmaker.

════════════════════════════════════════════════════════════════════════════════
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

PARTIDO: ${homeName} vs ${awayName}
COMPETICIÓN: ${leagueName}

>>> HISTORIAL ULTIMOS 20 PARTIDOS (DETALLADO) - ${homeName}:
${deepHome}

>>> HISTORIAL ULTIMOS 20 PARTIDOS (DETALLADO) - ${awayName}:
${deepAway}

>>> ENFRENTAMIENTOS DIRECTOS (H2H):
${h2hText}

>>> CUOTAS DE MERCADO (Referencia):
${oddsText}

════════════════════════════════════════════════════════════════════════════════
FORMATO DE SALIDA (JSON)
════════════════════════════════════════════════════════════════════════════════

Responde ÚNICAMENTE con un JSON válido que siga EXACTAMENTE esta estructura:
(JSON Schema omitido por brevedad en reconstruccion, usando referencia mental)
{ ... }
`;

    // Write to file
    const outputPath = 'full_prompt_dump.txt';
    fs.writeFileSync(outputPath, prompt);
    console.log(`\n✅ Prompt reconstructed and saved to ${outputPath}`);
}

generatePrompt();
