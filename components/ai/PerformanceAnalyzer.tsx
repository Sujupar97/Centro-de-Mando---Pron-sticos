import React, { useState } from 'react';
import { useBets } from '../../hooks/useBets';
import { generatePerformanceReport } from '../../services/geminiService';
import { fetchPerformanceFeedbacks } from '../../services/analysisService';
import { Bet, PerformanceReportResult, ChartDataPoint, BetStatus } from '../../types';
import { BrainIcon, CheckCircleIcon } from '../icons/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, PieLabelRenderProps } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { savePerformanceReport, getSystemPredictions } from '../../services/performanceService';
import { ChartBarIcon, UserIcon, ArrowDownTrayIcon, InformationCircleIcon, ExclamationTriangleIcon } from '../icons/Icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const LoadingState: React.FC = () => (
    <div className="text-center py-10">
        <BrainIcon className="w-12 h-12 mx-auto text-green-accent animate-pulse" />
        <p className="mt-4 text-lg font-semibold text-white">Generando informe de rendimiento...</p>
        <p className="text-sm text-gray-400">La IA está analizando tu historial de apuestas para encontrar patrones y oportunidades.</p>
    </div>
);

const KeyMetricCard: React.FC<{ title: string; value: string | number; className?: string }> = ({ title, value, className }) => (
    <div className={`bg-gray-900/50 p-4 rounded-lg text-center ${className}`}>
        <p className="text-sm text-gray-400">{title}</p>
        <p className={`text-2xl font-bold text-white ${className}`}>{value}</p>
    </div>
);

const ReportDisplay: React.FC<{ report: PerformanceReportResult; dateRange: { start: string, end: string } }> = ({ report, dateRange }) => {
    const COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#1e3a8a', '#3b82f6', '#93c5fd'];

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const colors = { bg: [15, 23, 42], textMain: [255, 255, 255], accent: [16, 185, 129] };

        // Background
        doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
        doc.rect(0, 0, 210, 297, 'F');
        doc.setTextColor(255, 255, 255);

        // Header
        doc.setFontSize(22);
        doc.text("INFORME DE RENDIMIENTO", 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Periodo: ${dateRange.start} - ${dateRange.end}`, 105, 30, { align: 'center' });

        let y = 50;

        // Executive Summary
        doc.setFontSize(14);
        doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
        doc.text("Resumen Ejecutivo", 14, y);
        y += 10;
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        const splitSummary = doc.splitTextToSize(report.executiveSummary, 180);
        doc.text(splitSummary, 14, y);
        y += splitSummary.length * 5 + 10;

        // META-ANALYSIS (System Feedback)
        if (report.learningAnalysis) {
            doc.setFillColor(30, 41, 59); // Card bg
            doc.setDrawColor(99, 102, 241); // Indigo border
            doc.roundedRect(14, y, 182, 40, 3, 3, 'FD');

            doc.setFontSize(12);
            doc.setTextColor(129, 140, 248); // Indigo text
            doc.text("META-ANÁLISIS DE SISTEMA (Feedback IA)", 18, y + 10);

            doc.setFontSize(10);
            doc.setTextColor(200, 200, 200);
            const splitMeta = doc.splitTextToSize(report.learningAnalysis, 170);
            // Adjust box height if text is long
            const metaHeight = splitMeta.length * 5 + 20;
            doc.roundedRect(14, y, 182, metaHeight, 3, 3, 'FD'); // Redraw with correct height
            doc.text(splitMeta, 18, y + 20);

            y += metaHeight + 15;
        }

        // Metrics Table
        autoTable(doc, {
            startY: y,
            head: [['Métrica', 'Valor']],
            body: [
                ['Total Apuestas', report.keyMetrics.totalBets],
                ['Total Apostado', formatCurrency(report.keyMetrics.totalStaked)],
                ['Beneficio/Pérdida', formatCurrency(report.keyMetrics.profitLoss)],
                ['ROI', `${(report.keyMetrics.roi || 0).toFixed(2)}%`],
                ['Tasa de Acierto', `${(report.keyMetrics.winRate || 0).toFixed(1)}%`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] },
            styles: { textColor: [255, 255, 255], fillColor: [30, 41, 59] },
        });

        y = (doc as any).lastAutoTable.finalY + 20;

        // Strengths & Weaknesses
        doc.setFontSize(14);
        doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
        doc.text("Fortalezas y Debilidades", 14, y);
        y += 10;

        doc.setFontSize(10);
        doc.setTextColor(167, 243, 208); // Light Green
        doc.text("Fortalezas:", 14, y);
        y += 5;
        doc.setTextColor(255, 255, 255);
        report.strengths.forEach(s => { doc.text(`• ${s}`, 18, y); y += 5; });

        y += 5;
        doc.setTextColor(252, 165, 165); // Light Red
        doc.text("Debilidades:", 14, y);
        y += 5;
        doc.setTextColor(255, 255, 255);
        report.weaknesses.forEach(w => { doc.text(`• ${w}`, 18, y); y += 5; });

        doc.save(`Performance_Report_${dateRange.end}.pdf`);
    };

    const profitBySportData = (report.chartsData?.profitBySport || []).map(d => ({
        name: d.name || 'Desconocido',
        'Beneficio/Pérdida': d.value || 0,
    }));

    const betsByMarketData = (report.chartsData?.betsByMarket || []).map(d => ({
        name: d.name || 'Otro',
        value: d.value || 0,
    }));

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: PieLabelRenderProps & { index: number }) => {
        if (typeof cx !== 'number' || typeof cy !== 'number' || typeof midAngle !== 'number' || typeof innerRadius !== 'number' || typeof outerRadius !== 'number' || typeof percent !== 'number') {
            return null;
        }
        // No mostrar la etiqueta si el porcentaje es muy pequeño para evitar superposiciones
        if (percent < 0.05 || !betsByMarketData[index]) {
            return null;
        }
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12">
                {`${betsByMarketData[index].name} (${(percent * 100).toFixed(0)}%)`}
            </text>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-start">
                <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 flex-grow mr-4">
                    <h3 className="text-xl font-semibold text-white mb-2">Resumen Ejecutivo</h3>
                    <p className="text-gray-300">{report.executiveSummary}</p>
                </div>
                <button
                    onClick={handleDownloadPDF}
                    className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg border border-gray-600 transition-colors shadow-lg"
                    title="Descargar PDF"
                >
                    <ArrowDownTrayIcon className="w-6 h-6 text-green-accent" />
                </button>
            </div>

            {report.learningAnalysis && (
                <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 p-6 rounded-lg border border-indigo-500/30">
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center">
                        <BrainIcon className="w-6 h-6 mr-2 text-indigo-400" />
                        Meta-Análisis de Aprendizaje (Sistema)
                    </h3>
                    <p className="text-gray-200 italic leading-relaxed">"{report.learningAnalysis}"</p>
                    <div className="mt-2 text-xs text-indigo-300 text-right">Basado en la autopsia de todos los partidos analizados en este periodo.</div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KeyMetricCard title="Apuestas" value={report.keyMetrics.totalBets} />
                <KeyMetricCard title="Total Apostado" value={formatCurrency(report.keyMetrics.totalStaked)} />
                <KeyMetricCard title="Beneficio/Pérdida" value={formatCurrency(report.keyMetrics.profitLoss)} className={report.keyMetrics.profitLoss >= 0 ? 'text-green-accent' : 'text-red-accent'} />
                <KeyMetricCard title="ROI" value={`${(report.keyMetrics.roi || 0).toFixed(2)}%`} className={(report.keyMetrics.roi || 0) >= 0 ? 'text-green-accent' : 'text-red-accent'} />
                <KeyMetricCard title="Tasa de Acierto" value={`${(report.keyMetrics.winRate || 0).toFixed(1)}%`} />
                <KeyMetricCard title="Cuota Promedio" value={(report.keyMetrics.averageOdds || 0).toFixed(2)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Fortalezas Identificadas</h3>
                    <ul className="list-disc list-inside space-y-2 text-green-accent">
                        {(report.strengths || []).map((item, i) => <li key={i}><span className="text-gray-300">{item}</span></li>)}
                    </ul>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Debilidades a Mejorar</h3>
                    <ul className="list-disc list-inside space-y-2 text-red-accent">
                        {(report.weaknesses || []).map((item, i) => <li key={i}><span className="text-gray-300">{item}</span></li>)}
                    </ul>
                </div>
            </div>

            <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Recomendaciones Accionables</h3>
                <ul className="list-decimal list-inside space-y-3 text-gray-300">
                    {(report.actionableRecommendations || []).map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 h-96">
                    <h3 className="text-lg font-semibold text-white mb-4">Beneficio/Pérdida por Deporte</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={profitBySportData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} tickFormatter={(value) => formatCurrency(Number(value))} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #374151' }}
                                labelStyle={{ color: '#d1d5db' }}
                                formatter={(value) => [formatCurrency(Number(value)), 'Beneficio/Pérdida']}
                            />
                            <Bar dataKey="Beneficio/Pérdida" name="Beneficio/Pérdida">
                                {profitBySportData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry['Beneficio/Pérdida'] >= 0 ? '#10b981' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 h-96">
                    <h3 className="text-lg font-semibold text-white mb-4">Distribución de Apuestas por Mercado</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                            <Pie
                                data={betsByMarketData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={renderCustomizedLabel}
                                outerRadius={'80%'}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {betsByMarketData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #374151' }}
                                formatter={(value, name) => [`${value} apuestas`, name]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
};

export const PerformanceAnalyzer: React.FC = () => {
    const { user } = useAuth();
    const { bets } = useBets();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [report, setReport] = useState<PerformanceReportResult | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(thirtyDaysAgo);
    const [endDate, setEndDate] = useState(today);

    // New State for Analysis Source
    const [analysisSource, setAnalysisSource] = useState<'user' | 'system'>('user');

    // State for Min Confidence Filter
    const [minConfidence, setMinConfidence] = useState<number>(0);

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();

        if (analysisSource === 'user' && !user) {
            setError('Debes iniciar sesión para generar un informe personal.');
            return;
        }

        setIsLoading(true);
        setError('');
        setReport(null);
        setSuccessMessage('');

        try {
            let betsToAnalyze: any[] = [];
            const startStr = startDate;
            const endStr = endDate;

            if (analysisSource === 'user') {
                betsToAnalyze = bets.filter(bet => {
                    if (bet.status === BetStatus.Pending) return false;

                    // Fix Date Comparison: Compare Date Strings (YYYY-MM-DD) to include entire days
                    const betDateStr = new Date(bet.date).toISOString().split('T')[0];
                    return betDateStr >= startStr && betDateStr <= endStr;
                });

                // User bets might not have confidence, but if they did (custom field?), we could filter.
                // Currently generic Bet type doesn't have it, so we skip or warn? 
                // We'll leave it as is for user bets unless we find a field.

            } else {
                // Fetch System Predictions
                const systemPreds = await getSystemPredictions(startDate, endDate);
                if (!systemPreds) throw new Error("Error fetching system predictions");

                // Filter by Confidence if set
                const filteredPreds = systemPreds.filter((p: any) => {
                    const conf = p.confidence || (p.probability ? p.probability * 100 : 0);
                    return conf >= minConfidence;
                });

                // Map to Bet format for the AI
                betsToAnalyze = filteredPreds.map((p: any) => ({
                    date: p.result_verified_at || p.created_at || startDate,
                    sport: 'Fútbol',
                    market: p.market_code || p.market || 'Unknown',
                    selection: p.selection,
                    odds: p.probability ? (1 / (p.probability / 100)) : 1.90,
                    stake: 100, // Standard unit
                    status: p.is_won ? 'Ganada' : 'Perdida',
                    payout: p.is_won ? (100 * (p.probability ? (1 / (p.probability / 100)) : 1.90)) : 0
                }));
            }

            if (betsToAnalyze.length === 0) {
                // Instead of error, we can just return and show a message in the UI
                setReport(null);
                setSuccessMessage('');
                setError(`No hay partidos verificados (finalizados) en este rango. Prueba con fechas anteriores o espera a que terminen los partidos de hoy.`);
                return;
            }

            if (betsToAnalyze.length < 5) {
                // Just log warning but proceed, or clearer message
                console.warn("Low data volume for analysis");
            }

            // Fetch Feedbacks if analysing System
            let feedbacks: string[] = [];
            if (analysisSource === 'system') {
                try {
                    feedbacks = await fetchPerformanceFeedbacks(startDate, endDate);
                    console.log(`[Performance] Fetched ${feedbacks.length} feedback logs.`);
                } catch (err) {
                    console.warn("Could not fetch feedbacks:", err);
                }
            }

            const analysisResult = await generatePerformanceReport(betsToAnalyze, feedbacks);
            setReport(analysisResult);

            // Only save user reports to their profile
            if (analysisSource === 'user' && user) {
                await savePerformanceReport(user.id, analysisResult, startDate, endDate);
                setSuccessMessage('Informe guardado en tu perfil.');
            } else {
                setSuccessMessage('Informe de Sistema generado.');
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error desconocido.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-2">Análisis de Rendimiento a Detalle</h3>
            <p className="text-sm text-gray-400 mb-4">
                Selecciona un rango de fechas y filtros para generar un informe detallado.
            </p>
            <div className="flex bg-gray-800 p-1 rounded-lg mb-6 w-fit mx-auto sm:mx-0">
                <button
                    onClick={() => setAnalysisSource('user')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${analysisSource === 'user' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <UserIcon className="w-4 h-4" /> Mis Apuestas
                </button>
                <button
                    onClick={() => setAnalysisSource('system')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${analysisSource === 'system' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <ChartBarIcon className="w-4 h-4" /> Rendimiento del Sistema
                </button>
            </div>

            <form onSubmit={handleAnalyze} className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label htmlFor="start-date" className="block text-xs text-gray-400 mb-1">Desde</label>
                        <input
                            type="date"
                            id="start-date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="end-date" className="block text-xs text-gray-400 mb-1">Hasta</label>
                        <input
                            type="date"
                            id="end-date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>
                </div>

                {analysisSource === 'system' && (
                    <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <label htmlFor="confidence-filter">Confianza Mínima IA</label>
                            <span>{minConfidence}%</span>
                        </div>
                        <input
                            type="range"
                            id="confidence-filter"
                            min="0"
                            max="90"
                            step="5"
                            value={minConfidence}
                            onChange={(e) => setMinConfidence(Number(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                            <span>0% (Todas)</span>
                            <span>50%</span>
                            <span>90% (Solo Alta Confianza)</span>
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto bg-green-accent hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-md transition duration-300 disabled:bg-gray-600 shadow-md"
                >
                    {isLoading ? 'Analizando...' : 'Generar Informe de Rendimiento'}
                </button>
            </form>

            <div className="flex-grow bg-gray-900 rounded-lg p-4 sm:p-6 overflow-y-auto">
                {error && (
                    <div className={`${error.includes('No hay partidos') ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-accent'} p-3 rounded-md text-center mb-4 flex items-center justify-center gap-2`}>
                        {error.includes('No hay partidos') ? <InformationCircleIcon className="w-5 h-5" /> : <ExclamationTriangleIcon className="w-5 h-5" />}
                        {error}
                    </div>
                )}
                {successMessage && <div className="bg-green-500/20 text-green-accent p-3 rounded-md text-center mb-4 flex items-center justify-center gap-2"><CheckCircleIcon className="w-5 h-5" />{successMessage}</div>}
                {isLoading && <LoadingState />}
                {report && <ReportDisplay report={report} dateRange={{ start: startDate, end: endDate }} />}
                {!isLoading && !report && !error && (
                    <div className="text-center py-10 text-gray-500">
                        <p>El informe de rendimiento aparecerá aquí.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
