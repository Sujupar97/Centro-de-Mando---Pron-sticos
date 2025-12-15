import { useState, useCallback } from 'react';
import { VisualAnalysisResult, Game } from '../types';
import { supabase } from '../services/supabaseService';

export const useAnalysisCache = () => {
    const [analysisCache, setAnalysisCache] = useState<Record<string, VisualAnalysisResult>>({});
    const [analysisStatus, setAnalysisStatusState] = useState<Record<number, 'loading' | 'done' | 'error'>>({});

    const fetchAnalysesForGames = useCallback(async (gameIds: number[]) => {
        if (gameIds.length === 0) return;

        try {
            const { data, error } = await supabase
                .from('analisis')
                .select('partido_id, resultado_analisis')
                .in('partido_id', gameIds);

            if (error) throw error;
            
            if (data) {
                const newAnalyses: Record<string, VisualAnalysisResult> = {};
                const newStatuses: Record<number, 'done'> = {};
                
                data.forEach(item => {
                    newAnalyses[item.partido_id] = item.resultado_analisis as VisualAnalysisResult;
                    newStatuses[item.partido_id] = 'done';
                });
                
                setAnalysisCache(prev => ({ ...prev, ...newAnalyses }));
                setAnalysisStatusState(prev => ({ ...prev, ...newStatuses }));
            }
        } catch (error: any) {
            const errorMessage = error.message ? error.message : JSON.stringify(error);
            console.error(`Error al obtener análisis desde Supabase: ${errorMessage}`);
        }
    }, []);

    const saveAnalysis = useCallback(async (game: Game, result: VisualAnalysisResult) => {
        const fixtureId = game.fixture.id;
        try {
            // PASO 1: Asegurar que el partido existe en la tabla `partidos`.
            // Esto es crucial para satisfacer la restricción de clave foránea 'fk_partido'.
            const { error: gameUpsertError } = await supabase
                .from('partidos')
                .upsert({
                    id: fixtureId,
                    fecha: new Date(game.fixture.timestamp * 1000).toISOString(),
                    equipo_local_id: game.teams.home.id,
                    equipo_local_nombre: game.teams.home.name,
                    equipo_local_logo: game.teams.home.logo,
                    equipo_visitante_id: game.teams.away.id,
                    equipo_visitante_nombre: game.teams.away.name,
                    equipo_visitante_logo: game.teams.away.logo,
                    liga_id: game.league.id,
                    liga_nombre: game.league.name,
                    estado_partido: game.fixture.status.long,
                }, { onConflict: 'id' });

            if (gameUpsertError) {
                console.error("Error al guardar el partido en la tabla 'partidos':", gameUpsertError);
                throw gameUpsertError; // Detener si no se puede crear el registro padre
            }

            // PASO 2: Guardar el análisis en la tabla 'analisis'
            const { error: analysisError } = await supabase
                .from('analisis')
                .upsert({ 
                    partido_id: fixtureId, 
                    resultado_analisis: result as any
                }, { onConflict: 'partido_id' });

            if (analysisError) throw analysisError;

            // PASO 3: Actualizar el caché en memoria
            setAnalysisCache(prevCache => ({
                ...prevCache,
                [fixtureId]: result,
            }));
            
        } catch (error: any) {
            const errorMessage = error.message ? error.message : JSON.stringify(error);
            if (errorMessage.includes('violates row-level security policy')) {
                 console.error(
                    `%cERROR DE PERMISOS EN SUPABASE:`,
                    `color: red; font-weight: bold; font-size: 14px;`,
                    `\nLa operación en la tabla 'analisis' fue bloqueada por la política de seguridad a nivel de fila (RLS).`,
                    `\nAsegúrate de que la tabla 'analisis' tiene una política que permita inserciones/actualizaciones para usuarios autenticados.`,
                    `\nPuedes ejecutar el script en 'supabase/migrations/001_setup_rls_policies.sql' en el editor SQL de Supabase para solucionarlo.`
                );
            } else {
                console.error('Error al guardar análisis en Supabase:', errorMessage);
            }
            throw new Error(errorMessage);
        }
    }, []);
    
    const getAnalysis = useCallback((gameId: string): VisualAnalysisResult | null => {
        return analysisCache[gameId] || null;
    }, [analysisCache]);

    const setAnalysisStatus = useCallback((gameId: number, status: 'loading' | 'done' | 'error') => {
        setAnalysisStatusState(prev => ({ ...prev, [gameId]: status }));
    }, []);

    return { 
        saveAnalysis, 
        getAnalysis, 
        analysisStatus, 
        setAnalysisStatus,
        fetchAnalysesForGames
    };
};