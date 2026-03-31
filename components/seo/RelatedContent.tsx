import React from 'react';
import { Link } from 'react-router-dom';

interface RelatedMatch {
  full_path: string;
  home_team: string;
  away_team: string;
  match_date: string;
  league_name?: string;
  has_results?: boolean;
  result_correct?: boolean | null;
}

interface RelatedContentProps {
  title: string;
  matches: RelatedMatch[];
}

export const RelatedContent: React.FC<RelatedContentProps> = ({ title, matches }) => {
  if (!matches.length) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 font-display">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {matches.map((m) => (
          <Link
            key={m.full_path}
            to={m.full_path}
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-emerald-500/30 transition-all"
          >
            <span className="text-gray-900 text-sm font-medium">
              {m.home_team} vs {m.away_team}
            </span>
            <div className="flex items-center gap-2">
              {m.league_name && (
                <span className="text-gray-400 text-xs">{m.league_name}</span>
              )}
              <span className="text-gray-400 text-xs">{m.match_date}</span>
              {m.has_results && (
                <span className={`text-sm font-bold ${m.result_correct ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.result_correct ? '✓' : '✗'}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
