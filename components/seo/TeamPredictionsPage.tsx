import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../services/supabaseService';
import { Breadcrumbs } from './Breadcrumbs';

const PAGE_SIZE = 20;

export const TeamPredictionsPage: React.FC = () => {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const [searchParams] = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [pages, setPages] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const offset = (currentPage - 1) * PAGE_SIZE;

  useEffect(() => {
    if (!teamSlug) return;
    loadData();
  }, [teamSlug, currentPage]);

  async function loadData() {
    setLoading(true);

    const { data, count } = await supabase
      .from('seo_pages')
      .select('full_path, home_team, away_team, home_team_slug, league_name, match_date, has_results, result_correct, home_logo, away_logo', { count: 'exact' })
      .or(`home_team_slug.eq.${teamSlug},away_team_slug.eq.${teamSlug}`)
      .order('match_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    setPages(data || []);
    setTotalCount(count || 0);

    if (data?.length) {
      const first = data[0];
      setTeamName(first.home_team_slug === teamSlug ? first.home_team : first.away_team);
    }

    setLoading(false);
  }

  const basePath = `/predicciones/equipo/${teamSlug}`;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between border-b border-gray-200">
        <Link to="/" className="text-emerald-500 font-display font-extrabold text-xl">Derbix</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/predicciones" className="text-gray-600 hover:text-gray-900">Predicciones</Link>
          <Link to="/estadisticas" className="text-gray-600 hover:text-gray-900">Estadísticas</Link>
          <Link to="/signup" className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold text-sm">
            Registrarse
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumbs items={[
          { label: 'Inicio', href: '/' },
          { label: 'Predicciones', href: '/predicciones' },
          { label: teamName || teamSlug || '' },
        ]} />

        <h1 className="text-3xl font-bold text-gray-900 mb-2 font-display">
          Predicciones {teamName || teamSlug}
        </h1>
        <p className="text-gray-500 mb-8">
          Historial completo de pronósticos para {teamName || teamSlug}.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pages.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No hay predicciones para este equipo.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pages.map((m: any) => (
              <Link
                key={m.full_path}
                to={m.full_path}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  {m.home_logo && <img src={m.home_logo} alt="" className="w-6 h-6 object-contain" />}
                  <span className="text-gray-900 font-medium">{m.home_team} vs {m.away_team}</span>
                  {m.away_logo && <img src={m.away_logo} alt="" className="w-6 h-6 object-contain" />}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-xs">{m.league_name}</span>
                  <span className="text-gray-400 text-sm">{m.match_date}</span>
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
            <span className="flex items-center text-gray-500 text-sm px-4">
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
      </main>

      <footer className="border-t border-gray-200 py-8 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} Derbix. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};
