/**
 * Obtiene la fecha actual en formato YYYY-MM-DD para la zona horaria de Bogotá, Colombia.
 * Esta es la forma más robusta de manejar fechas y zonas horarias en JavaScript moderno
 * sin librerías externas, eliminando cualquier desfase horario.
 * @returns {string} La fecha en formato 'YYYY-MM-DD'.
 */
export const getCurrentDateInBogota = (): string => {
    const today = new Date();

    // Usamos el formateador de fecha internacional para obtener las partes de la fecha
    // específicamente en la zona horaria de Bogotá. El formato 'en-CA' (Canadá)
    // produce 'YYYY-MM-DD' de forma nativa y fiable.
    const formatter = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Bogota',
    });

    return formatter.format(today);
};

export const getLocalDayRange = (date: string): { startOfDay: string; endOfDay: string } => {
    return {
        startOfDay: `${date}T00:00:00`,
        endOfDay: `${date}T23:59:59`
    };
};
