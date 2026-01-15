// Script para cargar la base de conocimiento táctica a Supabase
// Ejecutar con: node load_knowledge_base.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const SUPABASE_URL = 'https://nokejmhlpsaoerhddcyc.supabase.co';
// Para cargar conocimiento necesitamos service_role key
// La key está hardcodeada temporalmente - en producción usar env vars
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5va2VqbWhscHNhb2VyaGRkY3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTYwMDcsImV4cCI6MjA4MTM5MjAwN30.EorEQF3lnm5NbQtwTnipy95gNkbEhR8Xz7ecMlt-0Ac';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Documentos de conocimiento táctico
const KNOWLEDGE_DOCS = [
    {
        category: 'formations',
        title: 'Formaciones Tácticas',
        source: '01. Formaciones Tácticas.docx',
        priority: 1
    },
    {
        category: 'confrontations',
        title: 'Confrontación de Formaciones',
        source: '02. Confrontación de Formaciones.docx',
        priority: 2
    },
    {
        category: 'competitions',
        title: 'Competiciones y Contexto',
        source: '03. Competiciones y Contexto.docx',
        priority: 3
    },
    {
        category: 'metrics',
        title: 'Interpretación de Métricas',
        source: '04. Interpretación de Métricas.docx',
        priority: 4
    },
    {
        category: 'styles',
        title: 'Análisis de Equipos por Estilo',
        source: '05. Análisis de Equipos por Estilo.docx',
        priority: 5
    },
    {
        category: 'situations',
        title: 'Factores Situacionales',
        source: '06. Factores Situacionales.docx',
        priority: 6
    }
];

async function loadKnowledgeBase() {
    console.log('🧠 Cargando Base de Conocimiento Táctica...\n');

    const basePath = './Base de Conocimientos';

    for (const doc of KNOWLEDGE_DOCS) {
        const docxPath = `${basePath}/${doc.source}`;
        const txtPath = `/tmp/knowledge_${doc.category}.txt`;

        try {
            // Convertir DOCX a TXT usando textutil (macOS)
            console.log(`📄 Procesando: ${doc.title}`);
            execSync(`textutil -convert txt "${docxPath}" -output "${txtPath}"`, { encoding: 'utf8' });

            // Leer contenido
            const content = readFileSync(txtPath, 'utf8');
            const tokenCount = Math.ceil(content.length / 4); // Estimación de tokens

            console.log(`   → ${content.length} caracteres (~${tokenCount} tokens)`);

            // Verificar si ya existe
            const { data: existing } = await supabase
                .from('knowledge_base_v2')
                .select('id')
                .eq('category', doc.category)
                .single();

            if (existing) {
                // Actualizar existente
                const { error } = await supabase
                    .from('knowledge_base_v2')
                    .update({
                        title: doc.title,
                        content: content,
                        priority: doc.priority,
                        token_count: tokenCount,
                        version: 2
                    })
                    .eq('category', doc.category);

                if (error) throw error;
                console.log(`   ✅ Actualizado: ${doc.category}`);
            } else {
                // Insertar nuevo
                const { error } = await supabase
                    .from('knowledge_base_v2')
                    .insert({
                        category: doc.category,
                        title: doc.title,
                        content: content,
                        priority: doc.priority,
                        token_count: tokenCount
                    });

                if (error) throw error;
                console.log(`   ✅ Insertado: ${doc.category}`);
            }
        } catch (err) {
            console.error(`   ❌ Error en ${doc.title}:`, err.message);
        }
    }

    // Mostrar resumen
    console.log('\n═══════════════════════════════════════════════════════════════');
    const { data: summary } = await supabase
        .from('knowledge_base_v2')
        .select('category, title, token_count, updated_at')
        .order('priority');

    console.log('📊 Base de Conocimiento Cargada:');
    if (summary) {
        let totalTokens = 0;
        for (const doc of summary) {
            console.log(`   • ${doc.title}: ~${doc.token_count} tokens`);
            totalTokens += doc.token_count || 0;
        }
        console.log(`   ────────────────────────────────────`);
        console.log(`   TOTAL: ~${totalTokens} tokens`);
    }
    console.log('═══════════════════════════════════════════════════════════════\n');
}

// Ejecutar
loadKnowledgeBase().catch(console.error);
