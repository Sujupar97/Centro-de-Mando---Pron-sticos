import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { CheckCircleIcon } from './icons/Icons';

interface Profile {
    id: string;
    full_name: string | null;
    role: 'superadmin' | 'admin' | 'usuario';
}

export const AdminPage: React.FC = () => {
    const { profile } = useAuth();
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'superadmin' | 'admin' | 'usuario'>('usuario');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteMessage, setInviteMessage] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            if (!profile || (profile.role !== 'superadmin' && profile.role !== 'admin')) {
                setError('No tienes permiso para ver esta página.');
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase.from('profiles').select('*').order('role');
                if (error) throw error;
                setUsers(data as Profile[]);
            } catch (err: any) {
                setError('Error al cargar los usuarios: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, [profile]);

    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        setInviteMessage('');
        setError('');

        try {
            const { error: invokeError } = await supabase.functions.invoke('invite-user', {
                body: { email: inviteEmail, role: inviteRole },
            });

            if (invokeError) throw invokeError;
            
            setInviteMessage(`Invitación enviada exitosamente a ${inviteEmail}.`);
            setInviteEmail('');
        } catch (err: any) {
            setError('Error al invitar usuario: ' + (err.message || 'Error desconocido.'));
        } finally {
            setInviteLoading(false);
        }
    };
    
    const handleRoleChange = async (userId: string, newRole: 'superadmin' | 'admin' | 'usuario') => {
        if (profile?.id === userId) {
            setError("No puedes cambiar tu propio rol.");
            return;
        }
        setUpdatingUserId(userId);
        setError('');
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            setUsers(currentUsers =>
                currentUsers.map(u => (u.id === userId ? { ...u, role: newRole } : u))
            );
        } catch (err: any) {
            setError(`Error al actualizar el rol: ${err.message}`);
        } finally {
            setUpdatingUserId(null);
        }
    };


    if (loading) {
        return <div className="text-center">Cargando usuarios...</div>;
    }

    if (error && users.length === 0) {
        return <div className="text-center text-red-accent bg-red-500/10 p-4 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white">Administración de Usuarios</h2>
            
            {profile?.role === 'superadmin' && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-semibold text-white mb-4">Invitar Nuevo Usuario</h3>
                    <form onSubmit={handleInviteUser} className="flex flex-col sm:flex-row gap-4 items-center">
                        <input
                            type="email"
                            placeholder="Correo del nuevo usuario"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            required
                            className="flex-grow w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"
                        />
                         <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as 'superadmin' | 'admin' | 'usuario')}
                            className="w-full sm:w-auto bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"
                        >
                            <option value="usuario">Usuario</option>
                            <option value="admin">Administrador</option>
                            {profile?.role === 'superadmin' && <option value="superadmin">Superadministrador</option>}
                        </select>
                        <button
                            type="submit"
                            disabled={inviteLoading}
                            className="w-full sm:w-auto bg-green-accent hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-md transition duration-300 disabled:bg-gray-600"
                        >
                            {inviteLoading ? 'Enviando...' : 'Invitar'}
                        </button>
                    </form>
                    {inviteMessage && <p className="mt-3 text-sm text-green-accent">{inviteMessage}</p>}
                    {error && <p className="mt-3 text-sm text-red-accent">{error}</p>}
                </div>
            )}


            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th className="p-4 font-semibold">Nombre</th>
                                <th className="p-4 font-semibold">ID de Usuario</th>
                                <th className="p-4 font-semibold">Rol</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-gray-700/30">
                                    <td className="p-4 font-medium text-white">{user.full_name || 'N/A'}</td>
                                    <td className="p-4 text-gray-400 font-mono">{user.id}</td>
                                    <td className="p-4">
                                        {updatingUserId === user.id ? (
                                            <span className="text-sm text-gray-400">Actualizando...</span>
                                        ) : (
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value as 'superadmin' | 'admin' | 'usuario')}
                                                disabled={profile?.id === user.id || profile?.role !== 'superadmin' || updatingUserId !== null}
                                                className={`px-2 py-1 text-xs font-semibold rounded-full border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-green-accent transition-colors
                                                    ${ user.role === 'superadmin' ? 'bg-red-accent/20 text-red-accent' :
                                                       user.role === 'admin' ? 'bg-yellow-400/20 text-yellow-400' :
                                                       'bg-blue-500/20 text-blue-300'
                                                    }
                                                    ${profile?.role === 'superadmin' && profile.id !== user.id ? 'cursor-pointer hover:border-gray-500' : 'cursor-not-allowed opacity-70'}
                                                `}
                                            >
                                                <option value="usuario">Usuario</option>
                                                <option value="admin">Administrador</option>
                                                <option value="superadmin">Superadministrador</option>
                                            </select>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};