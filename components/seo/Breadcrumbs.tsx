import React from 'react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-2 text-sm text-slate-500 mb-6"
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-slate-600">/</span>}
          {item.href ? (
            <Link to={item.href} className="text-slate-400 hover:text-emerald-400 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-300">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
