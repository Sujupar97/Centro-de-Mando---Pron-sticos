
import React from 'react';
import { VisualAnalysisResult, DashboardAnalysisJSON, TablaComparativaData, AnalisisSeccion, DetallePrediccion, GraficoSugerido } from '../../types';
import { XMarkIcon, TrophyIcon, ChartBarIcon, ListBulletIcon, LightBulbIcon, ExclamationTriangleIcon, LinkIcon } from '../icons/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- COMPONENTES AUXILIARES DEL DASHBOARD ---

const HeaderSection: React.FC<{ data: DashboardAnalysisJSON['header_partido'] }> = ({ data }) => {
    if (!data) return null;
    return (
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-green-accent p-6 rounded-t-xl">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">{data.titulo}</h2>
            <p className="text-green-accent font-medium mb-4">{data.subtitulo}</p>
            <div className="flex flex-wrap gap-2">
                {data.bullets_clave?.map((bullet, idx) => (
                    <span key={idx} className="px-3 py-1 bg-gray-700/50 rounded-full text-xs text-gray-300 border border-gray-600">
                        {bullet}
                    </span>
                ))}
            </div>
        </div>
    );
};

const ExecutiveSummary: React.FC<{ data: DashboardAnalysisJSON['resumen_ejecutivo'] }> = ({ data }) => {
    if (!data) return null;
    return (
        <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg">
            <div className="flex items-center mb-3">
                <LightBulbIcon className="w-6 h-6 text-yellow-400 mr-2" />
                <h3 className="text-lg font-bold text-white">Resumen Ejecutivo</h3>
            </div>
            <p className="text-lg text-white font-medium mb-4 italic">"{data.frase_principal}"</p>
            <ul className="space-y-2">
                {data.puntos_clave?.map((point, idx) => (
                    <li key={idx} className="flex items-start text-gray-300 text-sm">
                        <span className="text-green-accent mr-2 mt-1">●</span>
                        {point}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const DynamicTable: React.FC<{ data: TablaComparativaData }> = ({ data }) => (
    <div className="bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700">
        <div className="bg-gray-800/80 p-3 border-b border-gray-700">
            <h4 className="font-semibold text-white text-sm">{data.titulo}</h4>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-700/50 text-gray-400 uppercase text-xs">
                    <tr>
                        {data.columnas.map((col, idx) => (
                            <th key={idx} className="px-4 py-2 font-medium whitespace-nowrap">{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {data.filas.map((fila, fIdx) => (
                        <tr key={fIdx} className="hover:bg-gray-800/30 transition-colors">
                            {fila.map((celda, cIdx) => (
                                <td key={cIdx} className={`px-4 py-3 text-gray-300 ${cIdx === 0 ? 'font-medium text-white' : ''}`}>
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

const AnalysisBlock: React.FC<{ section: AnalisisSeccion; icon?: React.ReactNode }> = ({ section, icon }) => {
    if (!section) return null;
    return (
        <div className="mb-6">
            <h4 className="text-md font-bold text-green-accent mb-3 flex items-center uppercase tracking-wider">
                {icon} {section.titulo}
            </h4>
            {section.bullets && (
                <ul className="space-y-2 mb-4">
                    {section.bullets.map((bullet, idx) => (
                        <li key={idx} className="text-gray-300 text-sm pl-4 border-l-2 border-gray-600 hover:border-green-accent transition-colors">
                            {bullet}
                        </li>
                    ))}
                </ul>
            )}
            {section.escenarios && (
                <div className="grid grid-cols-1 gap-3">
                    {section.escenarios.map((esc, idx) => (
                        <div key={idx} className="bg-gray-800/40 p-3 rounded border border-gray-700">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-white text-sm">{esc.nombre}</span>
                                <span className="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded-full">{esc.probabilidad_aproximada}</span>
                            </div>
                            <p className="text-xs text-gray-400">{esc.descripcion}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const VisualChart: React.FC<{ data: GraficoSugerido }> = ({ data }) => {
    // Transformar datos para Recharts
    const chartData = Object.keys(data.series[0].valores).map(key => {
        const item: any = { name: key };
        data.series.forEach(serie => {
            item[serie.nombre] = serie.valores[key];
        });
        return item;
    });

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h4 className="text-sm font-bold text-white mb-1">{data.titulo}</h4>
            <p className="text-xs text-gray-400 mb-4">{data.descripcion}</p>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={false} />
                        <XAxis type="number" stroke="#9ca3af" fontSize={10} />
                        <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={10} width={80} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        {data.series.map((serie, idx) => (
                            <Bar key={idx} dataKey={serie.nombre} fill={colors[idx % colors.length]} radius={[0, 4, 4, 0]} barSize={20} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const PredictionCard: React.FC<{ pred: DetallePrediccion }> = ({ pred }) => {
    const prob = pred.probabilidad_estimado_porcentaje;
    const color = prob >= 70 ? 'text-green-accent' : prob >= 55 ? 'text-yellow-400' : 'text-gray-300';
    const border = prob >= 70 ? 'border-green-accent' : 'border-gray-600';

    return (
        <div className={`bg-gray-800 rounded-xl overflow-hidden border-l-4 ${border} shadow-lg mb-6`}>
            <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-700/20">
                <div>
                    <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">{pred.mercado}</span>
                    <h3 className="text-xl font-bold text-white mt-1">{pred.seleccion}</h3>
                </div>
                <div className="flex flex-col items-center justify-center bg-gray-900 rounded-lg p-2 min-w-[70px]">
                    <span className={`text-2xl font-bold ${color}`}>{prob}%</span>
                    <span className="text-[10px] text-gray-500 uppercase">Prob.</span>
                </div>
            </div>
            <div className="p-5">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center">
                    <ListBulletIcon className="w-4 h-4 mr-2 text-blue-400" /> Justificación del Analista
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                        <strong className="text-gray-400 block mb-1">Base Estadística:</strong>
                        <ul className="list-disc pl-4 text-gray-300 space-y-1">
                            {pred.justificacion_detallada.base_estadistica.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                    </div>
                    <div>
                        <strong className="text-gray-400 block mb-1">Factor Clave:</strong>
                        <p className="text-gray-300">{pred.justificacion_detallada.contexto_competitivo[0]}</p>
                    </div>
                </div>
                <div className="bg-blue-900/20 p-3 rounded text-sm text-blue-200 border border-blue-900/50">
                    <strong className="block mb-1 text-blue-400">Conclusión:</strong>
                    {pred.justificacion_detallada.conclusion}
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---

export const AnalysisReportModal: React.FC<{ analysis: VisualAnalysisResult | null; onClose: () => void }> = ({ analysis, onClose }) => {
    if (!analysis) return null;

    const data = analysis.dashboardData;

    console.log("[DEBUG] Report Data Received:", data);
    if (!data) console.error("[DEBUG] No dashboardData found in analysis object");

    // Fallback por si la IA devolvió texto plano en lugar del JSON (caso raro con Gemini 2.5 Pro y prompt estricto)
    if (!data) {
        return (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-gray-700">
                    <div className="p-6 border-b border-gray-800 flex justify-between">
                        <h2 className="text-xl font-bold text-red-400">Error de Formato Visual</h2>
                        <button onClick={onClose}><XMarkIcon className="w-6 h-6 text-gray-400" /></button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <p className="text-gray-300 mb-4">La IA generó el análisis pero no siguió el formato visual estricto. Aquí está el texto crudo:</p>
                        <pre className="whitespace-pre-wrap text-sm text-gray-400 font-mono bg-gray-800 p-4 rounded">{analysis.analysisText}</pre>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="bg-gray-900 w-full h-full md:h-[95vh] md:max-w-6xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-800">

                {/* Scrollable Container */}
                <div className="flex-grow overflow-y-auto custom-scrollbar">

                    {/* Header */}
                    {data.header_partido && <HeaderSection data={data.header_partido} />}

                    <div className="p-4 md:p-8 space-y-8">

                        {/* 1. Resumen Ejecutivo */}
                        {data.resumen_ejecutivo && <ExecutiveSummary data={data.resumen_ejecutivo} />}

                        {/* 2. Grid de Tablas y Gráficos */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold text-white flex items-center"><ChartBarIcon className="w-5 h-5 mr-2 text-green-accent" /> Datos Clave</h3>
                                {data.tablas_comparativas && Object.values(data.tablas_comparativas).map((tabla, idx) => (
                                    <DynamicTable key={idx} data={tabla} />
                                ))}
                            </div>
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold text-white flex items-center"><TrophyIcon className="w-5 h-5 mr-2 text-blue-400" /> Visualización</h3>
                                {data.graficos_sugeridos && data.graficos_sugeridos.map((grafico, idx) => (
                                    <VisualChart key={idx} data={grafico} />
                                ))}
                            </div>
                        </div>

                        {/* 3. Análisis Detallado (Texto Estructurado) */}
                        {data.analisis_detallado && (
                            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                                <h3 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">Análisis Profundo</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <AnalysisBlock section={data.analisis_detallado.contexto_competitivo} />
                                    <AnalysisBlock section={data.analisis_detallado.estilo_y_tactica} />
                                    <AnalysisBlock section={data.analisis_detallado.alineaciones_y_bajas} />
                                    <AnalysisBlock section={data.analisis_detallado.factores_situacionales} />
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                    <AnalysisBlock section={data.analisis_detallado.escenarios_de_partido} />
                                </div>
                            </div>
                        )}

                        {/* 4. Predicciones Finales (La Carne) */}
                        {data.predicciones_finales && data.predicciones_finales.detalle && (
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                                    <TrophyIcon className="w-8 h-8 text-green-accent mr-3" />
                                    Predicciones del Modelo
                                </h3>
                                {data.predicciones_finales.detalle.map((pred) => (
                                    <PredictionCard key={pred.id} pred={pred} />
                                ))}
                            </div>
                        )}

                        {/* 5. Advertencias */}
                        {data.advertencias && data.advertencias.bullets && data.advertencias.bullets.length > 0 && (
                            <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg flex items-start">
                                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500 mr-3 flex-shrink-0" />
                                <div>
                                    <h4 className="font-bold text-yellow-500 mb-1">{data.advertencias.titulo}</h4>
                                    <ul className="list-disc pl-4 text-yellow-200/80 text-sm">
                                        {data.advertencias.bullets.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Fuentes */}
                        {analysis.sources && analysis.sources.length > 0 && (
                            <div className="pt-6 border-t border-gray-800">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fuentes Verificadas</h4>
                                <div className="flex flex-wrap gap-4">
                                    {analysis.sources.map((source, i) => (
                                        <a key={i} href={source.web?.uri} target="_blank" rel="noopener noreferrer" className="flex items-center text-xs text-blue-500 hover:text-blue-400">
                                            <LinkIcon className="w-3 h-3 mr-1" />
                                            {source.web?.title || 'Fuente Externa'}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Close Button Fixed Footer (Mobile Friendly) */}
                <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        Cerrar Informe
                    </button>
                </div>
            </div>
        </div>
    );
};
