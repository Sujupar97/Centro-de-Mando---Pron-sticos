-- Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla para fragmentos de conocimiento y sus embeddings
CREATE TABLE IF NOT EXISTS knowledge_base_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES knowledge_base_v2(id) ON DELETE CASCADE,
    title TEXT,      -- Para contexto (del documento padre)
    content TEXT,    -- El fragmento de texto
    embedding vector(768), -- Embedding-004 (768 dimensiones)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
ON knowledge_base_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Políticas RLS
ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON knowledge_base_chunks FOR SELECT USING (true);
CREATE POLICY "Enable insert for service role" ON knowledge_base_chunks FOR INSERT WITH CHECK (true);

-- Función de búsqueda por similitud
CREATE OR REPLACE FUNCTION match_knowledge_base(
    query_embedding vector(768),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kbc.id,
        kbc.title,
        kbc.content,
        1 - (kbc.embedding <=> query_embedding) AS similarity
    FROM knowledge_base_chunks kbc
    WHERE 1 - (kbc.embedding <=> query_embedding) > match_threshold
    ORDER BY kbc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
