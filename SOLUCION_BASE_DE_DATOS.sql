-- COPIA Y PEGA ESTO EN EL EDITOR SQL DE SUPABASE --
-- Esto añadirá las columnas necesarias para guardar los resultados de las predicciones --

ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS is_won BOOLEAN;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS result_verified_at TIMESTAMP WITH TIME ZONE;

-- Opcional: Crear índice para búsquedas más rápidas de pendientes
CREATE INDEX IF NOT EXISTS idx_predictions_is_won ON public.predictions(is_won);
