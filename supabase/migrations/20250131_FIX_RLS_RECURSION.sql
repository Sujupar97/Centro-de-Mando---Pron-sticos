-- ============================================
-- FIX URGENTE: Eliminar Recursión en Políticas RLS
-- ============================================

-- ELIMINAR TODAS las políticas de profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- POLÍTICA SIMPLE SIN RECURSIÓN: Todos pueden ver todos los perfiles
-- Esto es temporal para desbloquear la app
CREATE POLICY "Allow all to read profiles" ON public.profiles
  FOR SELECT USING (true);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Los usuarios pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Comentario de seguridad temporal
COMMENT ON TABLE public.profiles IS 'TEMPORAL: RLS permisivo para evitar recursión - ajustar después';
