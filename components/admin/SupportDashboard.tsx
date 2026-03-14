import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supportService, type SupportTicket } from '../../services/supportService';
import { useToast } from '../../contexts/ToastContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'resolved', label: 'Resueltos' },
  { value: 'closed', label: 'Cerrados' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Sugerencia' },
  { value: 'question', label: 'Pregunta' },
  { value: 'feedback', label: 'Comentario' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Baja' },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open: { label: 'Abierto', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  in_progress: { label: 'En Progreso', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  resolved: { label: 'Resuelto', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  closed: { label: 'Cerrado', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
};

const PRIORITY_BADGE: Record<string, { label: string; cls: string }> = {
  urgent: { label: 'Urgente', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
  high: { label: 'Alta', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  normal: { label: 'Normal', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  low: { label: 'Baja', cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

export const SupportDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [response, setResponse] = useState('');
  const [responding, setResponding] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    const data = await supportService.getAllTickets({
      status: filterStatus || undefined,
      type: filterType || undefined,
      priority: filterPriority || undefined,
    });
    setTickets(data);
    setLoading(false);
  }, [filterStatus, filterType, filterPriority]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleRespond = async () => {
    if (!selectedTicket || !response.trim() || !user?.id) return;
    setResponding(true);
    const updated = await supportService.respondToTicket(selectedTicket.id, response.trim(), user.id);
    setResponding(false);
    if (updated) {
      showToast('Respuesta enviada', 'success');
      setResponse('');
      setSelectedTicket(null);
      loadTickets();
    } else {
      showToast('Error al responder', 'error');
    }
  };

  const openCount = tickets.filter(t => t.status === 'open').length;

  return (
    <div className="h-full">
      <button onClick={onBack} className="mb-4 px-4 py-2 text-gray-400 hover:text-white flex items-center gap-2">
        &larr; Volver a Admin
      </button>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">Soporte</h2>
            <p className="text-slate-400 text-sm mt-1">
              {openCount > 0 ? `${openCount} ticket${openCount !== 1 ? 's' : ''} sin responder` : 'Todo al d\u00EDa'}
            </p>
          </div>
          <button onClick={loadTickets} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-white/5 rounded-lg hover:bg-white/5 transition-colors">
            Actualizar
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {[
            { options: STATUS_OPTIONS, value: filterStatus, set: setFilterStatus, label: 'Estado' },
            { options: TYPE_OPTIONS, value: filterType, set: setFilterType, label: 'Tipo' },
            { options: PRIORITY_OPTIONS, value: filterPriority, set: setFilterPriority, label: 'Prioridad' },
          ].map(filter => (
            <select
              key={filter.label}
              value={filter.value}
              onChange={e => filter.set(e.target.value)}
              className="bg-slate-800/50 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand/30"
            >
              {filter.options.map(opt => (
                <option key={opt.value} value={opt.value}>{filter.label}: {opt.label}</option>
              ))}
            </select>
          ))}
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No hay tickets con estos filtros</div>
        ) : (
          <div className="space-y-2">
            {tickets.map(ticket => {
              const status = STATUS_BADGE[ticket.status] || STATUS_BADGE.open;
              const priority = PRIORITY_BADGE[ticket.priority] || PRIORITY_BADGE.normal;
              return (
                <div
                  key={ticket.id}
                  onClick={() => { setSelectedTicket(ticket); setResponse(ticket.admin_response || ''); }}
                  className={`border rounded-xl p-4 cursor-pointer transition-all hover:bg-white/[0.02] ${
                    selectedTicket?.id === ticket.id ? 'border-brand/30 bg-brand/5' : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${status.cls}`}>
                        {status.label}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${priority.cls}`}>
                        {priority.label}
                      </span>
                      <span className="text-[10px] text-slate-500">{ticket.type}</span>
                      {ticket.plan_name && (
                        <span className="text-[10px] text-slate-600">Plan: {ticket.plan_name}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600">
                      {new Date(ticket.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{ticket.message}</p>
                  {ticket.admin_response && (
                    <p className="text-xs text-brand/60 mt-1 truncate">Respondido: {ticket.admin_response.slice(0, 80)}...</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Response panel */}
        {selectedTicket && (
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 p-4 -mx-4 sm:-mx-6 md:-mx-8 rounded-t-2xl">
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Respondiendo a ticket de <span className="text-white">{selectedTicket.user_id.slice(0, 8)}...</span>
                  {selectedTicket.page_context && <span className="ml-2 text-slate-600">(p\u00E1gina: {selectedTicket.page_context})</span>}
                </p>
                <button onClick={() => setSelectedTicket(null)} className="text-slate-500 hover:text-white text-xs">
                  Cerrar
                </button>
              </div>
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                rows={3}
                placeholder="Escribe tu respuesta..."
                className="w-full bg-slate-800/50 border border-white/5 rounded-xl p-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-brand/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRespond}
                  disabled={!response.trim() || responding}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-brand to-emerald-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-brand/20 transition-all active:scale-[0.98]"
                >
                  {responding ? 'Enviando...' : 'Enviar Respuesta'}
                </button>
                {selectedTicket.status !== 'closed' && (
                  <button
                    onClick={async () => {
                      await supportService.updateTicketStatus(selectedTicket.id, 'closed');
                      showToast('Ticket cerrado', 'info');
                      setSelectedTicket(null);
                      loadTickets();
                    }}
                    className="px-4 py-2 rounded-xl border border-white/5 text-slate-400 text-sm hover:bg-white/5 transition-colors"
                  >
                    Cerrar Ticket
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
