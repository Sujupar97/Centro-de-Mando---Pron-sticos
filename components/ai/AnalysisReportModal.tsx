
import React from 'react';
import { createPortal } from 'react-dom';
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


import { PostMatchAnalysis, MatchOutcome } from '../../types';
import { ArrowDownTrayIcon, ClipboardDocumentCheckIcon } from '../icons/Icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PostMatchSection: React.FC<{ analysis: PostMatchAnalysis | string; outcome?: MatchOutcome; headerData: any }> = ({ analysis, outcome, headerData }) => {
    if (!analysis) return null;

    const handleDownloadFinalPDF = () => {
        const doc = new jsPDF();

        // --- CONSTANTS & HELPERS ---
        const colors = {
            bg: [15, 23, 42], // Slate 900
            cardBg: [30, 41, 59], // Slate 800
            textMain: [255, 255, 255],
            textSec: [148, 163, 184], // Slate 400
            accent: [74, 222, 128], // Green
            accentBlue: [96, 165, 250], // Blue
        };

        const drawPageBackground = () => {
            doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
            doc.rect(0, 0, 210, 297, 'F');
        };

        const drawHeader = (title: string) => {
            doc.setFillColor(20, 30, 50);
            doc.rect(0, 0, 210, 25, 'F');
            doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
            doc.setFontSize(10);
            doc.text("BETCOMMAND INTELLIGENCE", 14, 16);
            doc.setTextColor(colors.textSec[0], colors.textSec[1], colors.textSec[2]);
            doc.text(title, 200, 16, { align: 'right' });
        };

        // --- PAGE 1: COVER ---
        drawPageBackground();

        // Logo / Branding Placeholder
        doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
        doc.setLineWidth(1);
        doc.line(70, 90, 140, 90);

        doc.setFontSize(28);
        doc.setTextColor(colors.textMain[0], colors.textMain[1], colors.textMain[2]);
        doc.text("INFORME FINAL", 105, 80, { align: 'center' });
        doc.text("DE PARTIDO", 105, 105, { align: 'center' });

        doc.setFontSize(16);
        doc.setTextColor(colors.accentBlue[0], colors.accentBlue[1], colors.accentBlue[2]);
        doc.text(headerData.titulo, 105, 130, { align: 'center' });

        if (outcome) {
            doc.setFillColor(colors.cardBg[0], colors.cardBg[1], colors.cardBg[2]);
            doc.roundedRect(65, 145, 80, 25, 3, 3, 'F');

            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text(`${outcome.score?.home ?? 0}  -  ${outcome.score?.away ?? 0}`, 105, 162, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(colors.textSec[0], colors.textSec[1], colors.textSec[2]);
            doc.text(`Ganador: ${outcome.winner}`, 105, 185, { align: 'center' });
        }

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Generado por IA - BetCommand Engine v2.0", 105, 280, { align: 'center' });

        // --- PAGE 2: ANALYSIS CONTENT ---
        doc.addPage();
        drawPageBackground();
        drawHeader("Análisis 360°");

        let y = 40;
        const leftMargin = 14;
        const cardWidth = 182;
        const contentWidth = 172;

        const drawSection = (title: string, text: string, color: number[]) => {
            // Check Page Break
            const splitText = doc.splitTextToSize(text || 'N/A', contentWidth);
            const textHeight = splitText.length * 5; // 5 units per line approx
            const boxHeight = textHeight + 25;

            if (y + boxHeight > 280) {
                doc.addPage();
                drawPageBackground();
                drawHeader("Análisis 360° (Cont.)");
                y = 40;
            }

            // Card Background
            doc.setFillColor(colors.cardBg[0], colors.cardBg[1], colors.cardBg[2]);
            doc.setDrawColor(color[0], color[1], color[2]);
            doc.roundedRect(leftMargin, y, cardWidth, boxHeight, 2, 2, 'FD');

            // Title
            doc.setFontSize(12);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(title.toUpperCase(), leftMargin + 5, y + 10);

            // Content
            doc.setFontSize(10);
            doc.setTextColor(200, 200, 200);
            doc.text(splitText, leftMargin + 5, y + 20);

            y += boxHeight + 10;
        };

        if (typeof analysis === 'string') {
            drawSection("Análisis General", analysis, colors.accentBlue);
        } else {
            drawSection("Análisis Táctico", analysis.tactical_analysis, colors.accent); // Green
            drawSection("Desglose Estadístico", analysis.statistical_breakdown, colors.accentBlue); // Blue
            drawSection("Momentos Clave", analysis.key_moments, [168, 85, 247]); // Purple
            drawSection("Feedback del Sistema", analysis.learning_feedback, [234, 179, 8]); // Yellow
        }

        // --- SECTION: PREDICTION RESULTS (NEW) ---
        // Force new page if low on space
        if (y > 220) {
            doc.addPage();
            drawPageBackground();
            drawHeader("Evaluación de Pronósticos");
            y = 40;
        } else {
            y += 10;
        }

        const predictions = analysis.analysisRun?.predictions || [];
        if (predictions.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(colors.textMain[0], colors.textMain[1], colors.textMain[2]);
            doc.text("RESULTADOS DE PRONÓSTICOS", 14, y);
            y += 15;

            predictions.forEach(pred => {
                // Check Page Break
                if (y > 270) {
                    doc.addPage();
                    drawPageBackground();
                    drawHeader("Evaluación de Pronósticos (Cont.)");
                    y = 40;
                }

                // Determine Status Color & Text
                let statusText = "PENDIENTE";
                let statusColor = [100, 116, 139]; // Gray

                if (pred.is_won === true) {
                    statusText = "ACERTADA";
                    statusColor = colors.accent; // Green
                } else if (pred.is_won === false) {
                    statusText = "FALLADA";
                    statusColor = [239, 68, 68]; // Red
                }

                // Draw Row Box
                doc.setFillColor(colors.cardBg[0], colors.cardBg[1], colors.cardBg[2]);
                doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
                doc.roundedRect(14, y, 182, 20, 2, 2, 'FD');

                // Prediction Text
                doc.setFontSize(11);
                doc.setTextColor(255, 255, 255);
                doc.text(`${pred.market_code} - ${pred.selection}`, 20, y + 13);

                // Probability
                doc.setFontSize(9);
                doc.setTextColor(colors.textSec[0], colors.textSec[1], colors.textSec[2]);
                doc.text(`Prob: ${pred.probability}%`, 130, y + 13);

                // Status Badge
                doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
                doc.roundedRect(160, y + 5, 30, 10, 2, 2, 'F');
                doc.setTextColor(20, 30, 50); // Dark text for contrast
                doc.setFontSize(8);
                doc.text(statusText, 175, y + 11, { align: 'center', baseline: 'middle' });

                y += 25;
            });
        }

        doc.save(`BetCommand_Report_${headerData.titulo.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}.pdf`);
    };

    const isStructured = typeof analysis !== 'string';

    return (
        <div className="bg-gradient-to-br from-blue-900/50 to-slate-900 border border-blue-500/30 p-6 rounded-xl shadow-lg mb-6 animate-pulse-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <ClipboardDocumentCheckIcon className="w-32 h-32 text-blue-400" />
            </div>

            <div className="flex justify-between items-start relative z-10 mb-6">
                <div className="flex items-center">
                    <div className="bg-blue-500/20 p-3 rounded-lg mr-4">
                        <TrophyIcon className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white">Análisis Post-Partido</h3>
                        <p className="text-blue-300 text-sm">Evaluación final y feedback del sistema</p>
                    </div>
                </div>
                <button
                    onClick={handleDownloadFinalPDF}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg hover:shadow-blue-500/20"
                >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    Descargar Informe Final
                </button>
            </div>

            {outcome && (
                <div className="flex items-center justify-center py-6 bg-black/30 rounded-lg mb-6 border border-white/5 relative z-10">
                    <div className="text-center">
                        <span className="block text-gray-400 text-sm uppercase tracking-widest mb-2">Resultado Final</span>
                        <div className="text-5xl font-black text-white tracking-tight flex items-center justify-center gap-4">
                            <span>{outcome.score?.home ?? '-'}</span>
                            <span className="text-gray-600">-</span>
                            <span>{outcome.score?.away ?? '-'}</span>
                        </div>
                        <div className="mt-2 inline-block px-3 py-1 bg-white/10 rounded-full text-sm font-medium text-blue-200">
                            {outcome.winner === 'Home' ? 'Ganador Local' : outcome.winner === 'Away' ? 'Ganador Visitante' : 'Empate'} {outcome.status}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {!isStructured ? (
                    <div className="prose prose-invert prose-sm max-w-none col-span-2">
                        <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{analysis as string}</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700/50">
                            <h4 className="text-green-400 font-bold mb-3 uppercase text-xs tracking-wider">Análisis Táctico</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">{(analysis as PostMatchAnalysis).tactical_analysis}</p>
                        </div>
                        <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700/50">
                            <h4 className="text-blue-400 font-bold mb-3 uppercase text-xs tracking-wider">Desglose Estadístico</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">{(analysis as PostMatchAnalysis).statistical_breakdown}</p>
                        </div>
                        <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700/50">
                            <h4 className="text-purple-400 font-bold mb-3 uppercase text-xs tracking-wider">Momentos Clave</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">{(analysis as PostMatchAnalysis).key_moments}</p>
                        </div>
                        <div className="bg-gray-800/50 p-5 rounded-lg border border-gray-700/50">
                            <h4 className="text-yellow-400 font-bold mb-3 uppercase text-xs tracking-wider">Feedback del Sistema</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">{(analysis as PostMatchAnalysis).learning_feedback}</p>
                        </div>
                        <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-gray-800 to-gray-700 p-5 rounded-lg border border-gray-600">
                            <h4 className="text-white font-bold mb-2">Revisión de Rendimiento</h4>
                            <p className="text-gray-200 italic">"{(analysis as PostMatchAnalysis).performance_review}"</p>
                        </div>
                    </>
                )}
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
            <div className="h-64 w-full min-h-[256px]">
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
            <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 md:p-6 animate-fade-in backdrop-blur-md" onClick={(e) => e.target === e.currentTarget && onClose()}>
                <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col border border-white/10" onClick={(e) => e.stopPropagation()}>
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

    return createPortal(
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-0 md:p-6 animate-fade-in backdrop-blur-md" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-slate-900 w-full h-full md:h-[90vh] md:max-w-6xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10" onClick={(e) => e.stopPropagation()}>

                {/* Scrollable Container */}
                <div className="flex-grow overflow-y-auto custom-scrollbar">

                    {/* Header */}
                    {data.header_partido && <HeaderSection data={data.header_partido} />}

                    <div className="p-4 md:p-8 space-y-8">

                        {/* 0. Post-Match Analysis (Si existe) */}
                        {/* 0. Post-Match Analysis (Si existe) */}
                        <PostMatchSection
                            analysis={analysis.analysisRun?.post_match_analysis as any}
                            outcome={analysis.analysisRun?.actual_outcome as any}
                            headerData={data.header_partido}
                        />

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

                            </div>
                        )}

                        {/* 4. Predicciones Finales (La Carne) */}
                        {data.predicciones_finales && data.predicciones_finales.detalle && (
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                                    <TrophyIcon className="w-8 h-8 text-green-accent mr-3" />
                                    Predicciones del Modelo
                                </h3>
                                {data.predicciones_finales.detalle.map((pred, idx) => (
                                    <PredictionCard key={pred.id || idx} pred={pred} />
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
        </div>,
        document.body
    );
};
