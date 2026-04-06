# Spec: Estrategia de Adquisición + Implementación Técnica — Derbix

**Fecha**: 2026-04-05  
**Estado**: Aprobado

## Contexto

Derbix necesita adquirir usuarios. La plataforma de pronósticos deportivos con IA está lista. El siguiente paso es traer prospectos y convertirlos en suscriptores pagos. Se invertirán 400K COP/mes en Meta Ads, se activará un programa de afiliados con YouTubers vía Whop.com, y se usará un canal de Telegram como embudo complementario.

**Problema técnico**: La plataforma tiene GTM (`GTM-P7V936CJ`) pero NO tiene Meta Pixel, no captura UTMs, y no tiene tracking de conversiones server-side.

## Alcance

### Código a implementar:
1. **Meta Pixel vía GTM** — configuración de tags/triggers en GTM para PageView, ViewContent, Lead, InitiateCheckout
2. **Conversions API** — nueva edge function `meta-conversions-api` invocada desde `whop-webhook` en `payment.succeeded`
3. **Captura UTMs** — `SignUpFlow.tsx` lee utm_source/medium/campaign de la URL y persiste en `profiles`
4. **Migración SQL** — campos `utm_source`, `utm_medium`, `utm_campaign`, `utm_ref` en tabla `profiles`

### Estrategia (manual, no código):
1. **2 campañas Meta Ads** — Registros directos (200K COP) + Telegram (200K COP)
2. **Copies para 3 videos** + headlines + CTAs
3. **2 prompts de imágenes AI** para Nano Banana 2
4. **Programa de afiliados** configurado en Whop Dashboard (30% comisión recurrente)
5. **Estrategia de contenido Telegram** — picks parciales diarios + redirección a plataforma

## Decisiones de diseño

- **Pixel vía GTM** (no directo en código): ya tenemos GTM, evita tocar index.html, más fácil de gestionar
- **Conversions API server-side**: complementa el Pixel del browser para mejor atribución (ad blockers no lo afectan)
- **UTMs en `profiles`** (no tabla separada): suficiente para el volumen actual, más simple
- **Afiliados en Whop** (no sistema custom): Whop ya tiene tracking, links, pagos automáticos con 30-day holdback
- **Deduplicación**: `event_id` compartido entre Pixel (browser) y CAPI (server) para que Meta no cuente doble

## Archivos afectados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `supabase/functions/meta-conversions-api/index.ts` | CREAR | Edge function para enviar eventos a Meta CAPI |
| `supabase/functions/whop-webhook/index.ts` | MODIFICAR | Invocar CAPI en payment.succeeded |
| `components/auth/SignUpFlow.tsx` | MODIFICAR | Capturar UTMs + ref de URL params |
| `services/analyticsService.ts` | MODIFICAR | Nuevo evento trackSignupWithAttribution |
| Migración SQL | CREAR | Campos utm_* en profiles |
