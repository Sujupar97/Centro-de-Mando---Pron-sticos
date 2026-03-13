-- ============================================
-- Admin Notification Trigger — DESACTIVADO
-- ============================================
-- HISTORIAL:
-- - Mar 8 2026: Creado con pg_net para notificar registros via DB trigger
-- - Mar 12 2026: DESACTIVADO — pg_net + trigger anidado causaba 504/AuthRetryableFetchError
--   que bloqueaba completamente el registro de nuevos usuarios.
--   La notificación se movió al frontend (SignUpFlow.tsx) como fire-and-forget.
-- ============================================

-- El trigger fue removido manualmente en producción:
-- DROP TRIGGER IF EXISTS trg_notify_admin_new_registration ON public.profiles;
--
-- La notificación ahora se envía desde el frontend:
-- supabase.functions.invoke('send-admin-notification', { body: { type: 'new_registration', ... } })
-- Esto es más confiable porque:
-- 1. No afecta la transacción de auth.signUp() si falla
-- 2. No depende de pg_net ni de app.settings.service_role_key
-- 3. Los errores son visibles en el browser console para debugging

-- Mantener la función por si se necesita referencia, pero el trigger está DROP'd
CREATE OR REPLACE FUNCTION public.notify_admin_new_registration()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- NO-OP: Notificación movida al frontend (SignUpFlow.tsx)
    RETURN NEW;
END;
$$;

-- TRIGGER DESACTIVADO — no crear
-- CREATE TRIGGER trg_notify_admin_new_registration
--     AFTER INSERT ON public.profiles
--     FOR EACH ROW
--     EXECUTE FUNCTION public.notify_admin_new_registration();
