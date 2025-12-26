-- FIX: Asegurar que las predicciones sean legibles por todos
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar que RLS está habilitado
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes que puedan estar mal
DROP POLICY IF EXISTS "Public predictions are viewable by everyone" ON public.predictions;
DROP POLICY IF EXISTS "Auth users can read predictions" ON public.predictions;
DROP POLICY IF EXISTS "Service can insert predictions" ON public.predictions;
DROP POLICY IF EXISTS "Auth users can insert predictions" ON public.predictions;

-- 3. Crear política que permita a TODOS leer (incluyendo anon)
CREATE POLICY "Anyone can read predictions" 
  ON public.predictions 
  FOR SELECT 
  USING (true);

-- 4. Crear política que permita insertar (service_role)
CREATE POLICY "Service can insert predictions" 
  ON public.predictions 
  FOR INSERT 
  WITH CHECK (true);

-- 5. Verificar que hay datos
SELECT COUNT(*) as total_predictions FROM public.predictions;
SELECT fixture_id, market, selection, probability FROM public.predictions LIMIT 5;
