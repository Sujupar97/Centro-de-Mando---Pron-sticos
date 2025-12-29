# 🤖 Sistema de Automatización Diaria - Guía Completa

## 📋 Resumen del Flujo Automático

El sistema ejecuta **4 procesos automáticos** cada día:

| Hora (Colombia) | Proceso | Función | Duración Estimada |
|-----------------|---------|---------|-------------------|
| **1:00 AM** | Scanner | Escanea partidos del día siguiente | ~1 minuto |
| **2:00 AM** | Analizador | Analiza TODOS los partidos encontrados | ~30-50 minutos |
| **3:00 AM** | Parlay Generator | Crea parlays con los análisis | ~5 minutos |
| **11:00 PM** | Verificador | Verifica resultados de partidos finalizados | ~10 minutos |

---

## ✅ Cómo Funciona el Analizador (CLAVE)

### Problema Original:
- Analizaba solo **2 partidos** y terminaba
- Si había 20 partidos → quedaban 18 sin analizar

### Solución Implementada:
El analizador ahora:

1. **Loop continuo** hasta que no queden partidos pendientes
2. Procesa de **2 en 2** (evita WORKER_LIMIT de Supabase)
3. **Pausa de 10 segundos** entre cada batch
4. **Timeout de 50 minutos** máximo
5. **Garantiza** que TODOS los partidos se analicen antes de las 3 AM

### Ejemplo con 20 partidos:
```
2:00 AM → Batch 1: Partido 1-2 (3 min)
2:03 AM → Pausa 10 seg
2:04 AM → Batch 2: Partido 3-4 (3 min)
2:07 AM → Pausa 10 seg
2:08 AM → Batch 3: Partido 5-6 (3 min)
...
2:40 AM → Batch 10: Partido 19-20 (3 min)
2:43 AM → ✅ Todos analizados
```

**Resultado**: A las 3:00 AM, el Parlay Generator tendrá TODOS los análisis disponibles.

---

## 🔧 Configuración de Cron Jobs

### Archivo SQL: `scripts/setup_cron_jobs.sql`

Este archivo configura los 4 cron jobs en Supabase usando `pg_cron`.

### Para Activar la Automatización:

1. Ve a: https://supabase.com/dashboard/project/nokejmhlpsaoerhddcyc/sql/new
2. Abre el archivo: `scripts/setup_cron_jobs.sql`
3. Copia TODO el contenido
4. Pega en Supabase SQL Editor
5. Ejecuta (clic en "Run")

### Verificar que Funciona:

```sql
-- Ver cron jobs configurados
SELECT * FROM cron.job ORDER BY jobname;

-- Ver historial de ejecuciones
SELECT * FROM cron.job_run_details 
ORDER BY end_time DESC 
LIMIT 20;
```

---

## 📊 Ligas Permitidas

Actualmente hay **86 ligas** configuradas:

### Principales Regiones:
- 🏴󠁧󠁢󠁥󠁮󠁧󠁿 **Inglaterra**: Premier League, Championship, FA Cup, EFL Cup
- 🇪🇸 **España**: La Liga, Segunda División, Copa del Rey
- 🇮🇹 **Italia**: Serie A, Serie B, Coppa Italia
- 🇩🇪 **Alemania**: Bundesliga, 2. Bundesliga, DFB Pokal
- 🇫🇷 **Francia**: Ligue 1, Ligue 2, Coupe de France
- 🇵🇹 **Portugal**: Primeira Liga, Liga Portugal 2
- 🇹🇷 **Turquía**: Süper Lig, 1. Lig
- 🇸🇦 **Arabia Saudita**: Saudi Pro League
- 🇶🇦 **Qatar**: Stars League
- 🇦🇪 **UAE**: Pro League
- 🌍 **Copa África de Naciones**
- Y más...

### Criterios de Selección:
- ✅ **Bajo riesgo** de manipulación
- ✅ **Datos confiables** de API-Football
- ✅ **Regulación profesional**
- ❌ Excluidas: Gambia, Etiopía, Congo, Bangladesh (alto riesgo)

---

## 🧪 Testing Manual

### Escanear Partidos de una Fecha Específica:

```bash
curl -X POST https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/daily-match-scanner \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"targetDate": "2025-12-30"}'
```

### Ejecutar Análisis Manualmente:

```bash
curl -X POST https://nokejmhlpsaoerhddcyc.supabase.co/functions/v1/daily-analysis-generator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Verificar Estado de Partidos:

```bash
node scripts/check_analysis.mjs
```

---

## 🚨 Solución de Problemas

### Los análisis no aparecen en la UI:
- La UI de "Jornadas" muestra partidos de la API en vivo
- Los análisis están guardados en `analysis_jobs` y `predictions`
- **Pendiente**: Conectar la UI para mostrar los análisis guardados

### Los cron jobs no se ejecutan:
1. Verificar que ejecutaste `scripts/setup_cron_jobs.sql`
2. Revisar logs: `SELECT * FROM cron.job_run_details`
3. Verificar que las Edge Functions estén deployed

### El analizador falla por WORKER_LIMIT:
- Ya está configurado para procesar de 2 en 2
- Si persiste, aumentar `DELAY_BETWEEN_BATCHES_MS` en el código

---

## 📝 Próximos Pasos

1. ✅ Configurar cron jobs (ejecutar `setup_cron_jobs.sql`)
2. ⏳ Conectar UI de "Jornadas" para mostrar análisis guardados
3. ⏳ Implementar Parlay Generator
4. ⏳ Implementar Results Verifier
5. ⏳ Agregar notificaciones de errores

---

## 🔑 Variables de Entorno Requeridas

En Supabase → Settings → Edge Functions → Secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_FOOTBALL_KEYS` (tu clave de API-Football)
- `GEMINI_API_KEY` (tu clave de Google Gemini)

Todas ya configuradas ✅
