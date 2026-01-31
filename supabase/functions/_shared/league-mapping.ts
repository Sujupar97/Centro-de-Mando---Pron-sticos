
// supabase/functions/_shared/league-mapping.ts

export const LEAGUE_MAPPING: Record<number, string> = {
    39: 'soccer_epl',                  // Premier League
    140: 'soccer_spain_la_liga',       // La Liga
    135: 'soccer_italy_serie_a',       // Serie A
    78: 'soccer_germany_bundesliga',   // Bundesliga
    61: 'soccer_france_ligue_one',     // Ligue 1
    2: 'soccer_uefa_champs_league',    // Champions League
    3: 'soccer_uefa_europa_league',    // Europa League
    848: 'soccer_uefa_conf_league',     // Conference League

    // Americas
    253: 'soccer_usa_mls',             // MLS
    71: 'soccer_brazil_campeonato',    // Brasileirao
    128: 'soccer_argentina_primera_division',   // Liga Profesional Argentina
    239: 'soccer_colombia_primera_b',  // Colombia Primera B (Check if odds API supports this, often flaky)

    // Other Europe
    88: 'soccer_netherlands_eredivisie', // Eredivisie
    94: 'soccer_portugal_primeira_liga', // Liga Portugal
    144: 'soccer_belgium_first_div',    // Jupiler Pro League
    179: 'soccer_scotland_premiership', // Scottish Premiership
    113: 'soccer_sweden_allsvenskan',   // Allsvenskan
    119: 'soccer_denmark_superliga',    // Superliga

    // Rest of World
    169: 'soccer_china_superleague',    // Chinese Super League
    307: 'soccer_saudi_pro_league',     // Saudi Pro League
    // Add more as needed
};

export const BOOKMAKER_MAPPING: Record<string, string> = {
    'pinnacle': 'Pinnacle',
    'williamhill': 'William Hill',
    'bet365': 'Bet365',
    'betfair': 'Betfair',
    'unibet': 'Unibet'
};
