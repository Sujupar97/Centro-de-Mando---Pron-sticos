-- ============================================================
-- MIGRACIÓN: knowledge_base_v2
-- Sistema de interpretación táctica para Motor E
-- ============================================================

-- Crear tabla para base de conocimiento
CREATE TABLE IF NOT EXISTS knowledge_base_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN (
        'formations',       -- Formaciones tácticas
        'confrontations',   -- Confrontación de formaciones
        'competitions',     -- Competiciones y contexto
        'metrics',          -- Interpretación de métricas
        'styles',           -- Estilos de juego
        'situations',       -- Factores situacionales
        'markets'           -- Mercados de apuestas
    )),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority INT DEFAULT 0,  -- Mayor = más importante
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    token_count INT DEFAULT 0,  -- Para tracking de uso de tokens
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda rápida por categoría
CREATE INDEX IF NOT EXISTS idx_knowledge_base_v2_category 
    ON knowledge_base_v2(category, is_active);

-- RLS para seguridad
ALTER TABLE knowledge_base_v2 ENABLE ROW LEVEL SECURITY;

-- Política: cualquier usuario autenticado puede leer
CREATE POLICY "knowledge_base_v2_read" 
    ON knowledge_base_v2 FOR SELECT 
    TO authenticated 
    USING (is_active = true);

-- Política: solo service_role puede escribir
CREATE POLICY "knowledge_base_v2_write" 
    ON knowledge_base_v2 FOR ALL 
    TO service_role 
    USING (true);

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_knowledge_base_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger de actualización
DROP TRIGGER IF EXISTS trigger_knowledge_base_updated ON knowledge_base_v2;
CREATE TRIGGER trigger_knowledge_base_updated
    BEFORE UPDATE ON knowledge_base_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_base_timestamp();

-- TODO: Los documentos se cargarán via Edge Function o script separado
-- debido al tamaño (60KB+ de contenido)

COMMENT ON TABLE knowledge_base_v2 IS 'Base de conocimiento táctica para Motor E - Sistema de interpretación de predicciones V2';
