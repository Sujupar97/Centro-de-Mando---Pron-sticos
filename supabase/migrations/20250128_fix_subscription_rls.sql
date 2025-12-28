-- Corregir política RLS para admins en user_subscriptions
-- El problema: estaba buscando role = 'Superadmin' (mayúsculas) pero debería ser 'superadmin' (minúsculas)

-- Eliminar la política incorrecta
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;

-- Crear la política corregida
CREATE POLICY "Admins can manage all subscriptions" ON public.user_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
    )
  );

-- Agregar política para permitir a admins insertar suscripciones manualmente
CREATE POLICY "Admins can insert subscriptions" ON public.user_subscriptions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
    )
  );

-- También corregir políticas de feature_usage para admins
CREATE POLICY "Admins can view all usage" ON public.feature_usage
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
    )
  );

-- Política para payment_history
CREATE POLICY "Admins can view all payments" ON public.payment_history
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('superadmin', 'admin')
    )
  );
