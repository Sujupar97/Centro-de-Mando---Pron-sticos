
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { organizationService } from '../services/organizationService';
import { Organization, OrganizationRole } from '../types';

interface OrganizationContextType {
    currentOrg: Organization | null; // La org activa actualmente
    userRole: OrganizationRole | null; // El rol del usuario en esa org
    userOrganizations: { org: Organization, role: OrganizationRole }[]; // Lista de orgs del usuario
    isLoading: boolean;
    switchOrganization: (orgId: string) => Promise<void>;
    refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [userRole, setUserRole] = useState<OrganizationRole | null>(null);
    const [userOrganizations, setUserOrganizations] = useState<{ org: Organization, role: OrganizationRole }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Cargar organizaciones al iniciar o cambiar usuario
    const refreshOrganizations = async () => {
        if (!user) {
            setUserOrganizations([]);
            setCurrentOrg(null);
            setUserRole(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const orgs = await organizationService.getUserOrganizations();
            setUserOrganizations(orgs);

            // Lógica de "Last Used Org" o "Default"
            // Si ya hay una seleccionada y sigue siendo válida, mantenerla
            if (currentOrg && orgs.find(o => o.org.id === currentOrg.id)) {
                // Update data just in case
                const found = orgs.find(o => o.org.id === currentOrg.id);
                if (found) {
                    setCurrentOrg(found.org);
                    setUserRole(found.role);
                }
            } else if (orgs.length > 0) {
                // Seleccionar la primera por defecto (o guardar preferencia en localStorage)
                const savedOrgId = localStorage.getItem('last_org_id');
                const found = orgs.find(o => o.org.id === savedOrgId);

                if (found) {
                    setCurrentOrg(found.org);
                    setUserRole(found.role);
                } else {
                    setCurrentOrg(orgs[0].org);
                    setUserRole(orgs[0].role);
                }
            } else {
                // Usuario sin organización (caso raro si migramos a default)
                setCurrentOrg(null);
                setUserRole(null);
            }
        } catch (error) {
            console.error("Error loading organizations:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshOrganizations();
    }, [user]);

    // Guardar preferencia al cambiar
    useEffect(() => {
        if (currentOrg) {
            localStorage.setItem('last_org_id', currentOrg.id);
        }
    }, [currentOrg]);

    const switchOrganization = async (orgId: string) => {
        const found = userOrganizations.find(o => o.org.id === orgId);
        if (found) {
            setCurrentOrg(found.org);
            setUserRole(found.role);
        } else {
            console.warn("Intento de cambiar a una organización inválida");
        }
    };

    return (
        <OrganizationContext.Provider value={{
            currentOrg,
            userRole,
            userOrganizations,
            isLoading,
            switchOrganization,
            refreshOrganizations
        }}>
            {children}
        </OrganizationContext.Provider>
    );
};

export const useOrganization = () => {
    const context = useContext(OrganizationContext);
    if (context === undefined) {
        throw new Error('useOrganization must be used within an OrganizationProvider');
    }
    return context;
};
