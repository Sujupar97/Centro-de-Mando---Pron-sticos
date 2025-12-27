# Instrucciones de Deployment - Sistema ML Fase 1

## 1. Aplicar Migración SQL

```bash
# Desde el directorio del proyecto
supabase db push

# O si usas la CLI directamente:
psql $DATABASE_URL -f supabase/migrations/20250127_ml_feedback_infrastructure.sql
```

**Verificar que se crearon las tablas:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('predictions_results', 'learned_lessons');
```

## 2. Desplegar Edge Function

```bash
# Desplegar la función sync-results
supabase functions deploy sync-results

# Verificar deployment
supabase functions list
```

## 3. Configurar Cron Job (Automatización Diaria)

**Opción A: Supabase CLI**
```sql
-- Ejecutar en Supabase SQL Editor
SELECT cron.schedule(
  'sync-predictions-daily',
  '0 2 * * *',  -- 2 AM UTC todos los días
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-results',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) AS request_id;
  $$
);
```

**Reemplazar**:
- `YOUR_PROJECT_REF`: Ref de tu proyecto Supabase
- `YOUR_SERVICE_ROLE_KEY`: Service Role Key (Dashboard > Settings > API)

**Opción B: Supabase Dashboard**
1. Dashboard > Database > Cron Jobs
2. Create new cron job
3. Schedule: `0 2 * * *`
4. SQL: 
   ```sql
   SELECT net.http_post(
     url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-results',
     headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
   );
   ```

## 4. Ejecutar Migración Histórica (UNA VEZ)

```bash
# Asegurarse que .env tiene las keys necesarias:
# - VITE_SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY (o VITE_SUPABASE_ANON_KEY)
# - API_FOOTBALL_KEYS

# Ejecutar script
node scripts/migrate_historical_results.mjs
```

**Tiempo estimado**: ~5 segundos por predicción (rate limiting API)

**Monitorear progreso**: El script muestra logs en tiempo real

## 5. Verificación Post-Deployment

```sql
-- Check cuántas predicciones se verificaron
SELECT COUNT(*) FROM predictions_results;

-- Ver win rate global
SELECT * FROM prediction_performance_summary;

-- Win rate por mercado
SELECT * FROM get_win_rate_by_market();
```

## 6. Testing Manual

**Opción A: Trigger manual de sync-results**
```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-results \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Opción B: Desde Supabase Dashboard**
1. Functions > sync-results > Invoke
2. Click "Invoke Function"
3. Ver logs en tiempo real

## Troubleshooting

### "Table predictions_results does not exist"
```bash
# Verificar que la migración se aplicó
supabase db diff --schema public
supabase db push
```

### "Edge Function timeout"
- El script procesa muchas predicciones en un solo request
- Solución: Limitar procesamiento a 100 predicciones por ejecución
- O ejecutar el script de migración histórica independientemente

### "No SUPABASE_SERVICE_ROLE_KEY"
- Dashboard > Settings > API > Project API keys
- Copiar "service_role" key
- Añadir a `.env`: `SUPABASE_SERVICE_ROLE_KEY=eyJ...`

## Siguiente Paso

Una vez completada la Fase 1, proceder con:
- **Fase 2**: Embeddings y Memoria Vectorial (pgvector)
- **Fase 3**: Post-Mortem Automático
- **Fase 4**: A/B Testing

Ver `implementation_plan.md` para detalles completos.
