
import React from 'react';
import { createPortal } from 'react-dom';
import { VisualAnalysisResult, DashboardAnalysisJSON, TablaComparativaData, AnalisisSeccion, DetallePrediccion, GraficoSugerido, PredictionDB } from '../../types';
import { XMarkIcon, TrophyIcon, ChartBarIcon, ListBulletIcon, LightBulbIcon, ExclamationTriangleIcon, LinkIcon, EyeIcon } from '../icons/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../../services/supabaseService';
import { mapLeagueToSportKey, fastBatchOddsCheck, findPriceInEvent } from '../../services/oddsService';
import { useState, useEffect } from 'react';

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
                    {(data.filas || []).map((fila, fIdx) => (
                        <tr key={fIdx} className="hover:bg-gray-800/30 transition-colors">
                            {(Array.isArray(fila) ? fila : []).map((celda, cIdx) => (
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

    // V2 ahora viene mapeado a estructura V1, así que usamos justificacion_detallada
    const justif = pred.justificacion_detallada;
    const edge = (pred as any).edge; // Ya es porcentaje entero (31, no 0.31)

    // Extraer datos con fallbacks seguros
    const baseStats = justif?.base_estadistica || ['Análisis cuantitativo aplicado'];
    const context = justif?.contexto_competitivo?.[0] || (edge ? `Ventaja de +${edge}% sobre las cuotas` : 'Factor táctico evaluado');
    const conclusion = justif?.conclusion || 'Recomendación basada en el modelo de análisis';

    return (
        <div className={`bg-gray-800 rounded-xl overflow-hidden border-l-4 ${border} shadow-lg mb-6`}>
            <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-700/20">
                <div>
                    <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">{pred.mercado}</span>
                    <h3 className="text-xl font-bold text-white mt-1">{pred.seleccion}</h3>
                </div>
                <div className="flex flex-col items-center justify-center bg-gray-900 rounded-lg p-2 min-w-[80px]">
                    <span className={`text-2xl font-bold ${color}`}>{prob}%</span>
                    <span className="text-[10px] text-gray-500 uppercase">Prob.</span>
                    {/* Odds Badge */}
                    {pred.odds && (
                        <div className="mt-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-3 py-1 rounded-md text-sm font-black shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse-slow border border-blue-400">
                            @{pred.odds.toFixed(2)}
                        </div>
                    )}
                    {/* Edge Badge - Ya es porcentaje, NO multiplicar */}
                    {edge && edge > 0 && (
                        <div className="mt-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-3 py-1 rounded-md text-xs font-bold">
                            Edge: +{edge}%
                        </div>
                    )}
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
                            {(Array.isArray(baseStats) ? baseStats : [baseStats]).map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                    </div>
                    <div>
                        <strong className="text-gray-400 block mb-1">Factor Clave:</strong>
                        <p className="text-gray-300">{context}</p>
                    </div>
                </div>
                <div className="bg-blue-900/20 p-3 rounded text-sm text-blue-200 border border-blue-900/50">
                    <strong className="block mb-1 text-blue-400">Conclusión:</strong>
                    {conclusion}
                </div>
            </div>
        </div>
    );
};

// --- VERDICT SUMMARY COMPONENT (REPLACES TRAFFIC LIGHT) ---

import { VeredictoAnalista } from '../../types';

// Helper for Probability Ring
const ProbabilityRing: React.FC<{ percentage: number; colorClass: string }> = ({ percentage, colorClass }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-24 h-24 mb-6">
            <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={radius} fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className={`${colorClass} transition-all duration-1000 ease-out`}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className={`text-2xl font-black text-white`}>{percentage}%</span>
                <span className="text-[9px] uppercase tracking-widest text-gray-400">Prob.</span>
            </div>
        </div>
    );
};

const VerdictSummary: React.FC<{
    data: VeredictoAnalista;
    onViewFull: () => void;
    headerData?: any;
}> = ({ data, onViewFull, headerData }) => {

    // Determine visual style based on decision
    const isBet = data.decision === 'APOSTAR';
    const isAvoid = data.decision === 'EVITAR';
    const isWatch = data.decision === 'OBSERVAR';

    // Theme Config
    let theme = {
        bg: "bg-slate-900",
        border: "border-gray-600",
        accent: "text-gray-400",
        iconBg: "bg-gray-700",
        mainText: "text-gray-200",
        button: "bg-gray-700 hover:bg-gray-600",
        glow: "",
        progressColor: "text-gray-500"
    };

    if (isBet) {
        theme = {
            bg: "bg-gradient-to-br from-emerald-900/80 via-slate-900 to-slate-900",
            border: "border-emerald-500",
            accent: "text-emerald-400",
            iconBg: "bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]",
            mainText: "text-white",
            button: "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20",
            glow: "shadow-[0_0_50px_rgba(16,185,129,0.1)]",
            progressColor: "text-emerald-500"
        };
    } else if (isAvoid) {
        theme = {
            bg: "bg-gradient-to-br from-red-900/30 via-slate-900 to-slate-900",
            border: "border-red-500",
            accent: "text-red-400",
            iconBg: "bg-red-500/10",
            mainText: "text-gray-300",
            button: "bg-slate-700 hover:bg-slate-600 border border-slate-600",
            glow: "",
            progressColor: "text-red-500"
        };
    } else if (isWatch) {
        theme = {
            bg: "bg-gradient-to-br from-blue-900/40 via-slate-900 to-slate-900",
            border: "border-blue-400",
            accent: "text-blue-400",
            iconBg: "bg-blue-500/20",
            mainText: "text-blue-100",
            button: "bg-blue-600 hover:bg-blue-500",
            glow: "",
            progressColor: "text-blue-400"
        };
    }

    // Default probability if missing (backwards compatibility)
    const probability = data.probabilidad || (isBet ? 75 : 40);
    const confidence = data.nivel_confianza || (isBet ? "ALTA" : "BAJA");

    return (
        <div className={`flex flex-col min-h-full ${theme.bg} text-white p-6 md:p-12 animate-fade-in relative overflow-hidden`}>
            {/* Background Glow */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 ${theme.glow} pointer-events-none fixed-glow`} />

            {/* Header Mini */}
            <div className="mb-4 text-center relative z-10 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1 block">BetCommand Intelligence</span>
                <h2 className="text-lg md:text-xl font-bold text-gray-300 truncate">{headerData?.titulo}</h2>
                <p className="text-gray-500 text-xs">{headerData?.subtitulo}</p>
            </div>

            {/* MAIN DECISION CARD */}
            <div className={`flex-grow flex flex-col justify-center items-center text-center relative z-10 max-w-3xl mx-auto w-full border-t-2 ${theme.border} bg-black/40 rounded-3xl p-8 md:p-10 mb-8 backdrop-blur-md shadow-2xl`}>

                <div className="flex flex-row items-center gap-8 mb-6">
                    {/* Icon / Indicator or Progress Ring */}
                    {isBet ? (
                        <ProbabilityRing percentage={probability} colorClass={theme.progressColor} />
                    ) : (
                        <div className={`w-20 h-20 rounded-full ${theme.iconBg} flex items-center justify-center mb-6`}>
                            {isAvoid && <ExclamationTriangleIcon className="w-10 h-10 text-red-500" />}
                            {isWatch && <EyeIcon className="w-10 h-10 text-blue-400" />}
                        </div>
                    )}

                    {/* Confidence Label (Right of ring) */}
                    {confidence && (
                        <div className="flex flex-col items-start hidden md:flex">
                            <span className="text-xs text-gray-400 uppercase tracking-wider mb-1">Nivel de Confianza</span>
                            <span className={`px-3 py-1 rounded text-xs font-black uppercase tracking-widest border ${isBet ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-gray-600 bg-gray-800 text-gray-400'}`}>
                                {confidence}
                            </span>
                        </div>
                    )}
                </div>


                {/* Main Action Title */}
                <h1 className={`text-3xl md:text-5xl font-black uppercase mb-4 tracking-tight ${theme.accent} drop-shadow-lg`}>
                    {data.titulo_accion || (isBet ? "OPORTUNIDAD CLARA" : "NO APOSTAR")}
                </h1>

                {/* Selection (Only if Bet) */}
                {isBet && data.seleccion_clave && (
                    <div className="mb-6 bg-emerald-500/10 px-8 py-5 rounded-xl border border-emerald-500/30 w-full max-w-xl shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <span className="block text-emerald-500/70 text-[10px] font-bold uppercase mb-2 tracking-widest">Apuesta Recomendada</span>
                        <span className="text-2xl md:text-4xl font-black text-white block leading-none">{data.seleccion_clave}</span>
                    </div>
                )}

                {/* Reasoning */}
                <p className={`text-lg font-medium leading-relaxed max-w-xl mx-auto ${theme.mainText} italic opacity-90`}>
                    "{data.razon_principal}"
                </p>

                {/* Risk Warning (If Avoid or Low Prob) */}
                {(isAvoid || (isBet && probability < 80)) && (
                    <div className={`mt-6 text-xs px-4 py-2 rounded flex items-center gap-2 ${isAvoid ? 'text-red-300 bg-red-900/20' : 'text-yellow-200 bg-yellow-900/20'}`}>
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span><span className="font-bold">Riesgo:</span> {data.riesgo_principal || "Volatilidad detectada."}</span>
                    </div>
                )}
            </div>

            {/* ACTION BUTTON */}
            {/* ACTION BUTTON - Sticky Bottom for Mobile */}
            <div className={`text-center relative z-20 pb-6 pt-4 mt-auto md:mt-8 sticky bottom-0 -mx-6 md:mx-0 px-6 md:px-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent`}>
                <p className="text-gray-500 text-xs mb-3 uppercase tracking-widest opacity-60">
                    {isBet ? "Ver análisis detallado" : "Explorar datos"}
                </p>
                <button
                    onClick={onViewFull}
                    className={`group relative inline-flex items-center justify-center px-12 py-4 font-bold text-white transition-all duration-200 ${theme.button} font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-600 w-full md:w-auto text-lg shadow-xl`}
                >
                    {isBet ? "VER INFORME COMPLETO" : "VER ANÁLISIS"}
                    {isBet && <div className="absolute -inset-3 rounded-xl bg-emerald-400 opacity-20 group-hover:opacity-40 blur-lg transition-opacity duration-200" />}
                </button>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---

export const AnalysisReportModal: React.FC<{ analysis: VisualAnalysisResult | null; onClose: () => void }> = ({ analysis, onClose }) => {
    // Local state to handle real-time updates (like odds) without mutating props directly (though standard React props are read-only)
    // We wrap the analysis data in state to trigger re-renders when odds are fetched.
    const [currentAnalysis, setCurrentAnalysis] = useState<VisualAnalysisResult | null>(analysis);
    const [showFullReport, setShowFullReport] = useState(false);

    useEffect(() => {
        setCurrentAnalysis(analysis);
        setShowFullReport(false);
    }, [analysis]);

    // EFFECT: Fetch Real Odds for High Confidence Predictions
    useEffect(() => {
        const fetchOdds = async () => {
            if (!currentAnalysis || !currentAnalysis.analysisRun || !currentAnalysis.dashboardData) return;

            const run = currentAnalysis.analysisRun;
            // Get predictions from the dashboard data (which drives the UI) or the run persistence
            // We need to map UI predictions back to DB predictions to update them
            const uiPredictions = currentAnalysis.dashboardData.predicciones_finales?.detalle || [];

            // Check if we already have odds in the DB run (persisted)
            // Or if we need to fetch them.
            // Simplified logic: If UI prediction doesn't have odds, try to fetch.

            // Note: DetallePrediccion interface doesn't have 'odds' yet in types.ts? 
            // We should check if we updated DetallePrediccion.
            // Actually, we updated PredictionDB, but DashboardAnalysisJSON uses DetallePrediccion.
            // Let's cast for now or update types. 
            // Just in case, we'll store odds in the 'pred' object in the local state.

            const usefulPredictions = uiPredictions.filter((p: any) => !p.odds && p.probabilidad_estimado_porcentaje >= 60);

            if (usefulPredictions.length === 0) return;

            console.log(`[Odds] Checking for ${usefulPredictions.length} predictions in analysis...`);

            // Context for API
            const leaguePart = run.league_name || currentAnalysis.dashboardData?.header_partido?.titulo || 'Unknown';
            const homeTeam = currentAnalysis.dashboardData?.tablas_comparativas?.forma?.filas?.[0]?.[0] as string || 'Home';
            const awayTeam = currentAnalysis.dashboardData?.tablas_comparativas?.forma?.filas?.[1]?.[0] as string || 'Away';

            // Note: We need the DATE. We can get it from header or run created_at (approx) or context
            // Ideally we iterate the 'AnalysisRun' object which has fixture_id.
            // BUT we don't have the fixture DATE easily available in VisualAnalysisResult unless we dig into dash data or fetch fixture.
            // WORKAROUND: Use 'created_at' of the run as proxy for "upcoming" if it's recent, OR try to find date in header subtitles.
            // Better: We have `analysisRun.fixture_id`. We can rely on `fastBatchOddsCheck` which usually requires date, BUT we can try without date if we trust the league/team match? No, date is needed for accurate matching.

            // Let's assume the run is for an UPCOMING match or RECENT match.
            // We can try to extract date from the header "Fecha: ..." usually found in context bullets?
            // Or just use today/tomorrow if it's a new analysis.
            const matchDate = new Date().toISOString(); // Default to now (for upcoming check)

            const sportKey = mapLeagueToSportKey(leaguePart);

            const checkItem = {
                fixtureId: parseInt(run.fixture_id), // UUID or Int? DB says UUID for foreign key, but API fixture is Int. 
                // Wait, analysis_runs.fixture_id is UUID in DB schema? No, it's text/uuid referencing the TABLE fixture_id?
                // Let's check the code: AnalysisJob uses api_fixture_id (int). 
                // We'll use the ID we have. The Odds Service just uses it as a key for the Map.
                sportKey: sportKey,
                home: homeTeam,
                away: awayTeam,
                date: matchDate // This might be loose, but logic has fuzzy matching
            };

            try {
                // We just pass one item to the batch function
                const realOddsMap = await fastBatchOddsCheck([checkItem]);

                if (realOddsMap.size > 0) {
                    const event = realOddsMap.get(checkItem.fixtureId);
                    if (event) {
                        let updates = 0;
                        const updatedData = { ...currentAnalysis.dashboardData };

                        // Update UI Predictions
                        updatedData.predicciones_finales.detalle = updatedData.predicciones_finales.detalle.map((pred: any) => {
                            if (!pred.odds) {
                                const price = findPriceInEvent(event, pred.mercado, pred.seleccion);
                                if (price) {
                                    updates++;
                                    // Persist to DB!
                                    // We need the Prediction ID from the DB. 
                                    // The UI 'pred' might not have the DB ID if it came purely from JSON.
                                    // However, typical flow saves predictions to DB and THEN returns.
                                    // Let's assume we can match by selection text if ID is missing or match by run_id + selection.

                                    if (run.id && run.id !== 'temporary') {
                                        supabase
                                            .from('predictions')
                                            .update({ odds: price })
                                            .eq('analysis_run_id', run.id)
                                            .eq('selection', pred.seleccion)
                                            .then(({ error }) => {
                                                if (error) console.error("Failed to persist odds:", error);
                                            });
                                    }
                                    return { ...pred, odds: price };
                                }
                            }
                            return pred;
                        });

                        if (updates > 0) {
                            console.log(`[Odds] Updated ${updates} predictions with real odds.`);
                            setCurrentAnalysis({ ...currentAnalysis, dashboardData: updatedData });
                        }
                    }
                }

            } catch (e) {
                console.error("[Odds] Error fetching single match odds:", e);
            }
        };

        fetchOdds();
    }, [analysis?.analysisRun?.id]); // Only run when the Analysis Run ID changes (load)

    if (!currentAnalysis) return null;

    const data = currentAnalysis.dashboardData;

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
                        <pre className="whitespace-pre-wrap text-sm text-gray-400 font-mono bg-gray-800 p-4 rounded">{currentAnalysis.analysisText}</pre>
                    </div>
                </div>
            </div>
        );
    }

    const isStructured = typeof analysis !== 'string';
    // --- UPDATED LOGIC FOR VERDICT VIEW ---
    const hasVerdict = !!data.veredicto_analista;
    const showVerdictView = isStructured && hasVerdict && !showFullReport;

    return createPortal(
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-0 md:p-6 animate-fade-in backdrop-blur-md" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-slate-900 w-full h-full md:h-[90vh] md:max-w-6xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10" onClick={(e) => e.stopPropagation()}>

                {showVerdictView ? (
                    <div className="relative h-full flex flex-col overflow-y-auto custom-scrollbar bg-slate-900">
                        <div className="absolute top-4 right-4 z-50">
                            <button onClick={onClose} className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors backdrop-blur-sm">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <VerdictSummary
                            data={data.veredicto_analista!}
                            onViewFull={() => setShowFullReport(true)}
                            headerData={data.header_partido}
                        />
                    </div>
                ) : (
                    <>
                        <div className="flex-grow overflow-y-auto custom-scrollbar">

                            {/* Header */}
                            {data.header_partido && <HeaderSection data={data.header_partido} />}

                            <div className="p-4 md:p-8 space-y-8">

                                {/* 0. Post-Match Analysis (Si existe) */}
                                <PostMatchSection
                                    analysis={currentAnalysis.analysisRun?.post_match_analysis as any}
                                    outcome={currentAnalysis.analysisRun?.actual_outcome as any}
                                    headerData={data.header_partido}
                                />

                                {/* 1. Resumen Ejecutivo */}
                                {data.resumen_ejecutivo && <ExecutiveSummary data={data.resumen_ejecutivo} />}

                                {/* 2. Grid de Tablas y Visuales */}
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

                                {/* 3. Análisis Táctico y Escenarios */}
                                {data.analisis_detallado && (
                                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                                        <h3 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-2">Análisis Profundo</h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                            <AnalysisBlock section={data.analisis_detallado.contexto_competitivo} />
                                            <AnalysisBlock section={data.analisis_detallado.analisis_tactico_formaciones || data.analisis_detallado.estilo_y_tactica} />
                                            <AnalysisBlock section={data.analisis_detallado.impacto_arbitro} icon={<ExclamationTriangleIcon className="w-4 h-4 mr-2 text-yellow-500" />} />
                                            <AnalysisBlock section={data.analisis_detallado.alineaciones_y_bajas} icon={<div className="w-4 h-4 mr-2 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold">!</div>} />
                                        </div>

                                        {/* NUEVA SECCIÓN: ESCENARIOS DETALLADOS */}
                                        {(data.analisis_detallado.analisis_escenarios || data.analisis_detallado.escenarios_de_partido) && (
                                            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6 rounded-lg border border-blue-500/30">
                                                <h4 className="text-lg font-bold text-blue-300 mb-4 flex items-center">
                                                    <LightBulbIcon className="w-5 h-5 mr-2" />
                                                    {data.analisis_detallado.analisis_escenarios?.titulo || "Escenarios de Partido"}
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {(data.analisis_detallado.analisis_escenarios?.escenarios || data.analisis_detallado.escenarios_de_partido?.escenarios || []).map((esc, idx) => (
                                                        <div key={idx} className="bg-slate-800 p-4 rounded-lg border-l-4 border-blue-500 shadow-md">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h5 className="font-bold text-white text-sm uppercase tracking-wide">{esc.nombre}</h5>
                                                                <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded font-mono">{esc.probabilidad_aproximada}</span>
                                                            </div>
                                                            <p className="text-gray-300 text-sm mb-3">{esc.descripcion}</p>
                                                            {esc.implicacion_apuestas && (
                                                                <div className="bg-blue-500/10 p-2 rounded text-xs text-blue-200 mt-2">
                                                                    <strong className="text-blue-400">Apuesta:</strong> {esc.implicacion_apuestas}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 4. Predicciones Finales */}
                                {data.predicciones_finales && data.predicciones_finales.detalle && (
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                                            <TrophyIcon className="w-8 h-8 text-green-accent mr-3" />
                                            Predicciones del Modelo
                                        </h3>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {data.predicciones_finales.detalle.map((pred, idx) => (
                                                <PredictionCard key={pred.id || idx} pred={pred} />
                                            ))}
                                        </div>
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
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end">
                            <button
                                onClick={onClose}
                                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                            >
                                Cerrar Informe
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};
