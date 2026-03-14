import { supabase } from './supabaseService';
import type { NotificationPreference, NotificationLogEntry, NotificationAnalytics, NotificationType } from '../types';

// --- Preferences ---

export async function getNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
    const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId);
    return (data || []) as NotificationPreference[];
}

export async function updateNotificationPreference(
    userId: string,
    channel: string,
    notificationType: string,
    enabled: boolean
): Promise<boolean> {
    const { error } = await supabase
        .from('notification_preferences')
        .upsert({
            user_id: userId,
            channel,
            notification_type: notificationType,
            enabled,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,channel,notification_type' });
    return !error;
}

// --- Phone number ---

export async function updatePhoneNumber(
    userId: string,
    phoneNumber: string,
    countryCode: string
): Promise<boolean> {
    const fullPhone = phoneNumber ? `${countryCode}${phoneNumber}` : null;
    const { error } = await supabase
        .from('profiles')
        .update({
            phone_number: fullPhone,
            phone_country_code: countryCode
        })
        .eq('id', userId);
    return !error;
}

// --- Analytics (admin) ---

export async function getNotificationAnalytics(days: number = 30): Promise<NotificationAnalytics> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: logs } = await supabase
        .from('notification_log')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

    const entries = (logs || []) as NotificationLogEntry[];

    const totalSent = entries.filter(l => l.status !== 'queued').length;
    const delivered = entries.filter(l => ['delivered', 'read'].includes(l.status)).length;
    const read = entries.filter(l => l.status === 'read').length;
    const failed = entries.filter(l => l.status === 'failed').length;
    const clicked = entries.filter(l => l.click_count > 0).length;

    const byType: NotificationAnalytics['byType'] = {
        predictions_ready: { sent: 0, delivered: 0, clicked: 0 },
        daily_results: { sent: 0, delivered: 0, clicked: 0 },
        special_offers: { sent: 0, delivered: 0, clicked: 0 },
    };

    for (const entry of entries) {
        const type = entry.notification_type as NotificationType;
        if (byType[type]) {
            if (entry.status !== 'queued') byType[type].sent++;
            if (['delivered', 'read'].includes(entry.status)) byType[type].delivered++;
            if (entry.click_count > 0) byType[type].clicked++;
        }
    }

    return {
        totalSent,
        delivered,
        read,
        failed,
        deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
        readRate: totalSent > 0 ? (read / totalSent) * 100 : 0,
        clickRate: totalSent > 0 ? (clicked / totalSent) * 100 : 0,
        byType,
        recentLogs: entries.slice(0, 50),
    };
}

// --- Test notification (admin) ---

export async function sendTestNotification(phone: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: { notification_type: 'test', data: { phone } }
    });

    if (error) return { success: false, error: error.message };
    return { success: data?.success ?? false, error: data?.error };
}

// --- Notification stats for dashboard ---

export async function getNotificationStats(): Promise<{
    totalUsers: number;
    usersWithPhone: number;
    sentToday: number;
    deliveredToday: number;
}> {
    const today = new Date().toISOString().split('T')[0];

    const [profilesResult, phonesResult, sentResult, deliveredResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).not('phone_number', 'is', null),
        supabase.from('notification_log').select('id', { count: 'exact', head: true })
            .gte('created_at', `${today}T00:00:00Z`).neq('status', 'queued'),
        supabase.from('notification_log').select('id', { count: 'exact', head: true })
            .gte('created_at', `${today}T00:00:00Z`).in('status', ['delivered', 'read']),
    ]);

    return {
        totalUsers: profilesResult.count || 0,
        usersWithPhone: phonesResult.count || 0,
        sentToday: sentResult.count || 0,
        deliveredToday: deliveredResult.count || 0,
    };
}
