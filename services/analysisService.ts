
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

        if (error) {
            // Manejar errores específicos de la función
            const msg = error.message || "Error desconocido al iniciar el análisis.";
            throw new Error(msg);
        }
        
        return data.job_id;

    } catch (err: any) {
        console.error("Error crítico iniciando análisis:", err);
        throw new Error("No se pudo conectar con el servidor de análisis. Intenta nuevamente.");
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
        .select('*, predictions(*)')
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

// Se eliminan simulateJobProgressInFrontend, simulateBackendWorker y createLocalJobFallback
// porque eran inseguros y ya no se necesitan.
