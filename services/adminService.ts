
import { supabase } from './supabaseService';
import { UserProfile } from '../types';

export const adminService = {
    /**
     * List all users with optional search.
     * Only accessible by Superadmins via RLS.
     */
    async listAllUsers(search?: string): Promise<UserProfile[]> {
        let query = supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (search) {
            // Search by email or full_name
            query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching users:', error);
            throw error;
        }

        return data as UserProfile[];
    },

    /**
     * Update a user's global system role (user, admin, superadmin).
     * Only accessible by Superadmins via RLS.
     */
    async updateUserRole(userId: string, newRole: 'user' | 'admin' | 'superadmin'): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            console.error('Error updating user role:', error);
            throw error;
        }
    },

    /**
     * Get global stats for the dashboard.
     */
    async getSystemStats() {
        // Note: count() might be restricted by RLS if not careful, but superadmin should see all.
        const { count: userCount, error: userError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        const { count: orgCount, error: orgError } = await supabase
            .from('organizations')
            .select('*', { count: 'exact', head: true });

        if (userError || orgError) {
            console.error('Error fetching stats', userError, orgError);
        }

        return {
            totalUsers: userCount || 0,
            totalOrgs: orgCount || 0
        };
    }
};
