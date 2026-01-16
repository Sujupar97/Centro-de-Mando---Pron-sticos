-- Permisos para ingestión de RAG (Vector Knowledge Base)
-- Habilita inserción para Anon Key (usada por el script local)
-- ADVERTENCIA: Ejecutar solo para configuración. Se recomienda revocar después.

DROP POLICY IF EXISTS "Enable insert for service role" ON knowledge_base_chunks;
DROP POLICY IF EXISTS "Enable read access for all users" ON knowledge_base_chunks;

-- Permitir INSERT a Anon (para el script de carga)
CREATE POLICY "Enable insert for anon (rag script)" ON knowledge_base_chunks 
FOR INSERT TO anon 
WITH CHECK (true);

-- Permitir SELECT a Anon (para verificar carga)
CREATE POLICY "Enable select for anon (rag script)" ON knowledge_base_chunks 
FOR SELECT TO anon 
USING (true);

-- Permitir DELETE a Anon (para limpiar si es necesario)
CREATE POLICY "Enable delete for anon (rag script)" ON knowledge_base_chunks 
FOR DELETE TO anon 
USING (true);
