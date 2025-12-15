import { supabase } from './supabaseService';
import { PerformanceReportResult, PerformanceReportDB } from '../types';

/**
 * Guarda un informe de rendimiento generado en la base de datos.
 * @param userId - El ID del usuario al que pertenece el informe.
 * @param reportData - El objeto JSON del informe de rendimiento.
 * @param startDate - La fecha de inicio del período del informe.
 * @param endDate - La fecha de fin del período del informe.
 */
export const savePerformanceReport = async (
    userId: string,
    reportData: PerformanceReportResult,
    startDate: string,
    endDate: string
): Promise<void> => {
    try {
        const { error } = await supabase.from('performance_reports').insert({
            user_id: userId,
            report_data: reportData as any, // Supabase maneja la conversión a JSONB
            start_date: startDate,
            end_date: endDate,
        });

        if (error) {
            throw error;
        }

        console.log(`Informe de rendimiento para el usuario ${userId} guardado exitosamente.`);
    } catch (error: any) {
        console.error('Error al guardar el informe de rendimiento en Supabase:', error.message);
        // Opcional: podrías querer manejar este error de forma más visible para el usuario.
        throw new Error('No se pudo guardar el informe de rendimiento.');
    }
};

/**
 * Obtiene el informe de rendimiento más reciente para un usuario específico.
 * @param userId - El ID del usuario.
 * @returns El objeto de datos del informe más reciente, o null si no se encuentra.
 */
export const getLatestPerformanceReport = async (
    userId: string
): Promise<PerformanceReportResult | null> => {
    try {
        const { data, error } = await supabase
            .from('performance_reports')
            .select('report_data')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            // El error 'PGRST116' significa "No rows found", lo cual es esperado si el usuario no tiene informes.
            if (error.code === 'PGRST116') {
                console.log(`No se encontraron informes de rendimiento para el usuario ${userId}.`);
                return null;
            }
            throw error;
        }

        return data?.report_data as PerformanceReportResult || null;
    } catch (error: any) {
        console.error('Error al obtener el último informe de rendimiento:', error.message);
        return null;
    }
};
