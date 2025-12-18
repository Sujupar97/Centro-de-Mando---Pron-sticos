
import { supabase } from './supabaseService';
import { AnalysisJob, AnalysisRun, VisualAnalysisResult, DashboardAnalysisJSON } from '../types';

/**
 * Inicia un trabajo de análisis llamando a la Edge Function segura.
 */
export const createAnalysisJob = async (apiFixtureId: number, timezone: string = 'America/Bogota'): Promise<string> => {
    try {
        const { data, error } = await supabase.functions.invoke('create-analysis-job', {
            body: {
                api_fixture_id: apiFixtureId,
                timezone,
                last_n: 10,
                threshold: 70
            }
        });

        let responseData = data;

        // Robustez: Si data viene como string (problemas de headers), parsearlo manualmente
        if (typeof data === 'string') {
            try {
                responseData = JSON.parse(data);
            } catch (e) {
                console.error("Error parseando respuesta de string:", e);
                // Continuar con data original por si acaso
            }
        }

        if (error) {
            console.error("Error de Edge Function:", error);
            // Intentar extraer el mensaje de error real
            const errorMsg = error.message || JSON.stringify(error);
            throw new Error(errorMsg);
        }

        if (responseData.error) {
            console.error("Error devuelto por Edge Function:", responseData.error);
            throw new Error(responseData.error);
        }

        if (!responseData || !responseData.job_id) {
            console.error("Respuesta inesperada de Edge Function (raw):", data);
            console.error("Respuesta parseada:", responseData);
            throw new Error("La función no devolvió un job_id válido");
        }

        return responseData.job_id;

    } catch (err: any) {
        console.error("Error crítico iniciando análisis:", err);
        // Mostrar el error real en lugar de un mensaje genérico
        throw new Error(err.message || "No se pudo conectar con el servidor de análisis. Intenta nuevamente.");
    }
};

/**
 * Obtiene el estado actual de un trabajo haciendo polling a la tabla 'analysis_jobs'.
 */
export const getAnalysisJob = async (jobId: string): Promise<AnalysisJob | null> => {
    const { data, error } = await supabase
        .from('analysis_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (error) {
        return null;
    }
    return data as AnalysisJob;
};

/**
 * Obtiene el resultado final (Run + Predicciones) cuando el job está 'done'.
 */
export const getAnalysisResult = async (jobId: string): Promise<VisualAnalysisResult | null> => {
    // 1. Obtener el run asociado al job
    const { data: runData, error: runError } = await supabase
        .from('analysis_runs')
        .select('*')
        .eq('job_id', jobId)
        .single();

    if (runError || !runData) {
        console.error("Error fetching analysis run:", runError);
        return null;
    }

    const run = runData as AnalysisRun;

    // 2. Transformar al formato VisualAnalysisResult para la UI
    return {
        analysisText: run.summary_pre_text || "Análisis completado.",
        dashboardData: run.report_pre_jsonb as DashboardAnalysisJSON,
        analysisRun: run
    };
};

/**
 * Obtiene el resultado (Reporte) directamente por ID de Ejecución (Run ID).
 * Útil para Top Picks que ya tienen el ID del run.
 */
export const getAnalysisResultByRunId = async (runId: string): Promise<VisualAnalysisResult | null> => {
    const { data: runData, error: runError } = await supabase
        .from('analysis_runs')
        .select('*')
        .eq('id', runId)
        .single();

    if (runError || !runData) {
        console.error("Error fetching analysis run by ID:", runError);
        return null;
    }

    const run = runData as AnalysisRun;

    return {
        analysisText: run.summary_pre_text || "Análisis completado.",
        dashboardData: run.report_pre_jsonb as DashboardAnalysisJSON,
        analysisRun: run
    };
};

// Se eliminan simulateJobProgressInFrontend, simulateBackendWorker y createLocalJobFallback
// porque eran inseguros y ya no se necesitan.
