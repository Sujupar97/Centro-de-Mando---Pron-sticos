
import { GroundingChunk } from "@google/genai";

// --- ENUMS & BASIC TYPES ---

export enum BetStatus {
    Pending = 'Pendiente',
    Won = 'Ganada',
    Lost = 'Perdida',
}

export enum LegStatus {
    Won = 'Ganadora',
    Lost = 'Perdida',
    Pending = 'Pendiente',
    Void = 'Anulada',
}

export type ConfidenceLevel = 'Alta' | 'Media' | 'Baja';

// --- DATABASE TYPES (SUPABASE REFLECTION) ---

export type OrganizationRole = 'owner' | 'admin' | 'usuario';
export type OrganizationStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type SubscriptionPlan = 'free' | 'basic' | 'pro' | 'enterprise';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    status: OrganizationStatus;
    subscription_plan: SubscriptionPlan;
    created_at: string;
    updated_at: string;
    metadata?: Record<string, any>;
    settings?: Record<string, any>;
}

export interface OrganizationMember {
    id: string;
    organization_id: string;
    user_id: string;
    role: OrganizationRole;
    joined_at: string;
    profile?: {
        full_name: string;
        email: string;
        avatar_url?: string;
    };
}

export interface OrganizationInvitation {
    id: string;
    organization_id: string;
    email: string;
    role: OrganizationRole;
    token: string;
    invited_by: string;
    created_at: string;
    expires_at: string;
    accepted_at?: string;
}

export interface UserProfile {
    id: string;
    email: string;
    role: 'superadmin' | 'admin' | 'user';
    full_name?: string;
    avatar_url?: string;
    organization_id?: string;
    is_org_owner?: boolean;
}

export type JobStatus = 'queued' | 'ingesting' | 'data_ready' | 'analyzing' | 'done' | 'insufficient_data' | 'failed';

export interface JobProgress {
    step: string;
    completeness_score: number;
    fetched_items: number;
    total_items: number;
    details?: string;
    missing_data?: string[];
}

export interface AnalysisJob {
    id: string;
    api_fixture_id: number;
    fixture_id: string;
    status: JobStatus;
    completeness_score: number;
    estimated_calls: number;
    actual_calls: number;
    progress_jsonb: JobProgress;
    last_error?: string;
    created_at: string;
}

export interface PredictionDB {
    id: string;
    market_code: string; // '1X2', 'OU2.5', 'BTTS', etc.
    selection: string;
    probability: number;
    confidence: number; // 0-100 score numérico
    signal_strength: number;
    evidence_jsonb: any;
    is_won?: boolean | null; // Added for retro analysis result
}

export interface AnalysisRun {
    id: string;
    job_id: string;
    fixture_id: string;
    summary_pre_text: string;
    report_pre_jsonb: any; // Reporte completo estructurado
    created_at: string;
    predictions?: PredictionDB[];
    post_match_analysis?: PostMatchAnalysis; // New structured analysis
    actual_outcome?: MatchOutcome;        // New: Data real del partido
}

export interface PostMatchAnalysis {
    tactical_analysis: string;
    statistical_breakdown: string;
    key_moments: string;
    performance_review: string;
    learning_feedback: string;
}

export interface MatchOutcome {
    score: { home: number; away: number };
    status: string;
    winner: string;
}

// --- LEGACY / FRONTEND TYPES (Mantenidos para compatibilidad visual temporal) ---

export interface BetLeg {
    sport: string;
    league: string;
    event: string;
    market: string;
    status: LegStatus;
    odds: number;
}

export interface Bet {
    id: number;
    user_id: string;
    date: string;
    event: string;
    market: string;
    stake: number;
    odds: number;
    status: BetStatus;
    payout: number;
    image?: string;
    legs?: BetLeg[];
}

export interface ExtractedBetInfo {
    date: string;
    stake: number;
    totalOdds: number;
    status: BetStatus;
    legs: BetLeg[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    sources?: GroundingChunk[];
}

export interface PeriodStats {
    period: string;
    totalBets: number;
    combinedBets: number;
    singleBets: number;
    wonBets: number;
    lostBets: number;
    winRate: number;
    totalLegs: number;
    wonLegs: number;
    lostLegs: number;
    legWinRate: number;
    totalStaked: number;
    totalPayout: number;
    profitLoss: number;
    roi: number;
    averageOdds: number;
}

// --- DASHBOARD / AI TYPES ---

export interface TablaComparativaData {
    titulo: string;
    columnas: string[];
    filas: (string | number)[][];
}

export interface AnalisisEscenario {
    nombre: string;
    descripcion: string;
    probabilidad_aproximada: string;
}

export interface AnalisisSeccion {
    titulo: string;
    bullets: string[];
    escenarios?: AnalisisEscenario[];
}

export interface DetallePrediccion {
    id: number;
    mercado: string;
    seleccion: string;
    probabilidad_estimado_porcentaje: number;
    justificacion_detallada: {
        base_estadistica: string[];
        contexto_competitivo: string[];
        conclusion: string;
    };
}

export interface GraficoSerie {
    nombre: string;
    valores: { [key: string]: number };
}

export interface GraficoSugerido {
    id: string;
    titulo: string;
    descripcion: string;
    tipo: string;
    eje_x: string;
    eje_y: string;
    series: GraficoSerie[];
}

export interface DashboardAnalysisJSON {
    header_partido: {
        titulo: string;
        subtitulo: string;
        bullets_clave: string[];
    };
    resumen_ejecutivo: {
        frase_principal: string;
        puntos_clave: string[];
    };
    tablas_comparativas: {
        [key: string]: TablaComparativaData;
    };
    analisis_detallado: {
        contexto_competitivo: AnalisisSeccion;
        estilo_y_tactica: AnalisisSeccion;
        alineaciones_y_bajas: AnalisisSeccion;
        factores_situacionales: AnalisisSeccion;
        escenarios_de_partido?: AnalisisSeccion;
    };
    graficos_sugeridos: GraficoSugerido[];
    predicciones_finales: {
        tabla_resumen?: any;
        detalle: DetallePrediccion[];
    };
    advertencias?: {
        titulo: string;
        bullets: string[];
    };
}

// --- VISUAL / DASHBOARD TYPES ---

// Wrapper para el resultado que consume la UI
export interface VisualAnalysisResult {
    analysisText: string;
    sources?: GroundingChunk[];
    dashboardData?: DashboardAnalysisJSON | null;
    analysisRun?: AnalysisRun; // Nuevo campo: Data cruda de DB
    visualData?: any; // Legacy support
}

export interface BettingRecommendationVisual {
    market: string;
    prediction: string;
    probability: number;
    confidence: ConfidenceLevel;
    reasoning: string;
}

export type MoraleLevel = 'Alta' | 'Media' | 'Baja' | 'Neutra';
export type PressureLevel = 'Alta' | 'Media' | 'Baja';

export interface TacticalVisual {
    name?: string;
    formation: string;
    strength: string;
    weakness: string;
    teamA?: string;
    teamB?: string;
}

export interface JugadorClave {
    nombre: string;
    impacto: string;
}

export interface NoticiasYFactoresEquipo {
    moral: MoraleLevel;
    presion: PressureLevel;
    resumenNoticias: string;
    impactoApuestas: string;
}

export interface ChartDataPoint {
    name: string;
    value: number;
}


// --- API-FOOTBALL MIRROR TYPES ---

export interface APITeam {
    id: number;
    name: string;
    logo: string;
}

export interface APIGoals {
    home: number | null;
    away: number | null;
}

export interface APIFixtureStatus {
    long: string;
    short: string;
    elapsed: number | null;
}

export interface APIFixture {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    venue: { id: number | null; name: string | null; city: string | null; };
    status: APIFixtureStatus;
}

export interface APILeague {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round?: string;
}

export interface Game {
    fixture: APIFixture;
    league: APILeague;
    teams: { home: APITeam; away: APITeam; };
    goals: APIGoals;
}

export interface League {
    id: number;
    name: string;
    country: string;
    logo: string;
    season: number;
    games: Game[];
}

export interface Country {
    name: string;
    flag: string | null;
    leagues: League[];
}

export interface APIStanding {
    rank: number;
    team: {
        id: number;
        name: string;
        logo: string;
    };
    points: number;
    goalsDiff: number;
    group: string;
    form: string;
    status: string;
    description: string;
    all: {
        played: number;
        win: number;
        draw: number;
        lose: number;
        goals: {
            for: number;
            against: number;
        };
    };
    home: any;
    away: any;
    update: string;
}

export interface APIFixtureStatistics {
    team: {
        id: number;
        name: string;
        logo: string;
    };
    statistics: {
        type: string;
        value: any;
    }[];
}

export interface APIEvent {
    time: {
        elapsed: number;
        extra: number | null;
    };
    team: {
        id: number;
        name: string;
        logo: string;
    };
    player: {
        id: number;
        name: string;
    };
    assist: {
        id: number | null;
        name: string | null;
    };
    type: string;
    detail: string;
    comments: string | null;
}

export interface APILineupPlayer {
    id: number;
    name: string;
    number: number;
    pos: string;
    grid: string | null;
}

export interface APILineup {
    team: {
        id: number;
        name: string;
        logo: string;
        colors?: any;
    };
    coach: {
        id: number;
        name: string;
        photo?: string;
    };
    formation: string;
    startXI: { player: APILineupPlayer }[];
    substitutes: { player: APILineupPlayer }[];
}

export interface APITeamSeasonStats {
    league: any;
    team: any;
    form: string;
    fixtures: {
        played: { home: number; away: number; total: number };
        wins: { home: number; away: number; total: number };
        draws: { home: number; away: number; total: number };
        loses: { home: number; away: number; total: number };
    };
    goals: {
        for: { total: { home: number; away: number; total: number } };
        against: { total: { home: number; away: number; total: number } };
    };
}


// --- TYPES FOR DASHBOARD DATA ---
export interface DashboardData {
    importantLeagues: League[];
    countryLeagues: Country[];
}

// Tipos legacy necesarios para evitar errores de compilación en componentes viejos
export interface GameDetails {
    fixture: APIFixture;
    league: APILeague;
    teams: { home: APITeam; away: APITeam };
    goals: APIGoals;
    events: APIEvent[] | null;
    lineups: APILineup[] | null;
    statistics: APIFixtureStatistics[] | null;
    h2h: Game[] | null;
    standings: APIStanding[][] | null;
    teamStats: { home: APITeamSeasonStats | null; away: APITeamSeasonStats | null; };
    lastMatches: { home: Game[] | null; away: Game[] | null; };
}
export interface ParlayLeg { game: string; market: string; prediction: string; odds: number; reasoning: string; }
export interface ParlayAnalysisResult { parlayTitle: string; legs: ParlayLeg[]; finalOdds: number; overallStrategy: string; }
export interface GamedayBettingOpportunity { market: string; prediction: string; probability: number; reasoning: string; confidence: ConfidenceLevel; }
export interface GameAnalysis { league: string; matchup: string; time: string; overallContext: string; topOpportunities: GamedayBettingOpportunity[]; }
export type GamedayAnalysisResult = GameAnalysis[];
export interface LegAnalysis { legSummary: { event: string; market: string; prediction: string; }; analysis: { conclusion: string; confidence: ConfidenceLevel; probability: number; tacticalSynopsis: string; playerImpact: string; keyDataPoints: string[]; }; }
export interface BetTicketAnalysisResult { overallVerdict: string; strongestPick: string; riskiestPick: string; legAnalyses: LegAnalysis[]; }
export interface PerformanceReportResult { executiveSummary: string; keyMetrics: any; strengths: string[]; weaknesses: string[]; actionableRecommendations: string[]; chartsData: any; performanceBySport: any[]; performanceByMarket: any[]; learningAnalysis?: string; }
export interface PerformanceReportDB { id: number; user_id: string; created_at: string; start_date: string; end_date: string; report_data: PerformanceReportResult; }
export interface AnalyzedGameDB { partido_id: number; resultado_analisis: VisualAnalysisResult; partidos: any; }
export interface TopPickItem { gameId: number; analysisRunId?: string; matchup: string; date: string; league: string; teams: { home: { name: string; logo: string }; away: { name: string; logo: string }; }; bestRecommendation: BettingRecommendationVisual; result?: 'Won' | 'Lost' | 'Pending' | 'Void'; }
export type CreateBetPayload = Omit<Bet, 'id' | 'user_id'>;
