import React from 'react';
import { DashboardAnalysisJSON, TablaComparativaData, AnalisisSeccion, DetallePrediccion } from '../../types';
import { TrophyIcon, LightBulbIcon, ExclamationTriangleIcon, SparklesIcon, ChartBarIcon } from '../icons/Icons';

// --- HEADER ---
export const InlineReportHeader: React.FC<{ data: DashboardAnalysisJSON['header_partido'] }> = ({ data }) => {
    if (!data) return null;
    return (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-white/10 p-4 rounded-xl">
            <h3 className="text-lg font-bold text-white mb-0.5">{data.titulo}</h3>
            <p className="text-brand text-xs font-medium mb-2">{data.subtitulo}</p>
            <div className="flex flex-wrap gap-1.5">
                {data.bullets_clave?.map((b, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-700/50 rounded-full text-[10px] text-slate-300 border border-slate-600">
                        {b}
                    </span>
                ))}
            </div>
        </div>
    );
};

// --- VERDICT ---
export const InlineVerdict: React.FC<{ data: NonNullable<DashboardAnalysisJSON['veredicto_analista']> }> = ({ data }) => {
    const isBet = data.decision === 'APOSTAR';
    const isAvoid = data.decision === 'EVITAR';

    const borderColor = isBet ? 'border-emerald-500' : isAvoid ? 'border-red-500' : 'border-blue-400';
    const bgColor = isBet ? 'bg-emerald-900/30' : isAvoid ? 'bg-red-900/20' : 'bg-blue-900/20';
    const accentColor = isBet ? 'text-emerald-400' : isAvoid ? 'text-red-400' : 'text-blue-400';
    const probability = data.probabilidad || (isBet ? 75 : 40);

    return (
        <div className={`${bgColor} border ${borderColor} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className={`text-xl font-black uppercase ${accentColor}`}>
                        {data.titulo_accion || data.decision}
                    </span>
                    {data.nivel_confianza && (
                        <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${
                            isBet ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-600 bg-slate-800 text-slate-400'
                        }`}>
                            {data.nivel_confianza}
                        </span>
                    )}
                </div>
                <div className={`text-2xl font-black ${accentColor}`}>{probability}%</div>
            </div>

            {isBet && data.seleccion_clave && (
                <div className="bg-emerald-500/10 px-4 py-2.5 rounded-lg border border-emerald-500/30 mb-2">
                    <span className="text-[9px] text-emerald-500/70 uppercase font-bold tracking-widest block mb-0.5">Apuesta Recomendada</span>
                    <span className="text-lg font-black text-white">{data.seleccion_clave}</span>
                </div>
            )}

            <p className="text-sm text-slate-300 italic">"{data.razon_principal}"</p>

            {data.riesgo_principal && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-300 bg-amber-900/20 px-3 py-1.5 rounded">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                    <span>{data.riesgo_principal}</span>
                </div>
            )}
        </div>
    );
};

// --- EXECUTIVE SUMMARY ---
export const InlineExecutiveSummary: React.FC<{ data: DashboardAnalysisJSON['resumen_ejecutivo'] }> = ({ data }) => {
    if (!data) return null;
    return (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
                <LightBulbIcon className="w-4 h-4 text-yellow-400" />
                <h4 className="text-sm font-bold text-white">Resumen Ejecutivo</h4>
            </div>
            <p className="text-sm text-white font-medium italic mb-2">"{data.frase_principal}"</p>
            <ul className="space-y-1">
                {data.puntos_clave?.map((p, i) => (
                    <li key={i} className="flex items-start text-xs text-slate-300">
                        <span className="text-brand mr-1.5 mt-0.5 shrink-0">●</span>
                        {p}
                    </li>
                ))}
            </ul>
        </div>
    );
};

// --- TABLE ---
export const InlineTable: React.FC<{ data: TablaComparativaData }> = ({ data }) => (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden border border-white/5">
        <div className="bg-slate-700/30 px-3 py-2 border-b border-white/5">
            <h5 className="text-xs font-bold text-white">{data.titulo}</h5>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead className="bg-slate-700/20 text-slate-500 uppercase text-[10px]">
                    <tr>
                        {data.columnas.map((col, i) => (
                            <th key={i} className="px-3 py-1.5 font-medium whitespace-nowrap text-left">{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                    {(data.filas || []).map((fila, fi) => (
                        <tr key={fi} className="hover:bg-white/5">
                            {(Array.isArray(fila) ? fila : []).map((celda, ci) => (
                                <td key={ci} className={`px-3 py-1.5 ${ci === 0 ? 'font-medium text-white' : 'text-slate-400'}`}>
                                    {celda}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

// --- ANALYSIS BLOCK ---
export const InlineAnalysisBlock: React.FC<{ section: AnalisisSeccion }> = ({ section }) => {
    if (!section) return null;
    return (
        <div>
            <h5 className="text-xs font-bold text-brand uppercase tracking-wider mb-1.5">{section.titulo}</h5>
            {section.bullets && (
                <ul className="space-y-1">
                    {section.bullets.map((b, i) => (
                        <li key={i} className="text-xs text-slate-300 pl-3 border-l-2 border-slate-600">
                            {b}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

// --- PREDICTION CARD (compact) ---
export const InlinePredictionCard: React.FC<{ pred: DetallePrediccion }> = ({ pred }) => {
    const prob = pred.probabilidad_estimado_porcentaje;
    const isHigh = prob >= 83;
    const borderColor = isHigh ? 'border-brand/30' : 'border-white/5';
    const justif = pred.justificacion_detallada;
    const edge = (pred as any).edge;

    return (
        <div className={`bg-slate-800/50 rounded-lg p-3 border ${borderColor}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{pred.mercado}</span>
                        {isHigh && (
                            <span className="text-[9px] bg-brand/20 text-brand px-1.5 py-0.5 rounded font-bold">TOP</span>
                        )}
                        {edge && edge > 0 && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                                +{edge}%
                            </span>
                        )}
                    </div>
                    <h4 className="text-white font-bold text-sm">{pred.seleccion}</h4>
                    {justif?.conclusion && (
                        <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{justif.conclusion}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {pred.odds && (
                        <div className="bg-blue-500/10 border border-blue-500/30 px-2 py-1 rounded-lg">
                            <span className="text-blue-300 font-black text-sm">@{pred.odds.toFixed(2)}</span>
                        </div>
                    )}
                    <div className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center ${
                        isHigh ? 'bg-brand/10 border border-brand/30' : 'bg-slate-700/50'
                    }`}>
                        <span className={`text-base font-black ${isHigh ? 'text-brand' : 'text-white'}`}>{prob}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- WARNINGS ---
export const InlineWarnings: React.FC<{ data: NonNullable<DashboardAnalysisJSON['advertencias']> }> = ({ data }) => (
    <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg flex items-start gap-2">
        <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
        <div>
            <h5 className="font-bold text-yellow-500 text-xs mb-1">{data.titulo}</h5>
            <ul className="list-disc pl-3 text-yellow-200/80 text-[11px] space-y-0.5">
                {data.bullets.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
        </div>
    </div>
);

// --- SCENARIOS ---
export const InlineScenarios: React.FC<{ data: any }> = ({ data }) => {
    const scenarios = data?.escenarios || [];
    if (scenarios.length === 0) return null;

    return (
        <div className="bg-blue-900/15 border border-blue-500/20 rounded-xl p-4">
            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <LightBulbIcon className="w-4 h-4" />
                {data.titulo || 'Escenarios de Partido'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {scenarios.map((esc: any, i: number) => (
                    <div key={i} className="bg-slate-800/60 p-3 rounded-lg border-l-2 border-blue-500">
                        <div className="flex justify-between items-start mb-1">
                            <h5 className="font-bold text-white text-xs">{esc.nombre}</h5>
                            <span className="text-[10px] bg-blue-900/50 text-blue-200 px-1.5 py-0.5 rounded font-mono">{esc.probabilidad_aproximada}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">{esc.descripcion}</p>
                        {esc.implicacion_apuestas && (
                            <div className="bg-blue-500/10 px-2 py-1 rounded text-[10px] text-blue-200 mt-1.5">
                                <strong className="text-blue-400">Apuesta:</strong> {esc.implicacion_apuestas}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- FULL INLINE REPORT ---
export const InlineReport: React.FC<{ data: DashboardAnalysisJSON }> = ({ data }) => {
    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            {data.header_partido && <InlineReportHeader data={data.header_partido} />}

            {/* Verdict */}
            {data.veredicto_analista && <InlineVerdict data={data.veredicto_analista} />}

            {/* Executive Summary */}
            {data.resumen_ejecutivo && <InlineExecutiveSummary data={data.resumen_ejecutivo} />}

            {/* Tables */}
            {data.tablas_comparativas && Object.keys(data.tablas_comparativas).length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ChartBarIcon className="w-4 h-4 text-brand" />
                        Datos Clave
                    </h4>
                    {Object.values(data.tablas_comparativas).map((tabla, i) => (
                        <InlineTable key={i} data={tabla} />
                    ))}
                </div>
            )}

            {/* Analysis */}
            {data.analisis_detallado && (
                <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Anlisis Profundo</h4>

                    {/* Central reasoning */}
                    {(data.analisis_detallado as any).razonamiento_central && (
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-blue-500/20">
                            <h5 className="text-xs font-bold text-blue-300 mb-1 flex items-center gap-1">
                                <SparklesIcon className="w-3.5 h-3.5" />
                                Tesis de Inversin
                            </h5>
                            <p className="text-slate-300 text-xs leading-relaxed border-l-2 border-blue-500 pl-3">
                                {(data.analisis_detallado as any).razonamiento_central}
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <InlineAnalysisBlock section={data.analisis_detallado.matchup_tactico || data.analisis_detallado.estilo_y_tactica} />
                        <InlineAnalysisBlock section={data.analisis_detallado.factor_psicologico as any} />
                        <InlineAnalysisBlock section={data.analisis_detallado.impacto_arbitro as any} />
                        <InlineAnalysisBlock section={data.analisis_detallado.factores_situacionales} />
                    </div>

                    {/* Scenarios */}
                    {(data.analisis_detallado.analisis_escenarios || data.analisis_detallado.escenarios_de_partido) && (
                        <InlineScenarios data={data.analisis_detallado.analisis_escenarios || data.analisis_detallado.escenarios_de_partido} />
                    )}
                </div>
            )}

            {/* Predictions */}
            {data.predicciones_finales?.detalle && data.predicciones_finales.detalle.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <TrophyIcon className="w-4 h-4 text-brand" />
                        Predicciones del Modelo
                    </h4>
                    {data.predicciones_finales.detalle.map((pred, i) => (
                        <InlinePredictionCard key={pred.id || i} pred={pred} />
                    ))}
                </div>
            )}

            {/* Warnings */}
            {data.advertencias?.bullets && data.advertencias.bullets.length > 0 && (
                <InlineWarnings data={data.advertencias} />
            )}
        </div>
    );
};
