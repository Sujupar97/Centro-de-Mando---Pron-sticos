
import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { UserProfile } from '../../types';
import { UserGroupIcon, MagnifyingGlassIcon, PencilSquareIcon, ShieldCheckIcon } from '../icons/Icons';
import { useAuth } from '../../hooks/useAuth';

export const UsersList: React.FC = () => {
    const { profile } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await adminService.listAllUsers(searchTerm);
            setUsers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadUsers();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleRoleUpdate = async (userId: string, newRole: 'user' | 'admin' | 'superadmin') => {
        if (!confirm(`¿Estás seguro de cambiar el rol de este usuario a ${newRole.toUpperCase()}?`)) return;

        try {
            await adminService.updateUserRole(userId, newRole);
            setEditingUser(null);
            loadUsers(); // Refresh
        } catch (e) {
            alert('Error al actualizar rol');
        }
    };

    return (
        <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl animate-fade-in relative">
            <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                <UserGroupIcon className="w-6 h-6 text-purple-400" />
                Gestión Global de Usuarios
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full border border-white/5">
                    {users.length} Usuarios
                </span>
            </h2>

            {/* Search Bar */}
            <div className="mb-6 relative">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder="Buscar por email o nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-purple-500/50"
                />
            </div>

            {/* Table */}
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-900/50 text-xs uppercase text-gray-400 font-bold">
                        <tr>
                            <th className="px-6 py-4 rounded-l-lg">Usuario</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Rol Global</th>
                            <th className="px-6 py-4">Org ID</th>
                            <th className="px-6 py-4 rounded-r-lg text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-8 text-gray-500">Cargando...</td></tr>
                        ) : users.map(user => (
                            <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold border border-purple-500/30">
                                            {(user.full_name?.[0] || user.email?.[0] || '?').toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{user.full_name || 'Sin Nombre'}</p>
                                            <p className="text-xs text-gray-500 font-mono">{user.id.substring(0, 8)}...</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-300">
                                    {user.email}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold border ${getContentByRole(user.role)}`}>
                                        {user.role?.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                                    {user.organization_id || 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => setEditingUser(user)}
                                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                                        title="Editar Rol"
                                    >
                                        <PencilSquareIcon className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editingUser && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
                    <div className="bg-slate-800 border border-white/10 p-6 rounded-xl w-full max-w-md shadow-2xl relative">
                        <h3 className="text-lg font-bold text-white mb-4">Editar Rol: <span className="text-purple-400">{editingUser.email}</span></h3>

                        <div className="space-y-4">
                            {(['user', 'admin', 'superadmin'] as const).map((role) => (
                                <button
                                    key={role}
                                    onClick={() => handleRoleUpdate(editingUser.id, role)}
                                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all
                                        ${editingUser.role === role
                                            ? 'bg-purple-600/20 border-purple-500 text-white'
                                            : 'bg-slate-700/50 border-white/5 text-gray-400 hover:bg-slate-700 hover:text-white'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <ShieldCheckIcon className={`w-5 h-5 ${editingUser.role === role ? 'text-purple-400' : 'text-gray-500'}`} />
                                        <span className="uppercase font-bold text-sm">{role}</span>
                                    </div>
                                    {editingUser.role === role && <span className="text-xs text-purple-400 font-bold">ACTUAL</span>}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setEditingUser(null)}
                            className="mt-6 w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

function getContentByRole(role: string) {
    switch (role) {
        case 'superadmin': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
        case 'admin': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        default: return 'bg-slate-700/50 text-slate-400 border-slate-600/30';
    }
}
