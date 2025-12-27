-- =====================================================
-- ML FASES 2 + 4: SCRIPT CORREGIDO (PARTE 2)
-- =====================================================
-- Ejecutar DESPUÉS de la Parte 1
-- =====================================================

-- 5. TABLA: model_versions
CREATE TABLE IF NOT EXISTS public.model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name TEXT NOT NULL UNIQUE,
  version_description TEXT,
  model_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  traffic_percentage INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. COLUMNA: model_version en predictions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'predictions' AND column_name = 'model_version'
  ) THEN
    ALTER TABLE public.predictions ADD COLUMN model_version TEXT DEFAULT 'v1-stable';
  END IF;
END $$;

-- 7. INSERTAR VERSIONES INICIALES
INSERT INTO public.model_versions (version_name, version_description, is_active, traffic_percentage)
VALUES 
  ('v1-stable', 'Modelo base de producción', true, 100),
  ('v2-learning', 'Modelo con ajustes ML basados en historial', true, 0)
ON CONFLICT (version_name) DO NOTHING;

-- 8. RLS
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_model_versions" ON public.model_versions;
CREATE POLICY "allow_all_model_versions" ON public.model_versions FOR ALL USING (true) WITH CHECK (true);
