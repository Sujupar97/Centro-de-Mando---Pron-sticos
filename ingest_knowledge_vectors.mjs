
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configurar Supabase
const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
// Usamos service key temporalmente para escritura
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error("❌ Faltan variables de entorno: SUPABASE_SERVICE_ROLE_KEY o GEMINI_API_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Función para generar embedding usando Gemini
async function generateEmbedding(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text: text }] }
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini Embedding Error: ${err}`);
    }

    const data = await response.json();
    return data.embedding.values;
}

// Función para dividir texto en chunks
function chunkText(text, maxChars = 1000) {
    const chunks = [];
    let currentChunk = "";

    // Dividir por párrafos para mantener contexto
    const paragraphs = text.split('\n\n');

    for (const para of paragraphs) {
        if ((currentChunk + para).length > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
        }
        currentChunk += para + "\n\n";
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

async function main() {
    console.log("🚀 Iniciando proceso de vectorización RAG...");

    // 1. Obtener documentos de la base
    const { data: docs, error } = await supabase
        .from('knowledge_base_v2')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error("Error fetching docs:", error);
        return;
    }

    console.log(`📚 Encontrados ${docs.length} documentos para procesar.`);

    // 2. Procesar cada documento
    for (const doc of docs) {
        console.log(`\nProcesando: ${doc.title}...`);

        const chunks = chunkText(doc.content, 1000); // Chunks de ~1000 caracteres
        console.log(`   -> Generados ${chunks.length} chunks.`);

        let insertedCount = 0;

        for (const chunk of chunks) {
            try {
                // Generar vector
                const vector = await generateEmbedding(chunk);

                // Insertar en chunks
                const { error: insertError } = await supabase
                    .from('knowledge_base_chunks')
                    .insert({
                        doc_id: doc.id,
                        title: doc.title,
                        content: chunk,
                        embedding: vector
                    });

                if (insertError) throw insertError;
                insertedCount++;
                process.stdout.write('.'); // Progreso visual
            } catch (e) {
                console.error(`\n❌ Error en chunk: ${e.message}`);
            }

            // Rate limiting suave
            await new Promise(r => setTimeout(r, 500));
        }
        console.log(`\n   ✅ Guardados ${insertedCount}/${chunks.length} vectores.`);
    }

    console.log("\n✨ VECTORIZACIÓN COMPLETADA EXITOSAMENTE ✨");
}

main();
