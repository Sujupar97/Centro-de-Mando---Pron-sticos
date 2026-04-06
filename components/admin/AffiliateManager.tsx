import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseService';

interface ReferralCode {
    id: string;
    code: string;
    affiliate_name: string;
    channel_name: string | null;
    channel_url: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    whop_username: string | null;
    commission_pct: number;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    // Computed
    total_referrals?: number;
    paying_referrals?: number;
}

interface ReferralCommission {
    id: string;
    referral_code_id: string;
    referred_user_id: string;
    payment_id: string | null;
    payment_amount_cents: number;
    commission_pct: number;
    commission_amount_cents: number;
    status: 'pending' | 'paid' | 'void';
    paid_at: string | null;
    paid_via: string | null;
    notes: string | null;
    created_at: string;
    // Joined
    user_name?: string;
    user_email?: string;
}

interface ReferredUser {
    id: string;
    full_name: string | null;
    email: string;
    created_at: string;
    has_paid: boolean;
    plan_name: string | null;
}

interface AffiliateForm {
    code: string;
    affiliate_name: string;
    channel_name: string;
    channel_url: string;
    contact_email: string;
    contact_phone: string;
    whop_username: string;
    commission_pct: number;
    notes: string;
}

const EMPTY_FORM: AffiliateForm = {
    code: '',
    affiliate_name: '',
    channel_name: '',
    channel_url: '',
    contact_email: '',
    contact_phone: '',
    whop_username: '',
    commission_pct: 30,
    notes: '',
};

export const AffiliateManager: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [affiliates, setAffiliates] = useState<ReferralCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<AffiliateForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Detail view
    const [selectedAffiliate, setSelectedAffiliate] = useState<ReferralCode | null>(null);
    const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
    const [commissions, setCommissions] = useState<ReferralCommission[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // Commission calculation
    const [calculating, setCalculating] = useState(false);
    const [calcMonth, setCalcMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Pay modal
    const [payingAffiliate, setPayingAffiliate] = useState<ReferralCode | null>(null);
    const [payVia, setPayVia] = useState('whop');
    const [payNotes, setPayNotes] = useState('');

    const loadAffiliates = useCallback(async () => {
        setLoading(true);
        try {
            const { data: codes } = await supabase
                .from('referral_codes')
                .select('*')
                .order('created_at', { ascending: false });

            if (!codes) { setAffiliates([]); return; }

            // Enrich with referral counts
            const enriched = await Promise.all(codes.map(async (code) => {
                const { count: totalReferrals } = await supabase
                    .from('profiles')
                    .select('id', { count: 'exact', head: true })
                    .eq('utm_ref', code.code);

                const { data: payingData } = await supabase.rpc('count_paying_referrals', { ref_code: code.code }).maybeSingle();

                return {
                    ...code,
                    total_referrals: totalReferrals || 0,
                    paying_referrals: payingData?.count || 0,
                };
            }));

            setAffiliates(enriched);
        } catch (err) {
            console.error('Error loading affiliates:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Simpler count without RPC — fallback
    const loadAffiliatesSimple = useCallback(async () => {
        setLoading(true);
        try {
            const { data: codes } = await supabase
                .from('referral_codes')
                .select('*')
                .order('created_at', { ascending: false });

            if (!codes) { setAffiliates([]); return; }

            const enriched = await Promise.all(codes.map(async (code) => {
                const { count: totalReferrals } = await supabase
                    .from('profiles')
                    .select('id', { count: 'exact', head: true })
                    .eq('utm_ref', code.code);

                return {
                    ...code,
                    total_referrals: totalReferrals || 0,
                    paying_referrals: 0,
                };
            }));

            setAffiliates(enriched);
        } catch (err) {
            console.error('Error loading affiliates:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAffiliatesSimple();
    }, [loadAffiliatesSimple]);

    // Load detail for a specific affiliate
    const loadAffiliateDetail = async (affiliate: ReferralCode) => {
        setSelectedAffiliate(affiliate);
        setDetailLoading(true);

        try {
            // Get referred users
            const { data: users } = await supabase
                .from('profiles')
                .select('id, full_name, email, created_at')
                .eq('utm_ref', affiliate.code)
                .order('created_at', { ascending: false });

            if (users) {
                const enrichedUsers = await Promise.all(users.map(async (user) => {
                    const { data: sub } = await supabase
                        .from('user_subscriptions')
                        .select('plan_id, status, subscription_plans(name, display_name)')
                        .eq('user_id', user.id)
                        .eq('status', 'active')
                        .maybeSingle();

                    const plan = (sub?.subscription_plans as any);
                    return {
                        ...user,
                        has_paid: !!sub && plan?.name !== 'free',
                        plan_name: plan?.display_name || plan?.name || 'Free',
                    };
                }));
                setReferredUsers(enrichedUsers);
            }

            // Get commissions
            const { data: coms } = await supabase
                .from('referral_commissions')
                .select('*')
                .eq('referral_code_id', affiliate.id)
                .order('created_at', { ascending: false });

            setCommissions(coms || []);
        } catch (err) {
            console.error('Error loading affiliate detail:', err);
        } finally {
            setDetailLoading(false);
        }
    };

    // Create or update affiliate
    const handleSave = async () => {
        if (!form.code || !form.affiliate_name) {
            setError('Código y nombre son obligatorios');
            return;
        }

        // Sanitize code
        const cleanCode = form.code.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (cleanCode !== form.code) {
            setForm({ ...form, code: cleanCode });
            setError('El código se ajustó: solo letras minúsculas, números, guiones y guiones bajos');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const payload = {
                code: form.code,
                affiliate_name: form.affiliate_name,
                channel_name: form.channel_name || null,
                channel_url: form.channel_url || null,
                contact_email: form.contact_email || null,
                contact_phone: form.contact_phone || null,
                whop_username: form.whop_username || null,
                commission_pct: form.commission_pct,
                notes: form.notes || null,
            };

            if (editingId) {
                const { error: err } = await supabase
                    .from('referral_codes')
                    .update(payload)
                    .eq('id', editingId);
                if (err) throw err;
            } else {
                const { error: err } = await supabase
                    .from('referral_codes')
                    .insert(payload);
                if (err) throw err;
            }

            setShowForm(false);
            setEditingId(null);
            setForm(EMPTY_FORM);
            await loadAffiliatesSimple();
        } catch (err: any) {
            setError(err.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // Toggle active/inactive
    const toggleActive = async (affiliate: ReferralCode) => {
        await supabase
            .from('referral_codes')
            .update({ is_active: !affiliate.is_active })
            .eq('id', affiliate.id);
        await loadAffiliatesSimple();
    };

    // Open edit form
    const openEdit = (affiliate: ReferralCode) => {
        setForm({
            code: affiliate.code,
            affiliate_name: affiliate.affiliate_name,
            channel_name: affiliate.channel_name || '',
            channel_url: affiliate.channel_url || '',
            contact_email: affiliate.contact_email || '',
            contact_phone: affiliate.contact_phone || '',
            whop_username: affiliate.whop_username || '',
            commission_pct: affiliate.commission_pct,
            notes: affiliate.notes || '',
        });
        setEditingId(affiliate.id);
        setShowForm(true);
    };

    // Calculate commissions for a month
    const calculateCommissions = async () => {
        setCalculating(true);
        try {
            const [year, month] = calcMonth.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 1).toISOString();

            // Get all payments in the period from referred users
            const { data: payments } = await supabase
                .from('payment_history')
                .select('id, user_id, amount_cents, currency, created_at')
                .eq('status', 'paid')
                .gte('created_at', startDate)
                .lt('created_at', endDate);

            if (!payments || payments.length === 0) {
                alert('No hay pagos en este período');
                setCalculating(false);
                return;
            }

            // Get profiles with utm_ref for these users
            const userIds = payments.map(p => p.user_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, utm_ref')
                .in('id', userIds)
                .not('utm_ref', 'is', null);

            if (!profiles || profiles.length === 0) {
                alert('Ningún pago corresponde a usuarios referidos');
                setCalculating(false);
                return;
            }

            const refMap = new Map(profiles.map(p => [p.id, p.utm_ref]));

            // Get active referral codes
            const { data: codes } = await supabase
                .from('referral_codes')
                .select('id, code, commission_pct')
                .eq('is_active', true);

            const codeMap = new Map((codes || []).map(c => [c.code, c]));

            // Get existing commissions to avoid duplicates
            const { data: existing } = await supabase
                .from('referral_commissions')
                .select('payment_id')
                .in('payment_id', payments.map(p => p.id));

            const existingPaymentIds = new Set((existing || []).map(e => e.payment_id));

            // Build commission rows
            const newCommissions = [];
            for (const payment of payments) {
                if (existingPaymentIds.has(payment.id)) continue;
                const refCode = refMap.get(payment.user_id);
                if (!refCode) continue;
                const code = codeMap.get(refCode);
                if (!code) continue;

                newCommissions.push({
                    referral_code_id: code.id,
                    referred_user_id: payment.user_id,
                    payment_id: payment.id,
                    payment_amount_cents: payment.amount_cents,
                    commission_pct: code.commission_pct,
                    commission_amount_cents: Math.round(payment.amount_cents * code.commission_pct / 100),
                    status: 'pending',
                });
            }

            if (newCommissions.length === 0) {
                alert('No hay nuevas comisiones para registrar (ya estaban calculadas o no hay referidos con pagos)');
                setCalculating(false);
                return;
            }

            const { error: insertErr } = await supabase
                .from('referral_commissions')
                .insert(newCommissions);

            if (insertErr) throw insertErr;

            alert(`${newCommissions.length} comisión(es) registrada(s) exitosamente`);

            // Reload if viewing detail
            if (selectedAffiliate) {
                await loadAffiliateDetail(selectedAffiliate);
            }
        } catch (err: any) {
            alert('Error al calcular: ' + (err.message || err));
        } finally {
            setCalculating(false);
        }
    };

    // Mark commissions as paid
    const markAsPaid = async () => {
        if (!payingAffiliate) return;

        try {
            const { error: err } = await supabase
                .from('referral_commissions')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    paid_via: payVia,
                    notes: payNotes || null,
                })
                .eq('referral_code_id', payingAffiliate.id)
                .eq('status', 'pending');

            if (err) throw err;

            setPayingAffiliate(null);
            setPayVia('whop');
            setPayNotes('');

            if (selectedAffiliate?.id === payingAffiliate.id) {
                await loadAffiliateDetail(selectedAffiliate);
            }
            await loadAffiliatesSimple();
        } catch (err: any) {
            alert('Error al marcar como pagado: ' + (err.message || err));
        }
    };

    // Get pending commission total for an affiliate
    const getPendingTotal = (affiliateId: string) => {
        return commissions
            .filter(c => c.referral_code_id === affiliateId && c.status === 'pending')
            .reduce((sum, c) => sum + c.commission_amount_cents, 0);
    };

    // ──────── Detail View ────────
    if (selectedAffiliate) {
        const pendingTotal = getPendingTotal(selectedAffiliate.id);
        const paidTotal = commissions
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + c.commission_amount_cents, 0);

        return (
            <div className="space-y-6 pb-20 animate-fade-in">
                <button
                    onClick={() => { setSelectedAffiliate(null); setReferredUsers([]); setCommissions([]); }}
                    className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    Volver a Afiliados
                </button>

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{selectedAffiliate.affiliate_name}</h2>
                        <p className="text-slate-400 text-sm">{selectedAffiliate.channel_name || selectedAffiliate.code}</p>
                        <div className="flex items-center gap-3 mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${selectedAffiliate.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {selectedAffiliate.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                            <span className="text-slate-500 text-xs">Comisión: {selectedAffiliate.commission_pct}%</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => openEdit(selectedAffiliate)}
                            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm"
                        >
                            Editar
                        </button>
                        {pendingTotal > 0 && (
                            <button
                                onClick={() => setPayingAffiliate(selectedAffiliate)}
                                className="px-4 py-2 bg-brand text-slate-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors text-sm"
                            >
                                Pagar ${(pendingTotal / 100).toFixed(2)} pendiente
                            </button>
                        )}
                    </div>
                </div>

                {/* Link */}
                <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">Link de afiliado</p>
                    <div className="flex items-center gap-2">
                        <code className="text-brand text-sm flex-1 break-all">https://derbix.co/signup?ref={selectedAffiliate.code}</code>
                        <button
                            onClick={() => navigator.clipboard.writeText(`https://derbix.co/signup?ref=${selectedAffiliate.code}`)}
                            className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs hover:bg-slate-600 transition-colors shrink-0"
                        >
                            Copiar
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                        <p className="text-xs text-slate-500">Referidos</p>
                        <p className="text-2xl font-bold text-white">{referredUsers.length}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                        <p className="text-xs text-slate-500">Pagando</p>
                        <p className="text-2xl font-bold text-emerald-400">{referredUsers.filter(u => u.has_paid).length}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                        <p className="text-xs text-slate-500">Pendiente</p>
                        <p className="text-2xl font-bold text-amber-400">${(pendingTotal / 100).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                        <p className="text-xs text-slate-500">Total pagado</p>
                        <p className="text-2xl font-bold text-slate-300">${(paidTotal / 100).toFixed(2)}</p>
                    </div>
                </div>

                {/* Contact info */}
                {(selectedAffiliate.contact_email || selectedAffiliate.contact_phone || selectedAffiliate.channel_url) && (
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-slate-500 font-bold uppercase">Contacto</p>
                        {selectedAffiliate.contact_email && <p className="text-sm text-slate-300">Email: {selectedAffiliate.contact_email}</p>}
                        {selectedAffiliate.contact_phone && <p className="text-sm text-slate-300">Teléfono: {selectedAffiliate.contact_phone}</p>}
                        {selectedAffiliate.channel_url && (
                            <p className="text-sm text-slate-300">
                                Canal: <a href={selectedAffiliate.channel_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{selectedAffiliate.channel_url}</a>
                            </p>
                        )}
                        {selectedAffiliate.whop_username && <p className="text-sm text-slate-300">Whop: {selectedAffiliate.whop_username}</p>}
                    </div>
                )}

                {detailLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Referred users */}
                        <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-3">Usuarios referidos ({referredUsers.length})</p>
                            {referredUsers.length === 0 ? (
                                <p className="text-slate-500 text-sm">Aún no hay usuarios referidos</p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {referredUsers.map(user => (
                                        <div key={user.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                            <div>
                                                <p className="text-sm text-white">{user.full_name || 'Sin nombre'}</p>
                                                <p className="text-xs text-slate-500">{user.email}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${user.has_paid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                                    {user.plan_name}
                                                </span>
                                                <p className="text-xs text-slate-500 mt-1">{new Date(user.created_at).toLocaleDateString('es-CO')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Commissions */}
                        <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                            <p className="text-xs text-slate-500 font-bold uppercase mb-3">Historial de comisiones ({commissions.length})</p>
                            {commissions.length === 0 ? (
                                <p className="text-slate-500 text-sm">No hay comisiones registradas. Usa "Calcular Comisiones" arriba.</p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {commissions.map(com => (
                                        <div key={com.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                            <div>
                                                <p className="text-sm text-white">${(com.payment_amount_cents / 100).toFixed(2)} pago → ${(com.commission_amount_cents / 100).toFixed(2)} comisión</p>
                                                <p className="text-xs text-slate-500">{new Date(com.created_at).toLocaleDateString('es-CO')}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                com.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                                                com.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                                                'bg-red-500/10 text-red-400'
                                            }`}>
                                                {com.status === 'paid' ? 'Pagada' : com.status === 'pending' ? 'Pendiente' : 'Anulada'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Pay modal */}
                {payingAffiliate && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-md w-full">
                            <h3 className="text-lg font-bold text-white mb-4">Registrar pago a {payingAffiliate.affiliate_name}</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Monto pendiente: <span className="text-amber-400 font-bold">${(getPendingTotal(payingAffiliate.id) / 100).toFixed(2)} USD</span>
                            </p>

                            <div className="space-y-3 mb-6">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Método de pago</label>
                                    <select
                                        value={payVia}
                                        onChange={e => setPayVia(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                                    >
                                        <option value="whop">Whop</option>
                                        <option value="transfer">Transferencia bancaria</option>
                                        <option value="crypto">Crypto</option>
                                        <option value="other">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Notas (opcional)</label>
                                    <input
                                        value={payNotes}
                                        onChange={e => setPayNotes(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                                        placeholder="Ej: Pago abril 2026, ref #123"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setPayingAffiliate(null)}
                                    className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={markAsPaid}
                                    className="flex-1 px-4 py-2.5 bg-brand text-slate-900 font-bold rounded-lg text-sm"
                                >
                                    Confirmar Pago
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit form modal (reused) */}
                {showForm && renderFormModal()}
            </div>
        );
    }

    // ──────── Form Modal ────────
    const renderFormModal = () => (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-white mb-4">
                    {editingId ? 'Editar Afiliado' : 'Nuevo Afiliado'}
                </h3>

                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Código *</label>
                            <input
                                value={form.code}
                                onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                                className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                                placeholder="juanyt"
                                disabled={!!editingId}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Comisión %</label>
                            <input
                                type="number"
                                value={form.commission_pct}
                                onChange={e => setForm({ ...form, commission_pct: Number(e.target.value) })}
                                className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                                min={0}
                                max={100}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Nombre completo *</label>
                        <input
                            value={form.affiliate_name}
                            onChange={e => setForm({ ...form, affiliate_name: e.target.value })}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                            placeholder="Juan Pérez"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Nombre del canal</label>
                        <input
                            value={form.channel_name}
                            onChange={e => setForm({ ...form, channel_name: e.target.value })}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                            placeholder="Juan Fútbol TV"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1">URL del canal</label>
                        <input
                            value={form.channel_url}
                            onChange={e => setForm({ ...form, channel_url: e.target.value })}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                            placeholder="https://youtube.com/@juanfutboltv"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Email</label>
                            <input
                                value={form.contact_email}
                                onChange={e => setForm({ ...form, contact_email: e.target.value })}
                                className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                                placeholder="juan@email.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">WhatsApp</label>
                            <input
                                value={form.contact_phone}
                                onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                                className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                                placeholder="+57 300 123 4567"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Usuario Whop (para pagos)</label>
                        <input
                            value={form.whop_username}
                            onChange={e => setForm({ ...form, whop_username: e.target.value })}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                            placeholder="username_whop"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Notas internas</label>
                        <textarea
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white text-sm"
                            rows={2}
                            placeholder="Notas sobre este afiliado..."
                        />
                    </div>
                </div>

                {error && (
                    <p className="text-red-400 text-sm mt-3">{error}</p>
                )}

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setError(''); }}
                        className="flex-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-brand text-slate-900 font-bold rounded-lg text-sm disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Afiliado'}
                    </button>
                </div>
            </div>
        </div>
    );

    // ──────── Main List View ────────
    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {onBack && (
                <button
                    onClick={onBack}
                    className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    Volver a Admin
                </button>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Programa de Afiliados</h2>
                    <p className="text-slate-400 text-sm">Gestiona YouTubers e influencers que refieren usuarios a Derbix</p>
                </div>

                <button
                    onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); setError(''); }}
                    className="px-5 py-2.5 bg-brand text-slate-900 font-bold rounded-xl hover:bg-emerald-400 transition-colors text-sm"
                >
                    + Nuevo Afiliado
                </button>
            </div>

            {/* Commission calculator */}
            <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <label className="text-sm text-slate-400 whitespace-nowrap">Calcular comisiones del mes:</label>
                    <input
                        type="month"
                        value={calcMonth}
                        onChange={e => setCalcMonth(e.target.value)}
                        className="bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                    />
                </div>
                <button
                    onClick={calculateCommissions}
                    disabled={calculating}
                    className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                    {calculating ? 'Calculando...' : 'Calcular Comisiones'}
                </button>
            </div>

            {/* Affiliate list */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
            ) : affiliates.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-500 text-lg mb-2">No hay afiliados registrados</p>
                    <p className="text-slate-600 text-sm">Crea tu primer afiliado con el botón "+ Nuevo Afiliado"</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {affiliates.map(affiliate => (
                        <div
                            key={affiliate.id}
                            className="bg-slate-800/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors cursor-pointer"
                            onClick={() => loadAffiliateDetail(affiliate)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-brand font-bold text-sm">
                                        {affiliate.affiliate_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-medium">{affiliate.affiliate_name}</p>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${affiliate.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {affiliate.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {affiliate.channel_name || affiliate.code} — {affiliate.commission_pct}% comisión
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 text-right">
                                    <div>
                                        <p className="text-lg font-bold text-white">{affiliate.total_referrals || 0}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Referidos</p>
                                    </div>
                                    <div className="hidden sm:block">
                                        <p className="text-xs text-slate-500">ref={affiliate.code}</p>
                                    </div>
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => openEdit(affiliate)}
                                            className="p-2 text-slate-500 hover:text-white transition-colors"
                                            title="Editar"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                        </button>
                                        <button
                                            onClick={() => toggleActive(affiliate)}
                                            className={`p-2 transition-colors ${affiliate.is_active ? 'text-slate-500 hover:text-red-400' : 'text-slate-500 hover:text-emerald-400'}`}
                                            title={affiliate.is_active ? 'Desactivar' : 'Activar'}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d={affiliate.is_active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form modal */}
            {showForm && renderFormModal()}
        </div>
    );
};
