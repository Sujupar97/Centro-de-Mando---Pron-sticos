# Reporte de Diagnóstico: Datos Faltantes en "Away Last 10"

## Causa Raíz Identificada
El sistema actual solicita a la API los **últimos 15 partidos en total** (`last=15`) para cada equipo y luego intenta separar manualmente los jugados en casa y los jugados fuera.

**El problema es matemático:**
En una temporada normal, los partidos se alternan (Casa - Fuera).
- Si traemos los últimos 15 partidos, estadísticamente tendremos aprox. **7 de local y 8 de visita** (o viceversa).
- **Es imposible obtener los "Últimos 10 partidos de Visita" si solo miramos los últimos 15 partidos totales.** Para conseguir 10 de visita, necesitaríamos revisar al menos los últimos 20 o 25 partidos del equipo.

Por eso la IA reporta "Datos Insuficientes": el array que filtra los partidos de visita a menudo tiene solo 6, 7 u 8 elementos, lo cual activa la advertencia de falta de datos o obliga a usar promedios.

## Solución Propuesta
Aumentar el rango de búsqueda histórico en la función `create-analysis-job`.

**Cambio Recomendado:**
Modificar la petición a la API de:
`fetchFootball('fixtures?team=${homeTeam.id}&last=15&status=FT')`
a
`fetchFootball('fixtures?team=${homeTeam.id}&last=40&status=FT')`

**Beneficios:**
1.  Al traer 40 partidos, garantizamos tener (aprox.) 20 de local y 20 de visita.
2.  Podremos extraer con seguridad los **últimos 10** de cada categoría sin riesgo de quedarnos cortos.
3.  No requiere llamadas extra a la API (solo una respuesta JSON un poco más larga).
4.  Eliminará casi por completo las advertencias de "Falta de datos recientes".

¿Deseas que proceda a aplicar este ajuste en el código de la Edge Function?
