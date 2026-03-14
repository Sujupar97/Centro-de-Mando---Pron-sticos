import React, { useState } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useToast } from '../../contexts/ToastContext';
import { Tooltip } from '../ui/Tooltip';

interface ExportableData {
  headers: string[];
  rows: (string | number)[][];
  title: string;
}

interface ExportButtonProps {
  getData: () => ExportableData;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ getData }) => {
  const { plan } = useSubscription();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);

  const isPro = ['pro', 'premium'].includes(plan.plan_name?.toLowerCase() || '');

  const exportCSV = () => {
    if (!isPro) return;
    setExporting(true);
    try {
      const { headers, rows, title } = getData();
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `derbix-${title}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV exportado correctamente', 'success');
    } catch {
      showToast('Error al exportar', 'error');
    }
    setExporting(false);
  };

  if (!isPro) {
    return (
      <Tooltip content="Disponible en plan Pro o superior">
        <button
          disabled
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-white/5 cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Exportar
        </button>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={exportCSV}
      disabled={exporting}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 border border-white/5 hover:bg-white/5 hover:text-white transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      {exporting ? 'Exportando...' : 'Exportar CSV'}
    </button>
  );
};
