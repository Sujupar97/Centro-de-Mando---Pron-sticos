import React, { useEffect, useState } from 'react';
import { organizationService } from '../../services/organizationService';
import { useOrganization } from '../../contexts/OrganizationContext';
import { Organization } from '../../types';
import { BuildingOfficeIcon, ArrowRightOnRectangleIcon } from '../icons/Icons';

export const OrganizationsList: React.FC = () => {
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const { impersonateOrganization } = useOrganization();

    useEffect(() => {
        loadOrgs();
    }, []);

    const loadOrgs = async () => {
        try {
            const data = await organizationService.getAllOrganizations();
            setOrgs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleImpersonate = async (orgId: string) => {
        if (confirm("¿Estás seguro de que quieres iniciar sesión como esta organización?")) {
            await impersonateOrganization(orgId);
        }
    };

    if (loading) return <div className="text-center p-8 text-gray-400">Cargando organizaciones...</div>;

    return (
        <div className="glass p-6 rounded-xl border border-white/5 shadow-2xl animate-fade-in">
            <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                <BuildingOfficeIcon className="w-6 h-6 text-blue-400" />
                Gestión de Organizaciones
            </h2>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-900/50 text-xs uppercase text-gray-400 font-bold">
                        <tr>
                            <th className="px-6 py-4 rounded-l-lg">Organización</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Plan</th>
                            <th className="px-6 py-4">Creada</th>
                            <th className="px-6 py-4 rounded-r-lg text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {orgs.map(org => (
                            <tr key={org.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
                                            {org.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{org.name}</p>
                                            <p className="text-xs text-gray-500 font-mono">{org.id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${org.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {org.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-gray-300 capitalize">{org.subscription_plan}</span>
                                </td>
                                <td className="px-6 py-4 text-gray-500">
                                    {new Date(org.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleImpersonate(org.id)}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold border border-blue-600/50 transition-all shadow-lg hover:shadow-blue-500/20"
                                    >
                                        <ArrowRightOnRectangleIcon className="w-4 h-4" /> Login as Org
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
