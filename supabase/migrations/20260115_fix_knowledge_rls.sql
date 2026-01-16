-- ============================================================
-- Script para INSERTAR base de conocimiento táctica
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- Primero ajustar RLS para permitir inserción
DROP POLICY IF EXISTS "knowledge_base_v2_write" ON knowledge_base_v2;
CREATE POLICY "knowledge_base_v2_write_all" ON knowledge_base_v2 
    FOR ALL TO authenticated, anon 
    USING (true) 
    WITH CHECK (true);

-- Ahora insertar los documentos uno por uno
-- Los documentos se cargarán desde el script load_knowledge_base.mjs
-- después de aplicar este SQL

SELECT 'RLS ajustado - ahora ejecutar: node load_knowledge_base.mjs';
