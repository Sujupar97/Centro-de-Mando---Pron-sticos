/**
 * Audit Log
 * Vista de eventos de ls_webhook_events para monitorear actividad de suscripciones
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';

interface WebhookEvent {
    id: string;
    event_name: string;
    ls_event_id: string;
    processed: boolean;
    processed_at: string | null;
    error: string | null;
    created_at: string;
    payload: any;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
    subscription_created: { label: 'Suscripción creada', color: 'emerald' },
    subscription_updated: { label: 'Suscripción actualizada', color: 'blue' },
    subscription_cancelled: { label: 'Suscripción cancelada', color: 'amber' },
    subscription_expired: { label: 'Suscripción expirada', color: 'red' },
    subscription_paused: { label: 'Suscripción pausada', color: 'amber' },
    subscription_unpaused: { label: 'Suscripción reanudada', color: 'emerald' },
    subscription_resumed: { label: 'Suscripción resumida', color: 'emerald' },
    subscription_payment_success: { label: 'Pago exitoso', color: 'emerald' },
    subscription_payment_failed: { label: 'Pago fallido', color: 'red' },
    subscription_payment_recovered: { label: 'Pago recuperado', color: 'emerald' },
    order_refunded: { label: 'Reembolso', color: 'red' },
};

const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export const AuditLog: React.FC = () => {
    const [events, setEvents] = useState<WebhookEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        loadEvents();
    }, [filter]);

    const loadEvents = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('ls_webhook_events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (filter !== 'all') {
                query = query.eq('event_name', filter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setEvents(data || []);
        } catch (error) {
            console.error('Error loading audit log:', error);
        } finally {
            setLoading(false);
        }
    };

    const eventTypes = [
        'all',
        'subscription_created',
        'subscription_cancelled',
        'subscription_expired',
        'subscription_payment_success',
        'subscription_payment_failed',
        'order_refunded',
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Audit Log</h2>
            <p className="text-gray-400 text-sm">Eventos de webhook de Lemon Squeezy procesados por el sistema.</p>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {eventTypes.map(type => (
                    <button
                        key={type}
                        onClick={() => setFilter(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            filter === type
                                ? 'bg-brand/20 text-brand border border-brand/30'
                                : 'bg-slate-800 text-gray-400 hover:text-white border border-white/5'
                        }`}
                    >
                        {type === 'all' ? 'Todos' : EVENT_LABELS[type]?.label || type}
                    </button>
                ))}
            </div>

            {/* Events List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
            ) : events.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-3">📋</p>
                    <p>No hay eventos registrados{filter !== 'all' ? ' para este filtro' : ''}.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {events.map(event => {
                        const eventInfo = EVENT_LABELS[event.event_name] || { label: event.event_name, color: 'gray' };
                        const cls = colorMap[eventInfo.color] || colorMap.gray;
                        const isExpanded = expandedId === event.id;

                        return (
                            <div key={event.id} className="bg-slate-900/50 rounded-xl border border-white/5 overflow-hidden">
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${cls}`}>
                                            {eventInfo.label}
                                        </span>
                                        <span className={`w-2 h-2 rounded-full ${event.processed ? 'bg-emerald-500' : event.error ? 'bg-red-500' : 'bg-amber-500'}`} />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-gray-500 text-xs">
                                            {new Date(event.created_at).toLocaleString('es-CO')}
                                        </span>
                                        <span className="text-gray-600 text-xs">
                                            {isExpanded ? '▲' : '▼'}
                                        </span>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-white/5 p-4 bg-slate-800/30">
                                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                            <div>
                                                <span className="text-gray-500">Event ID:</span>
                                                <span className="text-gray-300 ml-2 font-mono text-xs">{event.ls_event_id}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Procesado:</span>
                                                <span className={`ml-2 ${event.processed ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {event.processed ? 'Sí' : 'No'}
                                                </span>
                                            </div>
                                            {event.processed_at && (
                                                <div>
                                                    <span className="text-gray-500">Procesado el:</span>
                                                    <span className="text-gray-300 ml-2">
                                                        {new Date(event.processed_at).toLocaleString('es-CO')}
                                                    </span>
                                                </div>
                                            )}
                                            {event.error && (
                                                <div className="col-span-2">
                                                    <span className="text-red-400">Error:</span>
                                                    <span className="text-red-300 ml-2">{event.error}</span>
                                                </div>
                                            )}
                                        </div>
                                        {event.payload && (
                                            <details className="mt-2">
                                                <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-300">
                                                    Ver payload completo
                                                </summary>
                                                <pre className="mt-2 text-xs text-gray-400 bg-slate-900 p-3 rounded-lg overflow-x-auto max-h-60">
                                                    {JSON.stringify(event.payload, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AuditLog;
