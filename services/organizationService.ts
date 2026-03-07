
import { supabase } from './supabaseService';
import { Organization, OrganizationMember, OrganizationInvitation, OrganizationRole, OrganizationWithDetails, UserProfile } from '../types';

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

    async updateOrganization(orgId: string, updates: Partial<{ name: string, settings: any, metadata: any }>): Promise<void> {
        const { error } = await supabase
            .from('organizations')
            .update(updates)
            .eq('id', orgId);

        if (error) throw error;
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
        // Step 1: Get members info (without joining profiles yet to avoid FK error)
        const { data: members, error: membersError } = await supabase
            .from('organization_members')
            .select('*')
            .eq('organization_id', orgId);

        if (membersError) throw membersError;

        if (!members || members.length === 0) return [];

        // Step 2: Get profiles for these users
        const userIds = members.map((m: any) => m.user_id);

        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', userIds);

        if (profilesError) throw profilesError;

        // Step 3: Map profiles to members
        const profilesMap = new Map(profiles?.map((p: any) => [p.id, p]));

        return members.map((item: any) => ({
            ...item,
            profile: profilesMap.get(item.user_id) || { full_name: 'Usuario', email: '' }
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
     * Update permissions for a member
     */
    async updateMemberPermissions(memberId: string, permissions: Record<string, boolean>): Promise<void> {
        const { error } = await supabase
            .from('organization_members')
            .update({ permissions })
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

    /**
     * AGENCY: Obtiene todas las organizaciones con datos enriquecidos
     * (email real del owner, plan real de user_subscriptions, etc.)
     */
    async getOrganizationsWithDetails(): Promise<OrganizationWithDetails[]> {
        // 3 queries en paralelo
        const [orgsRes, membersRes, subsRes] = await Promise.all([
            supabase.from('organizations').select('*').order('created_at', { ascending: false }),
            supabase.from('organization_members').select('organization_id, user_id, role').eq('role', 'owner'),
            supabase.from('user_subscriptions').select(`
                user_id, organization_id, status, billing_period,
                whop_membership_id, created_at, renews_at, ends_at,
                plan:subscription_plans(name, display_name, price_cents)
            `).in('status', ['active', 'trialing', 'past_due']),
        ]);

        if (orgsRes.error) throw orgsRes.error;

        const orgs = orgsRes.data || [];
        const members = membersRes.data || [];
        const subs = subsRes.data || [];

        // Obtener perfiles de los owners
        const ownerUserIds = members.map((m: any) => m.user_id);
        let profilesMap = new Map<string, { full_name: string; email: string }>();

        if (ownerUserIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', ownerUserIds);
            if (profiles) {
                profilesMap = new Map(profiles.map((p: any) => [p.id, p]));
            }
        }

        // Mapear owners por org_id
        const ownerByOrg = new Map<string, string>();
        for (const m of members) {
            ownerByOrg.set(m.organization_id, m.user_id);
        }

        // Mapear suscripciones por org_id
        const subByOrg = new Map<string, any>();
        for (const s of subs) {
            subByOrg.set(s.organization_id, s);
        }

        return orgs.map((org: any) => {
            const ownerUserId = ownerByOrg.get(org.id) || null;
            const ownerProfile = ownerUserId ? profilesMap.get(ownerUserId) : null;
            const sub = subByOrg.get(org.id);
            const planData = sub?.plan as any;

            return {
                ...org,
                ownerEmail: ownerProfile?.email || null,
                ownerName: ownerProfile?.full_name || null,
                ownerUserId,
                activePlanName: planData?.name || null,
                activePlanDisplayName: planData?.display_name || null,
                subscriptionStatus: sub?.status || null,
                billingPeriod: sub?.billing_period || null,
                whopMembershipId: sub?.whop_membership_id || null,
                subscriptionCreatedAt: sub?.created_at || null,
                subscriptionRenewsAt: sub?.renews_at || null,
                subscriptionEndsAt: sub?.ends_at || null,
                planPriceCents: planData?.price_cents ?? null,
            } as OrganizationWithDetails;
        });
    },

    /**
     * AGENCY: Obtiene una organización con datos enriquecidos
     */
    async getOrganizationWithDetails(orgId: string): Promise<OrganizationWithDetails | null> {
        const [orgRes, memberRes, subRes] = await Promise.all([
            supabase.from('organizations').select('*').eq('id', orgId).single(),
            supabase.from('organization_members').select('user_id').eq('organization_id', orgId).eq('role', 'owner').maybeSingle(),
            supabase.from('user_subscriptions').select(`
                user_id, organization_id, status, billing_period,
                whop_membership_id, created_at, renews_at, ends_at,
                plan:subscription_plans(name, display_name, price_cents)
            `).eq('organization_id', orgId).in('status', ['active', 'trialing', 'past_due']).maybeSingle(),
        ]);

        if (orgRes.error || !orgRes.data) return null;
        const org = orgRes.data;

        let ownerProfile: { full_name: string; email: string } | null = null;
        const ownerUserId = memberRes.data?.user_id || null;
        if (ownerUserId) {
            const { data } = await supabase.from('profiles').select('full_name, email').eq('id', ownerUserId).single();
            ownerProfile = data;
        }

        const sub = subRes.data;
        const planData = sub?.plan as any;

        return {
            ...org,
            ownerEmail: ownerProfile?.email || null,
            ownerName: ownerProfile?.full_name || null,
            ownerUserId,
            activePlanName: planData?.name || null,
            activePlanDisplayName: planData?.display_name || null,
            subscriptionStatus: sub?.status || null,
            billingPeriod: sub?.billing_period || null,
            whopMembershipId: sub?.whop_membership_id || null,
            subscriptionCreatedAt: sub?.created_at || null,
            subscriptionRenewsAt: sub?.renews_at || null,
            subscriptionEndsAt: sub?.ends_at || null,
            planPriceCents: planData?.price_cents ?? null,
        } as OrganizationWithDetails;
    },

    /**
     * AGENCY: Elimina una organización y todos sus datos relacionados
     */
    async deleteOrganization(orgId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Obtener owner para limpiar su perfil también
            const { data: memberData } = await supabase
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', orgId)
                .eq('role', 'owner')
                .maybeSingle();

            // Borrar en orden de dependencias FK
            await supabase.from('organization_invitations').delete().eq('organization_id', orgId);
            await supabase.from('user_subscriptions').delete().eq('organization_id', orgId);
            await supabase.from('organization_members').delete().eq('organization_id', orgId);

            // Borrar la org
            const { error: orgError } = await supabase.from('organizations').delete().eq('id', orgId);
            if (orgError) throw orgError;

            // Limpiar perfil del owner (si existe y no pertenece a otras orgs)
            if (memberData?.user_id) {
                const { data: otherOrgs } = await supabase
                    .from('organization_members')
                    .select('id')
                    .eq('user_id', memberData.user_id)
                    .limit(1);

                if (!otherOrgs || otherOrgs.length === 0) {
                    await supabase.from('profiles').delete().eq('id', memberData.user_id);
                }
            }

            return { success: true };
        } catch (err: any) {
            console.error('[organizationService] deleteOrganization error:', err);
            return { success: false, error: err.message || 'Error al eliminar' };
        }
    },

    /**
     * AGENCY: Suspende una organización
     */
    async suspendOrganization(orgId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error: orgError } = await supabase
                .from('organizations')
                .update({ status: 'suspended' })
                .eq('id', orgId);

            if (orgError) throw orgError;

            // Cancelar suscripciones activas
            await supabase
                .from('user_subscriptions')
                .update({ status: 'cancelled' })
                .eq('organization_id', orgId)
                .in('status', ['active', 'trialing', 'past_due']);

            return { success: true };
        } catch (err: any) {
            console.error('[organizationService] suspendOrganization error:', err);
            return { success: false, error: err.message || 'Error al suspender' };
        }
    },

    /**
     * AGENCY: Reactiva una organización suspendida
     */
    async reactivateOrganization(orgId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('organizations')
                .update({ status: 'active' })
                .eq('id', orgId);

            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    },

};
