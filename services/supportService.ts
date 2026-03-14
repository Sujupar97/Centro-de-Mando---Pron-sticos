import { supabase } from './supabaseService';

export interface SupportTicket {
  id: string;
  user_id: string;
  organization_id?: string;
  type: 'bug' | 'feature' | 'question' | 'feedback';
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  plan_name?: string;
  page_context?: string;
  admin_response?: string;
  responded_at?: string;
  responded_by?: string;
  created_at: string;
  updated_at: string;
}

export const supportService = {
  async createTicket(params: {
    userId: string;
    organizationId?: string;
    type: SupportTicket['type'];
    message: string;
    planName?: string;
    pageContext?: string;
    isPaidUser?: boolean;
  }): Promise<SupportTicket | null> {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: params.userId,
        organization_id: params.organizationId,
        type: params.type,
        message: params.message,
        plan_name: params.planName,
        page_context: params.pageContext,
        priority: params.isPaidUser ? 'high' : 'normal',
      })
      .select()
      .single();

    if (error) {
      console.error('[supportService] Error creating ticket:', error);
      return null;
    }
    return data;
  },

  async getUserTickets(userId: string): Promise<SupportTicket[]> {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[supportService] Error fetching user tickets:', error);
      return [];
    }
    return data || [];
  },

  async getAllTickets(filters?: {
    status?: string;
    type?: string;
    priority?: string;
  }): Promise<SupportTicket[]> {
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.priority) query = query.eq('priority', filters.priority);

    const { data, error } = await query;
    if (error) {
      console.error('[supportService] Error fetching all tickets:', error);
      return [];
    }
    return data || [];
  },

  async respondToTicket(
    ticketId: string,
    response: string,
    adminId: string
  ): Promise<SupportTicket | null> {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        admin_response: response,
        responded_at: new Date().toISOString(),
        responded_by: adminId,
        status: 'resolved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('[supportService] Error responding to ticket:', error);
      return null;
    }
    return data;
  },

  async updateTicketStatus(
    ticketId: string,
    status: SupportTicket['status']
  ): Promise<boolean> {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    if (error) {
      console.error('[supportService] Error updating ticket status:', error);
      return false;
    }
    return true;
  },
};
