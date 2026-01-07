# 🚨 REGLAS DE DESARROLLO OBLIGATORIAS

## REGLA #1: NUNCA TOCAR LO QUE FUNCIONA
**Si algo funciona, NO SE MODIFICA sin backup completo y plan de rollback.**

### Proceso Obligatorio ANTES de Cambios Críticos:
1. ✅ **Backup de Base de Datos**
   ```bash
   npx supabase db dump -f backup_YYYY-MM-DD.sql
   ```

2. ✅ **Crear Migración de Rollback PRIMERO**
3. ✅ **Testing en TODAS las Funcionalidades**
4. ✅ **Aprobación del Usuario**

---

## REGLA #2: FUNCIONALIDADES CRÍTICAS INTOCABLES

### ⛔ PROHIBIDO MODIFICAR SIN PERMISO:
- ❌ Sistema de roles (`superadmin`, `admin`, `usuario`)
- ❌ Estructura de organizaciones
- ❌ Políticas RLS
- ❌ Layout.tsx y App.tsx
- ❌ Flujo de agencia

---

## REGLA #3: BACKWARD COMPATIBILITY SIEMPRE

Al agregar nuevos roles, MANTENER los anteriores funcionando.

---

## REGLA #4: ERRORES EN CONSOLA = SISTEMA ROTO

Si hay errores rojos → ROLLBACK INMEDIATO

---

## REGLA #5: TESTING MÍNIMO OBLIGATORIO

### Checklist:
- [ ] Menú lateral completo
- [ ] Organizaciones cargando
- [ ] Permisos funcionando
- [ ] Sin errores en consola

---

## REGLA #6: VERIFICACIÓN DE PREDICCIONES - SINGLE-WRITER PATTERN

### ⚠️ CONTEXTO CRÍTICO:
El incidente del 2026-01-02 demostró que múltiples verificadores causaron contaminación masiva de datos ML.

### 🔒 REGLAS OBLIGATORIAS:

#### A) UN SOLO VERIFICADOR ACTIVO
- ✅ **PERMITIDO:** `daily-results-verifier` (Edge Function oficial)
- ❌ **PROHIBIDO:** Múltiples verificadores simultáneos
- ❌ **PROHIBIDO:** Crear nuevos verificadores sin aprobación formal

#### B) SINGLE-WRITER PARA `predictions.is_won`
- Solo `daily-results-verifier` puede escribir en:
  - `predictions.is_won`
  - `predictions.verification_status`
  - `predictions.result_verified_at`
- **EXCEPCIÓN:** Verificación manual por superadmin (con auditoría)

#### C) IDENTIFICACIÓN OBLIGATORIA EN `predictions_results`
- Todo registro DEBE tener `verification_source` único:
  - `'automation'` - daily-results-verifier (OFICIAL)
  - `'manual'` - Superadmin manual (con user_id registrado)
  - `'API-Football'` - ❌ DESACTIVADO (causó el incidente)
- **NUNCA** dejar `verification_source` vacío o null

#### D) FALLBACK DEFENSIVO
- Si un verificador NO puede evaluar un mercado:
  - ✅ CORRECTO: `return null` (dejar pendiente)
  - ❌ PROHIBIDO: `return false` (asumir perdida)
- Log de advertencia obligatorio para revisión

#### E) PROCESO DE APROBACIÓN PARA CAMBIOS

**Cambios que REQUIEREN aprobación del usuario:**
1. Modificar lógica de evaluación de mercados
2. Agregar nuevos tipos de mercados
3. Cambiar horario de ejecución de cron
4. Crear nuevos verificadores
5. Modificar `verification_source` values

**Proceso:**
1. Documentar cambio propuesto en artifact
2. Solicitar aprobación explícita del usuario
3. Crear migración de rollback ANTES
4. Testing exhaustivo en staging
5. Monitoreo post-deployment (48h mínimo)

#### F) TESTING OBLIGATORIO ANTES DE DEPLOYMENT

**Suite de pruebas mínima:**
- [ ] Mercado 1X2 (Local, Visitante, Empate)
- [ ] Doble Chance (1X, X2, 12)
- [ ] Over/Under (con y sin acentos)
- [ ] BTTS (Sí/No)
- [ ] Mercados con nombre de equipo
- [ ] Mercados desconocidos (debe retornar `null`)

**Validación:**
- 100% de casos de prueba correctos
- Logs sin errores
- `verification_source` correcto en todos

#### G) MONITOREO POST-DEPLOYMENT

**Primeras 48 horas:**
- Revisar logs cada 6 horas
- Verificar accuracy no cae >5%
- Confirmar `verification_source` consistente
- Alertar si predicciones con `is_won = null` > 10%

---

## REGLA #7: LECTURA COMPLETA OBLIGATORIA ANTES DE CUALQUIER DESARROLLO

### 🚨 CONTEXTO CRÍTICO:
Múltiples incidentes han demostrado que modificar código sin entender el sistema completo causa:
- Ruptura de funcionalidades existentes
- Pérdida de datos
- Inconsistencias entre componentes
- Horas de rollback y reparación

### 🔒 OBLIGATORIO ANTES DE IMPLEMENTAR:

#### A) LECTURA COMPLETA DE LA APLICACIÓN

**PROHIBIDO** iniciar cualquier desarrollo o implementación sin:

1. ✅ **Leer estructura completa del proyecto**
   ```bash
   # Ver árbol de directorios
   tree -L 3 -I 'node_modules|.git'
   
   # Listar archivos clave
   find . -name "*.tsx" -o -name "*.ts" | grep -E "(service|context|hook|component)" | head -50
   ```

2. ✅ **Identificar componentes relacionados**
   - ¿Qué archivos usan la funcionalidad que voy a modificar?
   - ¿Hay otros componentes que dependen de esto?
   - ¿Hay servicios compartidos que podrían afectarse?

3. ✅ **Mapear flujo de datos completo**
   - Frontend → Service → Edge Function → Database
   - ¿Dónde se lee? ¿Dónde se escribe?
   - ¿Hay cachés involucrados?

4. ✅ **Verificar dependencias cruzadas**
   ```bash
   # Buscar importaciones del archivo a modificar
   grep -r "import.*from.*nombre-archivo" --include="*.ts" --include="*.tsx"
   ```

#### B) PREGUNTAS OBLIGATORIAS AL USUARIO

**ANTES** de escribir una sola línea de código, preguntar:

1. ❓ **¿Qué funcionalidades NO debo tocar?**
   - Listar componentes críticos que funcionan actualmente

2. ❓ **¿Hay algún flujo de usuario que deba seguir funcionando igual?**
   - Validar que no rompemos user journeys existentes

3. ❓ **¿Existen reglas de negocio o validaciones que deba respetar?**
   - Verificar constrains, validaciones, permisos

4. ❓ **¿Hay tablas o campos de DB que NO debo modificar?**
   - Verificar esquema de base de datos

#### C) ANÁLISIS DE IMPACTO OBLIGATORIO

**Documento requerido ANTES de código:**

```markdown
# Análisis de Impacto: [NOMBRE_FUNCIONALIDAD]

## Archivos que voy a modificar:
- [ ] archivo1.tsx - Razón
- [ ] archivo2.ts - Razón

## Archivos que podrían verse afectados:
- [ ] archivo3.tsx - Usa función X que modificaré
- [ ] archivo4.ts - Comparte servicio Y

## Funcionalidades que deben seguir funcionando:
- [ ] Funcionalidad 1 - Cómo validaré
- [ ] Funcionalidad 2 - Cómo validaré

## Riesgos identificados:
- [ ] Riesgo 1 - Mitigación
- [ ] Riesgo 2 - Mitigación

## Plan de rollback:
1. Paso 1
2. Paso 2
```

#### D) VALIDACIÓN CRUZADA

**Checklist obligatorio:**

- [ ] Leí TODO el código relacionado (no solo el archivo a modificar)
- [ ] Identifiqué TODOS los componentes que usan esta funcionalidad
- [ ] Verifiqué que NO rompo funcionalidades existentes
- [ ] Pregunté al usuario sobre restricciones/funcionalidades críticas
- [ ] Creé plan de rollback ANTES de modificar
- [ ] Documenté análisis de impacto

#### E) PROCESO DE APROBACIÓN

**Flujo obligatorio:**

1. **INVESTIGACIÓN** (1-2 horas)
   - Leer código completo
   - Mapear dependencias
   - Identificar riesgos

2. **DOCUMENTACIÓN** (30 min)
   - Crear análisis de impacto
   - Listar archivos a modificar
   - Plan de rollback

3. **APROBACIÓN USUARIO** (BLOQUEANTE)
   - Presentar análisis
   - Esperar confirmación explícita
   - **NO proceder sin aprobación**

4. **IMPLEMENTACIÓN** (variable)
   - Seguir plan aprobado
   - Testing exhaustivo
   - Validación de no-regresión

#### F) PENALIZACIÓN POR INCUMPLIMIENTO

**Si se modifica código sin seguir este proceso:**

1. 🚨 **ROLLBACK INMEDIATO** - Sin discusión
2. 📝 **Documentar incidente** - Qué se rompió y por qué
3. ⏸️ **Pausa de desarrollo** - Hasta revisar proceso completo
4. 🔄 **Re-start desde cero** - Lectura completa y análisis de impacto

---

## 🔥 PROTOCOLO DE EMERGENCIA

1. STOP - No hacer más cambios
2. ROLLBACK - Ejecutar reversión
3. VERIFICAR - Sistema restaurado
4. DOCUMENTAR - Qué salió mal

---

**Este documento es LEY. Violarlo = Rollback inmediato.**
