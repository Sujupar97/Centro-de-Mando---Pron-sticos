# Guia Completa: Configuracion de WhatsApp Cloud API para Derbix

## Paso 1: Crear cuenta en Meta Business Manager

1. Ve a https://business.facebook.com/
2. Inicia sesion con tu cuenta de Facebook (o crea una)
3. Crea una Business Account si no tienes una
4. Ve a **Business Settings** > **Accounts** > **WhatsApp Accounts**

## Paso 2: Crear una App en Meta for Developers

1. Ve a https://developers.facebook.com/
2. Click en **My Apps** > **Create App**
3. Selecciona tipo: **Business**
4. Nombre: `Derbix Notifications`
5. Business Account: selecciona la que creaste en Paso 1
6. Click **Create App**

## Paso 3: Agregar WhatsApp a tu App

1. En el dashboard de tu app, busca **WhatsApp** en la lista de productos
2. Click **Set Up** en WhatsApp
3. Te llevara al WhatsApp Getting Started page

## Paso 4: Obtener credenciales (Phone Number ID y Access Token)

### En la pagina Getting Started de WhatsApp:

1. **Phone Number ID**: Aparece en la seccion "From" — es un numero como `123456789012345`
   - Este es el `WHATSAPP_PHONE_NUMBER_ID`
   - Meta te da un numero de prueba gratuito para testing

2. **Temporary Access Token**: Aparece en la misma pagina
   - Este token expira en 24 horas — NO lo uses en produccion
   - Sirve solo para pruebas iniciales

### Para token permanente (PRODUCCION):

1. Ve a **Business Settings** > **Users** > **System Users**
2. Click **Add** > crea un System User con rol **Admin**
3. Click en el system user > **Generate New Token**
4. Selecciona tu app (`Derbix Notifications`)
5. Permisos requeridos:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Click **Generate Token**
7. **COPIA Y GUARDA** este token — es tu `WHATSAPP_ACCESS_TOKEN` permanente

### Asignar assets al System User:

1. En la pagina del System User, click **Assign Assets**
2. Selecciona **Apps** > `Derbix Notifications` > **Full Control**
3. Selecciona **WhatsApp Accounts** > tu cuenta > **Full Control**
4. Save Changes

## Paso 5: Registrar un numero de telefono real (Produccion)

El numero de prueba de Meta solo puede enviar a numeros verificados. Para produccion:

1. Ve a **WhatsApp Manager** > **Phone Numbers**
2. Click **Add Phone Number**
3. Ingresa un numero real (puede ser el de tu empresa)
4. Verifica via SMS o llamada
5. Completa el perfil de negocio (nombre, descripcion, logo)

> **IMPORTANTE**: El numero que registres NO puede tener WhatsApp personal instalado. Si lo tiene, debes desvincularlo primero.

## Paso 6: Crear los Message Templates

Ve a **WhatsApp Manager** > **Message Templates** > **Create Template**

### Template 1: `pronosticos_listos_free`

- **Category**: UTILITY
- **Name**: `pronosticos_listos_free`
- **Language**: Spanish (es)
- **Header**: None (o imagen del logo Derbix)
- **Body**:
```
Hola {{1}}, hay {{2}} oportunidades de alto valor disponibles hoy en Derbix. Activa tu plan para ver los pronosticos completos y empezar a ganar.
```
- **Footer**: `derbix.co`
- **Buttons**:
  - Type: **URL**
  - Button text: `Ver Oportunidades`
  - URL type: **Dynamic**
  - URL: `https://derbix.co/app{{1}}`
  - Sample URL: `https://derbix.co/app?tab=top-picks`

### Template 2: `pronosticos_listos_paid`

- **Category**: UTILITY
- **Name**: `pronosticos_listos_paid`
- **Language**: Spanish (es)
- **Body**:
```
Hola {{1}}, tienes {{2}} oportunidades y {{3}} parlays listos para hoy. Top pick: {{4}}. Entra a Derbix para ver el analisis completo.
```
- **Footer**: `derbix.co`
- **Buttons**:
  - Type: **URL**
  - Button text: `Ver Pronosticos`
  - URL type: **Dynamic**
  - URL: `https://derbix.co/app{{1}}`

### Template 3: `resultados_dia_free`

- **Category**: UTILITY
- **Name**: `resultados_dia_free`
- **Language**: Spanish (es)
- **Body**:
```
Resumen Derbix: Hoy verificamos {{1}} pronosticos con {{2}}% de accuracy. Mira como habria crecido tu bankroll con nuestras oportunidades.
```
- **Footer**: `derbix.co`
- **Buttons**:
  - Type: **URL**
  - Button text: `Ver Resultados`
  - URL type: **Dynamic**
  - URL: `https://derbix.co/app{{1}}`

### Template 4: `resultados_dia_paid`

- **Category**: UTILITY
- **Name**: `resultados_dia_paid`
- **Language**: Spanish (es)
- **Body**:
```
Hola {{1}}: Resultados de hoy: {{2}}/{{3}} WON ({{4}}%). ROI del dia: {{5}}%. Revisa el detalle completo en la plataforma.
```
- **Footer**: `derbix.co`
- **Buttons**:
  - Type: **URL**
  - Button text: `Ver Resultados`
  - URL type: **Dynamic**
  - URL: `https://derbix.co/app{{1}}`

### Al enviar cada template para revision:

- Proporciona **valores de ejemplo** para cada variable ({{1}}, {{2}}, etc.)
- Ejemplo para `pronosticos_listos_free`:
  - {{1}} = `Juan`
  - {{2}} = `12`
- La aprobacion toma entre **10 minutos y 48 horas**
- Si es rechazado, ajusta el texto y reenvia

## Paso 7: Configurar el Webhook para Status Updates

### 7.1 Primero, deployar la Edge Function del webhook:

```bash
npx supabase functions deploy whatsapp-status-webhook --no-verify-jwt
```

### 7.2 Configurar el Verify Token en Supabase:

```bash
npx supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN="derbix_whatsapp_verify_2026"
```

(Puedes usar cualquier string secreto como verify token)

### 7.3 Registrar el webhook en Meta:

1. Ve a https://developers.facebook.com/ > tu app > **WhatsApp** > **Configuration**
2. En la seccion **Webhook**, click **Edit**
3. **Callback URL**:
```
https://<TU_PROJECT_REF>.supabase.co/functions/v1/whatsapp-status-webhook
```
   (Reemplaza `<TU_PROJECT_REF>` con tu ID de proyecto Supabase, ej: `xyzabcdefgh`)

4. **Verify Token**: `derbix_whatsapp_verify_2026` (el mismo que configuraste en secrets)
5. Click **Verify and Save**
   - Meta enviara un GET request con `hub.verify_token` a tu URL
   - Tu Edge Function respondera con el `hub.challenge` si el token coincide
   - Si sale error, verifica que la Edge Function esta deployada y el token coincide

### 7.4 Suscribirse a los campos de webhook:

Despues de verificar, en la misma seccion de Webhook:

1. Click **Manage** junto a "Webhook fields"
2. Suscribete a:
   - **messages** — para recibir mensajes de usuarios (futuro)
   - **message_template_status_update** — para saber si tus templates fueron aprobados/rechazados

### 7.5 En el WhatsApp Business Account:

1. Ve a **WhatsApp Manager** > **Account Tools** > **Webhooks**
2. O ve a tu app > **WhatsApp** > **Configuration** > seccion "Webhooks"
3. Asegurate de que el campo **messages** esta suscrito
   - Esto incluye status updates (sent, delivered, read)

## Paso 8: Configurar Short.io (URL Shortener - Opcional)

1. Ve a https://short.io/
2. Crea una cuenta gratuita
3. Agrega tu dominio (o usa el dominio gratuito que te dan)
4. Ve a **Integrations** > **API**
5. Copia tu **API Key** — este es tu `SHORT_IO_API_KEY`
6. Tu dominio (ej: `lnk.derbix.co` o el default de short.io) es tu `SHORT_IO_DOMAIN`

> **Nota**: Short.io es opcional. Sin el, los links en WhatsApp seran la URL completa con UTM params. WhatsApp muestra los links bien de cualquier forma.

## Paso 9: Configurar Secrets en Supabase

Ejecuta estos comandos uno por uno:

```bash
# WhatsApp Cloud API
npx supabase secrets set WHATSAPP_PHONE_NUMBER_ID="TU_PHONE_NUMBER_ID_AQUI"
npx supabase secrets set WHATSAPP_ACCESS_TOKEN="TU_SYSTEM_USER_TOKEN_AQUI"
npx supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN="derbix_whatsapp_verify_2026"

# Short.io (opcional)
npx supabase secrets set SHORT_IO_API_KEY="TU_SHORT_IO_API_KEY_AQUI"
npx supabase secrets set SHORT_IO_DOMAIN="TU_DOMINIO_CORTO_AQUI"

# FRONTEND_URL (ya deberia estar configurado)
npx supabase secrets set FRONTEND_URL="https://derbix.co"
```

## Paso 10: Ejecutar la Migracion SQL

Ejecuta el archivo `supabase/migrations/20260314_whatsapp_notifications.sql` en tu Supabase Dashboard:

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Pega el contenido del archivo de migracion
5. Click **Run**

Verifica que se crearon:
```sql
-- Verificar columnas en profiles
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('phone_number', 'phone_country_code');

-- Verificar tablas nuevas
SELECT * FROM notification_preferences LIMIT 1;
SELECT * FROM notification_log LIMIT 1;

-- Verificar system setting
SELECT * FROM system_settings WHERE key = 'whatsapp_notifications_enabled';
```

## Paso 11: Deploy de Edge Functions

```bash
npx supabase functions deploy send-whatsapp-notification --no-verify-jwt
npx supabase functions deploy whatsapp-status-webhook --no-verify-jwt
npx supabase functions deploy daily-parlay-generator --no-verify-jwt
npx supabase functions deploy hourly-results-verifier --no-verify-jwt
```

## Paso 12: Deploy del Frontend

```bash
git add .
git commit -m "feat: WhatsApp notification system"
git push origin main
# Netlify auto-deploys
```

## Paso 13: Testing End-to-End

### 13.1 Agregar tu numero como tester:

Si usas el numero de prueba de Meta:
1. Ve a **WhatsApp** > **API Setup** en tu app
2. En "To" field, click **Manage phone number list**
3. Agrega tu numero personal de WhatsApp
4. Verifica con el codigo que te llega

### 13.2 Probar envio manual:

Desde el panel de Admin de Derbix:
1. Ve a **Admin** > **Notificaciones** (en el Agency sidebar)
2. En "Enviar Notificacion de Prueba", ingresa tu numero completo: `+573001234567`
3. Click **Enviar**
4. Revisa tu WhatsApp — deberias recibir el template `pronosticos_listos_free`

### 13.3 Probar via curl (alternativa):

```bash
curl -X POST https://TU_PROJECT.supabase.co/functions/v1/send-whatsapp-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
  -d '{"notification_type": "test", "data": {"phone": "+573001234567"}}'
```

### 13.4 Verificar que el toggle funciona:

1. Ve a **Admin** > **OperationsCenter**
2. Desactiva "Notificaciones WhatsApp"
3. Intenta enviar una prueba — deberia decir "Disabled"
4. Reactiva el toggle

### 13.5 Probar flujo completo:

1. Registra un usuario nuevo con numero de WhatsApp
2. Espera al CRON de `daily-parlay-generator` (4:00 AM) o ejecutalo manualmente
3. Verifica que llega el WhatsApp de "Pronosticos listos"
4. Espera al `hourly-results-verifier` o ejecutalo manualmente
5. Verifica que llega el WhatsApp de "Resultados del dia" (solo 1 vez)

## Costos y Limites

| Concepto | Free Tier | Despues |
|----------|-----------|---------|
| WhatsApp Cloud API | 1,000 conversaciones/mes | ~$0.02-0.05/conv (LATAM) |
| Short.io | 1,000 links/mes | $19/mes (plan basico) |
| Supabase Edge Functions | Incluido en tu plan | N/A |

### Calculo de costos estimados:

- 50 usuarios con WhatsApp x 2 notificaciones/dia = 100 conversaciones/dia
- 100 x 30 = 3,000 conversaciones/mes
- Primeras 1,000 gratis = 2,000 de pago
- 2,000 x $0.03 = **~$60 USD/mes**

> Para la fase MVP con pocos usuarios, el free tier sera suficiente.

## Troubleshooting

### "Template not found" error
- Los templates tardan hasta 48h en aprobarse
- Verifica que el nombre del template coincide exactamente (case-sensitive)
- Verifica que el idioma es `es` (espanol)

### "Phone number not registered"
- El numero debe incluir codigo de pais sin `+` (ej: `573001234567`)
- Para numeros de prueba: debe estar en la lista de testers

### "Message failed to send"
- Verifica que el `WHATSAPP_ACCESS_TOKEN` no ha expirado
- Si usas el token temporal (24h), genera uno permanente via System User

### Webhook no recibe status updates
- Verifica que la URL del webhook esta bien configurada en Meta
- Verifica que el verify token coincide
- Revisa los logs en Supabase Dashboard > Edge Functions > Logs

### "131049" error (blocked)
- El usuario bloqueo tu numero en WhatsApp
- El sistema auto-desactiva las notificaciones para ese usuario
