
import { supabase } from './supabaseService';
import { Organization, OrganizationMember, OrganizationInvitation, OrganizationRole, UserProfile } from '../types';

export const organizationService = {

    /**
     * Obtiene las organizaciones a las que pertenece el usuario actual
     */
    async getUserOrganizations(): Promise<{ org: Organization, role: OrganizationRole }[]> {
        const { data: members, error } = await supabase
            .from('organization_members')
            .select(`
        role,
        organization:organizations (
          id, name, slug, status, subscription_plan, created_at, updated_at
        )
      `)
            .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

        if (error) throw error;

        // @ts-ignore - Supabase types mapping limitation
        return members.map(m => ({
            org: m.organization,
            role: m.role as OrganizationRole
        }));
    },

    /**
     * Obtiene la organización actual por ID (si el usuario es miembro)
     */
    async getOrganizationById(orgId: string): Promise<Organization | null> {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

        if (error) return null;
        return data as Organization;
    },

    /**
     * SUPERADMIN: Obtiene todas las organizaciones
     */
    async getAllOrganizations(): Promise<Organization[]> {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Organization[];
    },

    /**
     * Crea una nueva organización 
     */
    async createOrganization(name: string, slug: string): Promise<Organization> {
        const { data, error } = await supabase
            .from('organizations')
            .insert([{ name, slug }])
            .select()
            .single();

        if (error) throw error;

        // El trigger en backend debería añadir al creador como owner, pero por seguridad lo hacemos explícito si falla
        // (Nota: En nuestro SQL migrado, no pusimos trigger automático para member, así que debemos añadirlo manual)
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
            await supabase.from('organization_members').insert({
                organization_id: data.id,
                user_id: user.id,
                role: 'owner'
            });
        }

        return data as Organization;
    },

    /**
     * Obtiene los miembros de una organización
     */
    async getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
        const { data, error } = await supabase
            .from('organization_members')
            .select(`
        *,
        profile:profiles (
          full_name, email, avatar_url
        )
      `)
            .eq('organization_id', orgId);

        if (error) throw error;

        // Mapear respuesta plana a estructura anidada si es necesario
        return data.map((item: any) => ({
            ...item,
            profile: item.profile
        })) as OrganizationMember[];
    },

    /**
     * Invita a un usuario a la organización por email
     */
    async inviteMember(orgId: string, email: string, role: OrganizationRole): Promise<OrganizationInvitation> {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) throw new Error("No autenticado");

        const { data, error } = await supabase
            .from('organization_invitations')
            .insert({
                organization_id: orgId,
                email,
                role,
                invited_by: user.id
            })
            .select()
            .single();

        if (error) throw error;
        return data as OrganizationInvitation;
    },

    /**
     * Acepta una invitación usando el token
     */
    async acceptInvitation(token: string): Promise<void> {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) throw new Error("Debes iniciar sesión para aceptar la invitación");

        // Buscar invitación
        const { data: invitation, error: fetchError } = await supabase
            .from('organization_invitations')
            .select('*')
            .eq('token', token)
            .single();

        if (fetchError || !invitation) throw new Error("Invitación inválida o expirada");

        // Verificar si el email coincide (opcional, pero recomendado)
        if (invitation.email !== user.email) {
            console.warn("Email de invitación no coincide con usuario logueado");
            // Permitimos continuar o bloqueamos según política estricta. Dejamos pasar por usabilidad.
        }

        // Crear membresía
        const { error: insertError } = await supabase
            .from('organization_members')
            .insert({
                organization_id: invitation.organization_id,
                user_id: user.id,
                role: invitation.role,
                invited_by: invitation.invited_by
            });

        if (insertError) throw insertError;

        // Marcar invitación como aceptada (o borrarla)
        await supabase
            .from('organization_invitations')
            .update({
                accepted_at: new Date().toISOString(),
                accepted_by: user.id
            })
            .eq('id', invitation.id);
    },

    /**
     * Elimina un miembro de la organización
     */
    async removeMember(memberId: string): Promise<void> {
        const { error } = await supabase
            .from('organization_members')
            .delete()
            .eq('id', memberId);

        if (error) throw error;
    },

    /**
     * Actualiza el rol de un miembro
     */
    async updateMemberRole(memberId: string, newRole: OrganizationRole): Promise<void> {
        const { error } = await supabase
            .from('organization_members')
            .update({ role: newRole })
            .eq('id', memberId);

        if (error) throw error;
    },
    /**
     * Obtiene invitaciones pendientes de una organización
     */
    async getPendingInvitations(orgId: string): Promise<OrganizationInvitation[]> {
        const { data, error } = await supabase
            .from('organization_invitations')
            .select('*')
            .eq('organization_id', orgId)
            .is('accepted_at', null);

        if (error) throw error;
        return data as OrganizationInvitation[];
    },
};
