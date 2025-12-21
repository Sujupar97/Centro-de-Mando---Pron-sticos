
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../contexts/OrganizationContext';
import { organizationService } from '../../services/organizationService';
import { OrganizationMember, OrganizationInvitation } from '../../types';
import { PlusIcon, TrashIcon, EllipsisVerticalIcon, CalendarDaysIcon, UserIcon } from '../../components/icons/Icons';

export const TeamManagement: React.FC = () => {
    const { currentOrg, userRole } = useOrganization();
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'usuario'>('usuario');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [error, setError] = useState('');

    const canManage = userRole === 'owner' || userRole === 'admin';

    const fetchData = async () => {
        if (!currentOrg) return;
        setLoading(true);
        try {
            const [membersData, invitesData] = await Promise.all([
                organizationService.getOrganizationMembers(currentOrg.id),
                // Only admins can see pending invitations usually, but checking role anyway
                canManage ? organizationService.getPendingInvitations(currentOrg.id) : Promise.resolve([])
            ]);
            setMembers(membersData);
            setInvitations(invitesData);
        } catch (err) {
            console.error("Error fetching team data:", err);
            setError("No se pudieron cargar los datos del equipo.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentOrg, userRole]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail || !currentOrg) return;
        setInviteLoading(true);
        setError('');
        try {
            await organizationService.inviteMember(currentOrg.id, inviteEmail, inviteRole);
            setInviteEmail('');
            // Refresh
            const newInvites = await organizationService.getPendingInvitations(currentOrg.id);
            setInvitations(newInvites);
        } catch (err: any) {
            setError(err.message || 'Error al enviar invitación.');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm("¿Estás seguro de eliminar a este miembro?") || !currentOrg) return;
        try {
            await organizationService.removeMember(memberId);
            setMembers(members.filter(m => m.id !== memberId));
        } catch (err: any) {
            alert(err.message);
        }
    }

    const handleCancelInvitation = async (invitationId: string) => {
        // Logic to cancel invitation - needs method in service if not exists, 
        // or just delete from DB if we have RLS setup (which we do)
        // For now, assuming we might need to add cancelInvitation to service.
        // Let's verify service methods later.

        // If no cancel method exists in service yet, we'll just skip detailed impl or add it.
        // 'removeMember' usually implies removing existing. 
        // For now let's just show list.
    }

    if (!currentOrg) return <div>No hay organización seleccionada.</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white font-display">Equipo</h2>
                    <p className="text-slate-400">Gestiona los miembros de {currentOrg.name}</p>
                </div>
            </div>

            {/* Invite Form */}
            {canManage && (
                <div className="glass p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <PlusIcon className="w-5 h-5 text-brand" />
                        Invitar Miembro
                    </h3>
                    <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="text-xs text-slate-500 mb-1 block">Correo Electrónico</label>
                            <input
                                type="email"
                                required
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-brand outline-none"
                                placeholder="usuario@ejemplo.com"
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <label className="text-xs text-slate-500 mb-1 block">Rol</label>
                            <select
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value as 'admin' | 'usuario')}
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-brand outline-none"
                            >
                                <option value="usuario">Usuario</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={inviteLoading}
                            className="w-full md:w-auto px-6 py-2 bg-brand text-slate-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
                        >
                            {inviteLoading ? 'Enviando...' : 'Invitar'}
                        </button>
                    </form>
                    {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
                </div>
            )}

            {/* Invitations List */}
            {canManage && invitations.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold text-white mb-4">Invitaciones Pendientes</h3>
                    <div className="glass rounded-xl overflow-hidden border border-white/5">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 text-slate-400">
                                <tr>
                                    <th className="p-4 font-medium">Email</th>
                                    <th className="p-4 font-medium">Rol</th>
                                    <th className="p-4 font-medium">Enviado</th>
                                    <th className="p-4 font-medium">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {invitations.map(inv => (
                                    <tr key={inv.id}>
                                        <td className="p-4 text-white">{inv.email}</td>
                                        <td className="p-4 capitalize text-slate-300">{inv.role}</td>
                                        <td className="p-4 text-slate-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                                        <td className="p-4"><span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded text-xs">Pendiente</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Members List */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4">Miembros Activos</h3>
                <div className="glass rounded-xl overflow-hidden border border-white/5">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Cargando miembros...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 text-slate-400">
                                <tr>
                                    <th className="p-4 font-medium">Usuario (ID)</th>
                                    <th className="p-4 font-medium">Rol</th>
                                    <th className="p-4 font-medium">Unido</th>
                                    {canManage && <th className="p-4 font-medium text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {members.map(member => (
                                    <tr key={member.user_id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-white font-mono text-xs">{member.user_id}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs capitalize ${member.role === 'owner' ? 'bg-purple-500/20 text-purple-400' :
                                                member.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {member.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-500">{new Date(member.joined_at).toLocaleDateString()}</td>
                                        {canManage && (
                                            <td className="p-4 text-right">
                                                {member.role !== 'owner' && (
                                                    <button
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                        title="Eliminar miembro"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
