import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../services/supabaseService';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Breadcrumbs } from './Breadcrumbs';
import { MatchHeader } from './MatchHeader';
import { PremiumBlur } from './PremiumBlur';
import { RelatedContent } from './RelatedContent';
import { trackPredictionView } from '../../services/analyticsService';

interface SeoPage {
  fixture_id: number;
  league_slug: string;
  match_slug: string;
  home_team_slug: string;
  away_team_slug: string;
  full_path: string;
  home_team: string;
  away_team: string;
  league_name: string;
  match_date: string;
  match_time: string | null;
  home_logo: string | null;
  away_logo: string | null;
  has_analysis: boolean;
  has_results: boolean;
  result_correct: boolean | null;
  home_score: number | null;
  away_score: number | null;
}

export const PrediccionPage: React.FC = () => {
  const { leagueSlug, matchSlug } = useParams<{ leagueSlug: string; matchSlug: string }>();
  const { session } = useAuth();
  const { isPremium, isPro } = useSubscription();
  const canViewPremium = !!session && (isPremium || isPro);

  const [page, setPage] = useState<SeoPage | null>(null);
  const [report, setReport] = useState<any>(null);
  const [picks, setPicks] = useState<any[]>([]);
  const [relatedLeague, setRelatedLeague] = useState<any[]>([]);
  const [relatedTeam, setRelatedTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueSlug || !matchSlug) return;
    loadData();
  }, [leagueSlug, matchSlug]);

  async function loadData() {
    setLoading(true);

    // Fetch SEO page
    const { data: pageData } = await supabase
      .from('seo_pages')
      .select('*')
      .eq('league_slug', leagueSlug)
      .eq('match_slug', matchSlug)
      .single();

    if (!pageData) {
      setLoading(false);
      return;
    }

    setPage(pageData);
    trackPredictionView(pageData.league_name, `${pageData.home_team} vs ${pageData.away_team}`);

    // Fetch report, picks, and related in parallel
    const [reportRes, picksRes, leagueRes, teamRes] = await Promise.all([
      supabase
        .from('reports_v2')
        .select('report_packet')
        .eq('fixture_id', pageData.fixture_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('value_picks_v2')
        .select('market, selection, p_model, odds, edge, decision, confidence, result, is_opportunity')
        .eq('fixture_id', pageData.fixture_id)
        .order('p_model', { ascending: false }),
      supabase
        .from('seo_pages')
        .select('full_path, home_team, away_team, match_date, has_results, result_correct')
        .eq('league_slug', leagueSlug!)
        .neq('fixture_id', pageData.fixture_id)
        .order('match_date', { ascending: false })
        .limit(6),
      supabase
        .from('seo_pages')
        .select('full_path, home_team, away_team, match_date, league_name, has_results, result_correct')
        .or(`home_team_slug.eq.${pageData.home_team_slug},away_team_slug.eq.${pageData.home_team_slug}`)
        .neq('fixture_id', pageData.fixture_id)
        .order('match_date', { ascending: false })
        .limit(6),
    ]);

    setReport(reportRes.data?.report_packet || null);
    setPicks(picksRes.data || []);
    setRelatedLeague(leagueRes.data || []);
    setRelatedTeam(teamRes.data || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Pronóstico No Encontrado</h1>
        <p className="text-slate-400 mb-6">Este pronóstico aún no ha sido generado.</p>
        <Link to="/predicciones" className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold">
          Ver Todos los Pronósticos
        </Link>
      </div>
    );
  }

  const resumen = report?.resumen_ejecutivo;
  const detallado = report?.analisis_detallado;
  const veredicto = report?.veredicto_analista;
  const predicciones = report?.predicciones_finales?.detalle || [];
  const advertencias = report?.advertencias;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between border-b border-white/5">
        <Link to="/" className="text-emerald-500 font-display font-extrabold text-xl">Derbix</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/predicciones" className="text-slate-300 hover:text-white">Predicciones</Link>
          <Link to="/estadisticas" className="text-slate-300 hover:text-white">Estadísticas</Link>
          <Link to="/pricing" className="text-slate-300 hover:text-white">Planes</Link>
          {!session && (
            <Link to="/signup" className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold text-sm">
              Registrarse
            </Link>
          )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumbs items={[
          { label: 'Inicio', href: '/' },
          { label: 'Predicciones', href: '/predicciones' },
          { label: page.league_name, href: `/predicciones/${page.league_slug}` },
          { label: `${page.home_team} vs ${page.away_team}` },
        ]} />

        {/* Header */}
        <MatchHeader
          homeTeam={page.home_team}
          awayTeam={page.away_team}
          leagueName={page.league_name}
          matchDate={page.match_date}
          matchTime={page.match_time || undefined}
          homeLogo={page.home_logo || undefined}
          awayLogo={page.away_logo || undefined}
          confidence={veredicto?.nivel_confianza}
          homeScore={page.home_score}
          awayScore={page.away_score}
          hasResults={page.has_results}
          resultCorrect={page.result_correct}
        />

        {/* Analysis Summary (PUBLIC) */}
        {resumen && (
          <section className="bg-slate-900/80 border border-white/5 rounded-2xl p-6 mb-6 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-white mb-4 font-display">Análisis del Partido</h2>
            {resumen.frase_principal && (
              <p className="text-lg text-slate-300 mb-4">{resumen.frase_principal}</p>
            )}
            {resumen.puntos_clave?.length > 0 && (
              <ul className="space-y-2">
                {resumen.puntos_clave.map((p: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300">
                    <span className="text-emerald-500 mt-1">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Stats & Factors (PUBLIC) */}
        {detallado && (
          <section className="bg-slate-900/80 border border-white/5 rounded-2xl p-6 mb-6 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-white mb-4 font-display">Factores Clave</h2>
            {['contexto_competitivo', 'estilo_y_tactica', 'alineaciones_y_bajas', 'factores_situacionales'].map((key) => {
              const section = detallado[key];
              if (!section?.bullets?.length) return null;
              return (
                <div key={key} className="mb-4">
                  <h3 className="text-emerald-400 font-semibold mb-2">
                    {section.titulo || key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </h3>
                  <ul className="space-y-1">
                    {section.bullets.map((b: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                        <span className="text-emerald-500 mt-1">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {advertencias?.bullets?.length > 0 && (
              <div>
                <h3 className="text-amber-400 font-semibold mb-2">Advertencias</h3>
                <ul className="space-y-1">
                  {advertencias.bullets.map((b: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                      <span className="text-amber-400 mt-1">⚠</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Predictions (PREMIUM or BLURRED) */}
        {canViewPremium ? (
          <section className="bg-slate-900/80 border border-white/5 rounded-2xl p-6 mb-6 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-white mb-4 font-display">Predicción y Apuestas</h2>
            {veredicto && (
              <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-white/5">
                <p className="text-lg font-bold text-white">{veredicto.decision}</p>
                <p className="text-slate-300">{veredicto.seleccion_clave}</p>
                <p className="text-sm text-slate-400">
                  Probabilidad: {veredicto.probabilidad}% | {veredicto.nivel_confianza} confianza
                </p>
              </div>
            )}
            {predicciones.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 text-xs uppercase">
                      <th className="pb-3 pr-4">Mercado</th>
                      <th className="pb-3 pr-4">Selección</th>
                      <th className="pb-3 pr-4">Probabilidad</th>
                      <th className="pb-3">Cuota</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {predicciones.map((pred: any, i: number) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="py-3 pr-4">{pred.mercado}</td>
                        <td className="py-3 pr-4 font-medium text-white">{pred.seleccion}</td>
                        <td className="py-3 pr-4 text-emerald-400">{pred.probabilidad_estimado_porcentaje}%</td>
                        <td className="py-3">{pred.odds ? `@${pred.odds}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="bg-slate-900/80 border border-white/5 rounded-2xl p-6 mb-6 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-white mb-4 font-display">Predicción y Apuestas Recomendadas</h2>
            <PremiumBlur matchTitle={`${page.home_team} vs ${page.away_team}`}>
              {/* Fake preview content for blur */}
              <div className="space-y-4 p-4">
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-lg font-bold">APOSTAR</p>
                  <p>Over 2.5 Goles — 85% probabilidad</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr><td className="py-2">Match Result</td><td>Victoria Local</td><td>78%</td><td>@1.85</td></tr>
                    <tr><td className="py-2">Over/Under</td><td>Over 2.5</td><td>82%</td><td>@1.72</td></tr>
                    <tr><td className="py-2">BTTS</td><td>Sí</td><td>71%</td><td>@1.95</td></tr>
                  </tbody>
                </table>
              </div>
            </PremiumBlur>
          </section>
        )}

        {/* CTA */}
        <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-8 mb-8 text-center backdrop-blur-xl">
          <h3 className="text-xl font-bold text-white mb-2">Pronósticos con IA para 40+ Ligas</h3>
          <p className="text-slate-400 mb-4">Track record 100% verificable. Sin tipsters. Sin humo.</p>
          <Link to="/pricing" className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold inline-block hover:bg-emerald-600 transition">
            Ver Planes
          </Link>
        </div>

        {/* Related content */}
        <RelatedContent
          title={`Otros Partidos de ${page.league_name}`}
          matches={relatedLeague}
        />
        <RelatedContent
          title={`Últimos Pronósticos de ${page.home_team}`}
          matches={relatedTeam}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Derbix. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};
