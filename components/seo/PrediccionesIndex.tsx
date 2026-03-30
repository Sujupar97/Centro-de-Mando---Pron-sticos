import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../services/supabaseService';
import { Breadcrumbs } from './Breadcrumbs';

const PAGE_SIZE = 20;

interface SeoPageSummary {
  full_path: string;
  home_team: string;
  away_team: string;
  league_name: string;
  league_slug: string;
  match_date: string;
  has_results: boolean;
  result_correct: boolean | null;
  home_logo: string | null;
  away_logo: string | null;
}

export const PrediccionesIndex: React.FC = () => {
  const { leagueSlug } = useParams<{ leagueSlug?: string }>();
  const [searchParams] = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [pages, setPages] = useState<SeoPageSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [leagues, setLeagues] = useState<{ league_slug: string; league_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const offset = (currentPage - 1) * PAGE_SIZE;

  useEffect(() => {
    loadData();
  }, [leagueSlug, currentPage]);

  async function loadData() {
    setLoading(true);

    let query = supabase
      .from('seo_pages')
      .select('full_path, home_team, away_team, league_name, league_slug, match_date, has_results, result_correct, home_logo, away_logo', { count: 'exact' })
      .order('match_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (leagueSlug) {
      query = query.eq('league_slug', leagueSlug);
    }

    const [pagesRes, leaguesRes] = await Promise.all([
      query,
      supabase.from('seo_pages').select('league_slug, league_name').order('league_name'),
    ]);

    setPages(pagesRes.data || []);
    setTotalCount(pagesRes.count || 0);

    // Deduplicate leagues
    const uniqueLeagues = leaguesRes.data
      ? [...new Map(leaguesRes.data.map((l: any) => [l.league_slug, l])).values()] as { league_slug: string; league_name: string }[]
      : [];
    setLeagues(uniqueLeagues);
    setLoading(false);
  }

  const title = leagueSlug
    ? `Predicciones ${pages[0]?.league_name || leagueSlug}`
    : 'Predicciones de Fútbol con IA';

  const basePath = leagueSlug ? `/predicciones/${leagueSlug}` : '/predicciones';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between border-b border-white/5">
        <Link to="/" className="text-emerald-500 font-display font-extrabold text-xl">Derbix</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/predicciones" className="text-slate-300 hover:text-white">Predicciones</Link>
          <Link to="/estadisticas" className="text-slate-300 hover:text-white">Estadísticas</Link>
          <Link to="/signup" className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold text-sm">
            Registrarse
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumbs items={
          leagueSlug
            ? [
                { label: 'Inicio', href: '/' },
                { label: 'Predicciones', href: '/predicciones' },
                { label: pages[0]?.league_name || leagueSlug },
              ]
            : [
                { label: 'Inicio', href: '/' },
                { label: 'Predicciones' },
              ]
        } />

        <h1 className="text-3xl font-bold text-white mb-2 font-display">{title}</h1>
        <p className="text-slate-400 mb-8">
          Pronósticos generados por nuestro algoritmo de inteligencia artificial. Análisis de más de 5,000 variables por partido.
        </p>

        {/* League filter badges */}
        {!leagueSlug && leagues.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {leagues.map((l) => (
              <Link
                key={l.league_slug}
                to={`/predicciones/${l.league_slug}`}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition"
              >
                {l.league_name}
              </Link>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pages.length === 0 ? (
          <p className="text-slate-500 text-center py-12">No hay predicciones disponibles.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pages.map((m) => (
              <Link
                key={m.full_path}
                to={m.full_path}
                className="bg-slate-900/60 border border-white/5 rounded-xl p-4 flex items-center justify-between hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  {m.home_logo && <img src={m.home_logo} alt="" className="w-6 h-6 object-contain" />}
                  <span className="text-white font-medium">{m.home_team} vs {m.away_team}</span>
                  {m.away_logo && <img src={m.away_logo} alt="" className="w-6 h-6 object-contain" />}
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {m.league_name}
                  </span>
                  <span className="text-slate-500 text-sm">{m.match_date}</span>
                  {m.has_results && (
                    <span className={`text-sm font-bold ${m.result_correct ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.result_correct ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-8">
            {currentPage > 1 && (
              <Link
                to={`${basePath}${currentPage > 2 ? `?page=${currentPage - 1}` : ''}`}
                className="px-4 py-2 rounded-lg border border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/10 transition"
              >
                Anterior
              </Link>
            )}
            <span className="flex items-center text-slate-400 text-sm px-4">
              Página {currentPage} de {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link
                to={`${basePath}?page=${currentPage + 1}`}
                className="px-4 py-2 rounded-lg border border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/10 transition"
              >
                Siguiente
              </Link>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-8 mt-8 text-center backdrop-blur-xl">
          <h3 className="text-xl font-bold text-white mb-2">Desbloquea Predicciones Premium</h3>
          <p className="text-slate-400 mb-4">1 pronóstico gratis al día, para siempre.</p>
          <Link to="/signup" className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold inline-block hover:bg-emerald-600 transition">
            Crear Cuenta Gratis
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Derbix. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};
