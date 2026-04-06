# SOP — Programa de Afiliados Derbix

**Para quién**: Cualquier miembro del equipo con acceso de administrador a Derbix.
**Herramientas necesarias**: Navegador web con acceso a derbix.co (cuenta admin) y whop.com (cuenta de empresa).

---

## Flujo General

```
Dar de alta afiliado (Derbix Admin) → Compartir link → Usuario se registra →
Usuario paga → Calcular comisiones (Derbix Admin) → Pagar (Whop) → Marcar como pagado
```

---

## Procedimiento 1: Dar de Alta un Afiliado Nuevo

### Lo que necesitas antes de empezar:
- Nombre completo del YouTuber/influencer
- Nombre de su canal
- URL de su canal (YouTube, Instagram, TikTok, etc.)
- Email de contacto
- WhatsApp (opcional)

### Pasos en Derbix:

1. Inicia sesión en **derbix.co** con tu cuenta de administrador
2. Ve a **Admin** en el menú lateral
3. Haz clic en el botón naranja **"Afiliados"**
4. Haz clic en **"+ Nuevo Afiliado"**
5. Llena el formulario:
   - **Código**: un nombre corto y único, todo en minúsculas, sin espacios. Ejemplo: `juanyt`, `futbolmania`, `betpro`. Este código será parte del link del afiliado.
   - **Comisión %**: dejar en **30** (el estándar). Solo cambiar si se negoció algo diferente.
   - **Nombre completo**: nombre real del afiliado
   - **Nombre del canal**: nombre público de su canal/perfil
   - **URL del canal**: link completo a su canal
   - **Email**: para comunicación
   - **WhatsApp**: número con código de país
   - **Usuario Whop**: dejarlo vacío por ahora, se llena en el Paso 2
   - **Notas**: cualquier información relevante (cómo lo contactamos, acuerdos especiales, etc.)
6. Haz clic en **"Crear Afiliado"**
7. Aparecerá en la lista. Haz clic en su nombre para ver su ficha completa
8. En la ficha verás el **link de afiliado**. Haz clic en **"Copiar"** para copiarlo al portapapeles

### Pasos en Whop (para activar pagos automáticos):

1. Ve a **whop.com/dash** e inicia sesión con la cuenta de empresa
2. En el menú lateral, ve a **Marketing → Affiliates**
3. Haz clic en **"Invite Affiliate"**
4. Ingresa el **email** del afiliado
5. Configura:
   - Comisión: **30%**
   - Tipo: **Percentage**
   - Frecuencia: **Recurring** (para que gane en cada renovación)
6. Envía la invitación
7. Cuando el afiliado acepte, anota su **usuario de Whop**
8. Vuelve a **Derbix → Admin → Afiliados**, haz clic en el afiliado, luego **"Editar"**, y llena el campo **"Usuario Whop"**

### Qué enviarle al afiliado:

Envía por email o WhatsApp:

> Hola [nombre], ya está todo listo. Aquí tienes:
>
> **Tu link personalizado**: https://derbix.co/signup?ref=[CÓDIGO]
>
> Cada persona que se registre usando este link queda vinculada a tu cuenta. Ganas 30% de comisión recurrente de cada pago que hagan.
>
> La plataforma es gratuita para probar — tus seguidores pueden entrar sin riesgo y ver los pronósticos.
>
> También te enviamos una invitación a Whop (revisa tu email) para que puedas ver tus comisiones y recibir pagos automáticamente.

---

## Procedimiento 2: Calcular Comisiones del Mes

**Cuándo**: El día **1 de cada mes** (o el primer día hábil).

### Pasos:

1. Inicia sesión en **derbix.co** con tu cuenta de administrador
2. Ve a **Admin → Afiliados**
3. En la sección superior verás **"Calcular comisiones del mes"** con un selector de fecha
4. Selecciona el **mes anterior** (ejemplo: si estamos en mayo, selecciona abril)
5. Haz clic en **"Calcular Comisiones"**
6. El sistema te mostrará un mensaje con cuántas comisiones se registraron
7. Si dice "No hay nuevas comisiones", significa que no hubo pagos de usuarios referidos en ese mes

### Qué pasa internamente:

El sistema busca todos los pagos del mes seleccionado, cruza con los usuarios que tienen un código de referido (`ref=`) en su perfil, y registra automáticamente la comisión correspondiente (30% del pago) como "Pendiente".

---

## Procedimiento 3: Revisar y Pagar Comisiones

### Revisar lo que se debe:

1. En **Admin → Afiliados**, haz clic en el nombre de un afiliado
2. Verás 4 indicadores:
   - **Referidos**: total de usuarios que se registraron con su link
   - **Pagando**: cuántos de esos tienen plan de pago activo
   - **Pendiente**: dinero que se le debe (en USD)
   - **Total pagado**: lo que ya se le pagó históricamente
3. Abajo verás el **Historial de comisiones** con cada comisión y su estado (Pendiente/Pagada)

### Hacer el pago:

**Opción A — Via Whop (preferida):**
1. Ve a **whop.com/dash → Marketing → Affiliates**
2. Whop muestra las comisiones pendientes y las paga automáticamente después de 30 días
3. Si el pago ya se procesó en Whop, regresa a Derbix para registrarlo

**Opción B — Transferencia directa:**
1. Haz la transferencia al afiliado (bancaria, crypto, etc.)
2. Guarda el comprobante

### Registrar el pago en Derbix:

1. En la ficha del afiliado (Admin → Afiliados → clic en su nombre)
2. Si hay monto pendiente, verás el botón verde **"Pagar $XX.XX pendiente"**
3. Haz clic en ese botón
4. Selecciona el **método de pago** (Whop, Transferencia, Crypto, Otro)
5. Escribe una **nota** con la referencia del pago (ejemplo: "Transferencia Bancolombia ref #456789, abril 2026")
6. Haz clic en **"Confirmar Pago"**
7. Todas las comisiones pendientes de ese afiliado se marcarán como pagadas

---

## Procedimiento 4: Desactivar un Afiliado

Si un afiliado ya no colabora con nosotros:

1. Ve a **Admin → Afiliados**
2. En la lista, junto al nombre del afiliado, hay un ícono de prohibido (círculo con línea)
3. Haz clic en ese ícono para **desactivarlo**
4. El afiliado quedará marcado como "Inactivo"
5. Su link de registro seguirá funcionando (no queremos romper links que ya estén publicados), pero no se calcularán nuevas comisiones para este afiliado

Para **reactivarlo**, haz clic en el mismo ícono (ahora mostrará un check).

---

## Procedimiento 5: Revisar el Estado General del Programa

Para una vista rápida de cómo va el programa:

1. Ve a **Admin → Afiliados**
2. La lista principal muestra todos los afiliados con:
   - Nombre y canal
   - Estado (Activo/Inactivo)
   - Porcentaje de comisión
   - Número total de referidos
3. Haz clic en cualquier afiliado para ver el detalle completo

---

## Checklist Mensual

Cada mes, el día 1 (o primer día hábil):

- [ ] Ir a Admin → Afiliados
- [ ] Calcular comisiones del mes anterior
- [ ] Revisar cada afiliado con monto pendiente
- [ ] Verificar que los pagos se procesaron en Whop (o hacer transferencia)
- [ ] Registrar los pagos en Derbix (botón "Pagar pendiente")
- [ ] Enviar comprobante de pago a cada afiliado por WhatsApp/email

---

## Datos del Programa

| Concepto | Valor |
|----------|-------|
| Comisión estándar | 30% recurrente |
| Período de corte | Mensual (día 1) |
| Período de pago | Días 1-5 del mes |
| Link base | `https://derbix.co/signup?ref=CÓDIGO` |
| Método de pago preferido | Whop (automático) |
| Métodos de pago alternativos | Transferencia bancaria, crypto |

---

## Preguntas Frecuentes

**¿Qué pasa si un usuario se registra sin el link?**
No queda vinculado a ningún afiliado. El código `ref=` debe estar en la URL al momento del registro.

**¿El afiliado gana comisión solo una vez o en cada pago?**
En cada pago (recurrente). Mientras el usuario referido siga pagando, el afiliado sigue ganando.

**¿Qué pasa si desactivo un afiliado?**
Sus comisiones pendientes se mantienen. Solo deja de generar nuevas comisiones. El link sigue funcionando para que los usuarios puedan registrarse.

**¿Se puede cambiar el porcentaje de comisión?**
Sí. En la ficha del afiliado, haz clic en "Editar" y cambia el campo "Comisión %". Los nuevos pagos usarán el porcentaje actualizado.
