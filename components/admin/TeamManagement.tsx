
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../contexts/OrganizationContext';
import { organizationService } from '../../services/organizationService';
import { supabase } from '../../services/supabaseService';
import { OrganizationMember, OrganizationInvitation, OrganizationRole } from '../../types';
import {
    PlusIcon, TrashIcon, EllipsisVerticalIcon, CalendarDaysIcon,
    UserIcon, PhotoIcon, GlobeAltIcon, MapPinIcon,
    ShieldCheckIcon, CheckCircleIcon, XCircleIcon
} from '../../components/icons/Icons';

export const TeamManagement: React.FC = () => {
    const { currentOrg, userRole } = useOrganization();
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'usuario'>('usuario');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [error, setError] = useState('');

    // Edit Org State
    const [isEditingOrg, setIsEditingOrg] = useState(false);
    const [orgForm, setOrgForm] = useState({ name: '', slogan: '', website: '', location: '' });

    // Edit Profile State (My Profile)
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({ full_name: '', avatar_url: '', email: '' });

    // Manage Member State (Other Users)
    const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'permissions'>('info');
    const [permissionsForm, setPermissionsForm] = useState<Record<string, boolean>>({});
    const [roleForm, setRoleForm] = useState<OrganizationRole>('usuario');

    const canManage = userRole === 'owner' || userRole === 'admin';

    // Permissions Definition
    const PERMISSIONS_CONFIG = [
        { key: 'can_view_analysis', label: 'Ver Análisis IA', description: 'Acceso a predicciones y reportes de IA' },
        { key: 'can_create_bets', label: 'Gestión de Apuestas', description: 'Crear, editar y eliminar apuestas' },
        { key: 'can_view_financials', label: 'Datos Financieros', description: 'Ver dashboard de bankroll y ROI' },
        { key: 'can_manage_team', label: 'Gestionar Equipo', description: 'Invitar y editar miembros (Solo Admin)' },
    ];

    const fetchData = async () => {
        if (!currentOrg) return;
        setLoading(true);
        try {
            const [membersData, invitesData] = await Promise.all([
                organizationService.getOrganizationMembers(currentOrg.id),
                canManage ? organizationService.getPendingInvitations(currentOrg.id) : Promise.resolve([])
            ]);

            setMembers(membersData);
            setInvitations(invitesData);

            // Init Org Form
            setOrgForm({
                name: currentOrg.name,
                slogan: currentOrg.metadata?.slogan || '',
                website: currentOrg.metadata?.website || '',
                location: currentOrg.metadata?.location || ''
            });

            // Init Profile Form from current user data in list
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const me = membersData.find((m: any) => m.user_id === user.id);
                if (me && me.profile) {
                    setProfileForm({
                        full_name: me.profile.full_name || '',
                        avatar_url: me.profile.avatar_url || '',
                        email: me.profile.email || user.email || ''
                    });
                }
            }
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

    // Handlers
    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail || !currentOrg) return;
        setInviteLoading(true);
        setError('');
        try {
            await organizationService.inviteMember(currentOrg.id, inviteEmail, inviteRole);
            setInviteEmail('');
            const newInvites = await organizationService.getPendingInvitations(currentOrg.id);
            setInvitations(newInvites);
        } catch (err: any) {
            setError(err.message || 'Error al enviar invitación.');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleUpdateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentOrg) return;
        try {
            const metadata = {
                ...currentOrg.metadata,
                slogan: orgForm.slogan,
                website: orgForm.website,
                location: orgForm.location
            };
            await organizationService.updateOrganization(currentOrg.id, {
                name: orgForm.name,
                // @ts-ignore
                metadata: metadata
            });
            setIsEditingOrg(false);
            window.location.reload();
        } catch (err: any) {
            alert("Error al actualizar organización: " + err.message);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('profiles').update({
                full_name: profileForm.full_name,
                avatar_url: profileForm.avatar_url
            }).eq('id', (await supabase.auth.getUser()).data.user?.id);
            if (error) throw error;
            setIsEditingProfile(false);
            fetchData();
        } catch (err: any) {
            alert("Error al actualizar perfil: " + err.message);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm("¿Estás seguro de eliminar a este miembro?") || !currentOrg) return;
        try {
            await organizationService.removeMember(memberId);
            setMembers(members.filter(m => m.id !== memberId));
            setSelectedMember(null);
        } catch (err: any) {
            alert(err.message);
        }
    }

    const handleMemberClick = (member: OrganizationMember) => {
        if (!canManage) return;
        setSelectedMember(member);
        setActiveTab('info');
        setRoleForm(member.role);
        // Load existing permissions or defaults
        const defaultPerms = member.role === 'admin' || member.role === 'owner'
            ? { can_view_analysis: true, can_create_bets: true, can_view_financials: true, can_manage_team: true }
            : { can_view_analysis: true, can_create_bets: true, can_view_financials: false, can_manage_team: false };

        setPermissionsForm(member.permissions || defaultPerms);
    };

    const handleSavePermissions = async () => {
        if (!selectedMember) return;
        try {
            // Update Role
            if (selectedMember.role !== roleForm && selectedMember.role !== 'owner') {
                await organizationService.updateMemberRole(selectedMember.id, roleForm);
            }
            // Update Permissions
            await organizationService.updateMemberPermissions(selectedMember.id, permissionsForm);

            setSelectedMember(null);
            fetchData(); // Refresh to show updates
        } catch (err: any) {
            alert("Error al guardar permisos: " + err.message);
        }
    };

    const togglePermission = (key: string) => {
        setPermissionsForm(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    if (!currentOrg) return <div>No hay organización seleccionada.</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white font-display">Equipo y Configuración</h2>
                    <p className="text-slate-400">Gestiona los miembros y datos de {currentOrg.name}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsEditingProfile(true)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm border border-white/10 transition-colors flex items-center gap-2"
                    >
                        <UserIcon className="w-4 h-4" />
                        Editar Mi Perfil
                    </button>
                    {canManage && (
                        <button
                            onClick={() => setIsEditingOrg(true)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm border border-white/10 transition-colors flex items-center gap-2"
                        >
                            <GlobeAltIcon className="w-4 h-4" />
                            Editar Organización
                        </button>
                    )}
                </div>
            </div>

            {/* MEMBER DETAIL MODAL (GoHighLevel Style) */}
            {selectedMember && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-4xl h-[600px] flex overflow-hidden shadow-2xl">

                        {/* Sidebar */}
                        <div className="w-64 border-r border-white/5 bg-slate-900/50 p-6 flex flex-col gap-6">
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center mb-3">
                                    {selectedMember.profile?.avatar_url ? (
                                        <img src={selectedMember.profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserIcon className="w-8 h-8 text-slate-600" />
                                    )}
                                </div>
                                <h3 className="text-white font-bold truncate">{selectedMember.profile?.full_name || 'Sin Nombre'}</h3>
                                <p className="text-xs text-slate-500 truncate">{selectedMember.profile?.email}</p>
                            </div>

                            <nav className="flex flex-col gap-1">
                                <button
                                    onClick={() => setActiveTab('info')}
                                    className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'info' ? 'bg-brand/10 text-brand' : 'text-slate-400 hover:bg-white/5'}`}
                                >
                                    Información de Usuario
                                </button>
                                <button
                                    onClick={() => setActiveTab('permissions')}
                                    className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'permissions' ? 'bg-brand/10 text-brand' : 'text-slate-400 hover:bg-white/5'}`}
                                >
                                    Roles y Permisos
                                </button>
                            </nav>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col">
                            {/* Header */}
                            <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white">
                                    {activeTab === 'info' ? 'Editar Información' : 'Gestionar Permisos'}
                                </h3>
                                <button onClick={() => setSelectedMember(null)} className="text-slate-400 hover:text-white">
                                    <XCircleIcon className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 p-8 overflow-y-auto">
                                {activeTab === 'info' && (
                                    <div className="space-y-6 max-w-lg">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre Completo</label>
                                                <input
                                                    disabled
                                                    value={selectedMember.profile?.full_name || ''}
                                                    className="w-full bg-slate-800/50 border border-white/5 rounded-lg p-3 text-slate-400 cursor-not-allowed"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
                                                <input
                                                    disabled
                                                    value={selectedMember.profile?.email || ''}
                                                    className="w-full bg-slate-800/50 border border-white/5 rounded-lg p-3 text-slate-400 cursor-not-allowed"
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Se unió el</label>
                                                <div className="p-3 bg-slate-800/50 rounded-lg text-slate-400 text-sm">
                                                    {new Date(selectedMember.joined_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        {selectedMember.role !== 'owner' && (
                                            <div className="pt-6 border-t border-white/5">
                                                <button
                                                    onClick={() => handleRemoveMember(selectedMember.id)}
                                                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                    Eliminar Usuario de la Organización
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'permissions' && (
                                    <div className="space-y-8">
                                        {/* Role Selector */}
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rol Principal</label>
                                            <select
                                                value={roleForm}
                                                onChange={(e) => setRoleForm(e.target.value as OrganizationRole)}
                                                disabled={selectedMember.role === 'owner'}
                                                className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-white focus:border-brand outline-none"
                                            >
                                                <option value="usuario">Usuario (Estándar)</option>
                                                <option value="admin">Administrador (Acceso Total)</option>
                                                <option value="owner" disabled>Dueño</option>
                                            </select>
                                            <p className="text-xs text-slate-500 mt-2">
                                                {roleForm === 'admin'
                                                    ? 'Tiene acceso a gestionar miembros, configuraciones y ver todo.'
                                                    : 'Acceso limitado a lo que se defina en los permisos abajo.'}
                                            </p>
                                        </div>

                                        {/* Granular Permissions */}
                                        <div>
                                            <h4 className="text-sm font-bold text-white mb-4">Permisos Granulares</h4>
                                            <div className="space-y-3">
                                                {PERMISSIONS_CONFIG.map(perm => (
                                                    <div key={perm.key} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${permissionsForm[perm.key] ? 'bg-brand/20 text-brand' : 'bg-slate-700 text-slate-400'}`}>
                                                                <ShieldCheckIcon className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-white">{perm.label}</p>
                                                                <p className="text-xs text-slate-500">{perm.description}</p>
                                                            </div>
                                                        </div>
                                                        {/* Toggle Switch */}
                                                        <button
                                                            onClick={() => togglePermission(perm.key)}
                                                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${permissionsForm[perm.key] ? 'bg-brand' : 'bg-slate-700'}`}
                                                        >
                                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${permissionsForm[perm.key] ? 'translate-x-6' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-slate-900/50">
                                <button
                                    onClick={() => setSelectedMember(null)}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSavePermissions}
                                    className="px-6 py-2 bg-brand text-slate-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Edit Org & Profile Modals (Kept same logic, just hidden for code brevity in this chunk, assuming they are reused/rendered below) */}
            {isEditingOrg && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-xl max-w-2xl w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <GlobeAltIcon className="w-6 h-6 text-brand" />
                            Configuración de Organización
                        </h3>
                        <form onSubmit={handleUpdateOrg} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre Comercial</label>
                                <input type="text" value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white focus:border-brand outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Slogan / Nicho</label>
                                <input type="text" value={orgForm.slogan} onChange={e => setOrgForm({ ...orgForm, slogan: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white focus:border-brand outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ubicación</label>
                                <div className="relative">
                                    <MapPinIcon className="w-5 h-5 absolute left-3 top-3.5 text-slate-500" />
                                    <input type="text" value={orgForm.location} onChange={e => setOrgForm({ ...orgForm, location: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 pl-10 text-white focus:border-brand outline-none transition-colors" />
                                </div>
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sitio Web / Red Social</label>
                                <div className="relative">
                                    <GlobeAltIcon className="w-5 h-5 absolute left-3 top-3.5 text-slate-500" />
                                    <input type="text" value={orgForm.website} onChange={e => setOrgForm({ ...orgForm, website: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 pl-10 text-white focus:border-brand outline-none transition-colors" />
                                </div>
                            </div>
                            <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setIsEditingOrg(false)} className="px-5 py-2.5 text-slate-400 hover:text-white font-medium transition-colors">Cancelar</button>
                                <button type="submit" className="px-5 py-2.5 bg-brand text-slate-900 font-bold rounded-lg hover:bg-emerald-400 shadow-lg shadow-brand/20 transition-all">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isEditingProfile && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-xl max-w-lg w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <UserIcon className="w-6 h-6 text-brand" />
                            Editar Mi Perfil
                        </h3>
                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div className="flex items-center gap-6 justify-center py-4 bg-white/5 rounded-lg border border-white/5 border-dashed">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center">
                                        {profileForm.avatar_url ? (
                                            <img src={profileForm.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="w-10 h-10 text-slate-600" />
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full transition-opacity cursor-not-allowed">
                                        <PhotoIcon className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                                <div className="flex-1 max-w-[200px]">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Avatar URL</label>
                                    <input type="text" value={profileForm.avatar_url} onChange={e => setProfileForm({ ...profileForm, avatar_url: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-slate-300" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre Completo</label>
                                    <input type="text" value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-white focus:border-brand outline-none transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
                                    <input type="email" readOnly value={profileForm.email} className="w-full bg-slate-800/50 border border-white/5 rounded-lg p-3 text-slate-400 cursor-not-allowed" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setIsEditingProfile(false)} className="px-5 py-2.5 text-slate-400 hover:text-white font-medium transition-colors">Cancelar</button>
                                <button type="submit" className="px-5 py-2.5 bg-brand text-slate-900 font-bold rounded-lg hover:bg-emerald-400 shadow-lg shadow-brand/20 transition-all">Guardar Perfil</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Invite Column */}
                {canManage && (
                    <div className="lg:col-span-1 space-y-8">
                        <div className="glass p-6 rounded-xl border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <PlusIcon className="w-5 h-5 text-brand" />
                                Invitar Miembro
                            </h3>
                            <form onSubmit={handleInvite} className="space-y-4">
                                <div>
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
                                <div>
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
                                    className="w-full px-6 py-2 bg-brand text-slate-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
                                >
                                    {inviteLoading ? 'Enviando...' : 'Invitar'}
                                </button>
                            </form>
                            {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
                        </div>

                        {/* Invitations List */}
                        {invitations.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4">Invitaciones Pendientes</h3>
                                <div className="glass rounded-xl overflow-hidden border border-white/5">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-white/5 text-slate-400">
                                            <tr>
                                                <th className="p-4 font-medium">Email</th>
                                                <th className="p-4 font-medium">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {invitations.map(inv => (
                                                <tr key={inv.id}>
                                                    <td className="p-4 text-white">
                                                        <div className="flex flex-col">
                                                            <span>{inv.email}</span>
                                                            <span className="text-xs text-slate-500 capitalize">{inv.role}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4"><span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded text-xs">Pendiente</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Members List Column */}
                <div className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
                    <h3 className="text-lg font-bold text-white mb-4">Miembros Activos</h3>
                    <div className="glass rounded-xl overflow-hidden border border-white/5">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500">Cargando miembros...</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-slate-400">
                                    <tr>
                                        <th className="p-4 font-medium">Usuario</th>
                                        <th className="p-4 font-medium">Rol</th>
                                        <th className="p-4 font-medium hidden sm:table-cell">Unido</th>
                                        <th className="p-4 font-medium text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {members.map(member => (
                                        <tr
                                            key={member.user_id}
                                            onClick={() => handleMemberClick(member)}
                                            className={`transition-colors ${canManage ? 'hover:bg-white/5 cursor-pointer' : ''}`}
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    {member.profile?.avatar_url ? (
                                                        <img src={member.profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                                                            <UserIcon className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-white font-medium">
                                                            {member.profile?.full_name || 'Sin Nombre'}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {member.profile?.email || 'No email'}
                                                        </p>
                                                    </div>
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
                                            <td className="p-4 text-slate-500 hidden sm:table-cell">{new Date(member.joined_at).toLocaleDateString()}</td>
                                            <td className="p-4 text-right">
                                                {canManage && (
                                                    <span className="p-2 text-slate-500 hover:text-white">
                                                        <EllipsisVerticalIcon className="w-5 h-5" />
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
