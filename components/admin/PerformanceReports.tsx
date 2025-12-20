
import React, { useState } from 'react';
import { fetchPerformanceStats, PerformanceStats } from '../../services/analysisService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChartBarIcon, DocumentArrowDownIcon, CalendarDaysIcon, TrophyIcon, XCircleIcon, CheckBadgeIcon, SignalIcon } from '../icons/Icons';

export const PerformanceReports: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [stats, setStats] = useState<PerformanceStats | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAnalyze = async () => {
        if (!startDate || !endDate) return alert("Selecciona un rango de fechas.");
        setLoading(true);
        try {
            // Fix: Set End Date to end of day to include all records from that day
            const startStr = new Date(startDate);
            const endStr = new Date(endDate);
            endStr.setHours(23, 59, 59, 999);

            const data = await fetchPerformanceStats(startStr, endStr);
            setStats(data);
        } catch (error) {
            console.error(error);
            alert("Error al generar el reporte.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!stats) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPos = 20;

        const checkPageBreak = (heightNeeded: number) => {
            if (yPos + heightNeeded > pageHeight - 20) {
                doc.addPage();
                yPos = 20;
            }
        };

        // --- LUXURY COVER PAGE ---
        // 1. Background (Dark Slate)
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // 2. Geometric Accents (Tech/AI vibe)
        doc.setDrawColor(34, 197, 94); // Green 500
        doc.setLineWidth(1);
        doc.line(20, 20, 20, 60); // Top left vertical line

        doc.setFillColor(22, 163, 74); // Green 600
        doc.circle(pageWidth - 40, 40, 20, 'F'); // Top right decorative circle
        doc.setFillColor(15, 23, 42); // Overlay to make it distinct
        doc.circle(pageWidth - 40, 40, 10, 'F');

        // 3. Brand Identity
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(32);
        doc.text("BetCommand", 30, 40);

        doc.setTextColor(34, 197, 94);
        doc.setFontSize(32);
        doc.text(".", 103, 40); // Green dot accent

        // 4. Report Title (Centered, Elegant)
        const centerX = pageWidth / 2;
        const centerY = pageHeight / 2;

        doc.setTextColor(200, 200, 200);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setCharSpace(3); // Spacing for "Luxury" feel
        doc.text("INFORME OFICIAL", centerX, centerY - 30, { align: 'center' });

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(40);
        doc.setFont('helvetica', 'bold');
        doc.setCharSpace(0);
        doc.text("RENDIMIENTO AI", centerX, centerY, { align: 'center' });

        doc.setTextColor(34, 197, 94); // Green Accent Title
        doc.setFontSize(18);
        doc.text("AUDITORÍA & EFICIENCIA", centerX, centerY + 15, { align: 'center' });

        // 5. Date & Range (Bottom)
        doc.setDrawColor(100, 100, 100);
        doc.line(centerX - 50, centerY + 50, centerX + 50, centerY + 50); // Separator

        doc.setTextColor(150, 150, 150);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`${startDate}  —  ${endDate}`, centerX, centerY + 65, { align: 'center' });

        doc.setFontSize(10);
        doc.text("Generado automáticamente por el Sistema", centerX, pageHeight - 30, { align: 'center' });

        // --- NEW PAGE FOR CONTENT ---
        doc.addPage();
        yPos = 20; // Type safe reset

        // --- INTERNAL HEADER (Smaller version for inner pages) ---
        doc.setFillColor(245, 245, 245); // Light Gray Background header
        doc.rect(0, 0, pageWidth, 30, 'F');

        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text("BetCommand Analytics", 14, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Reporte: ${startDate} / ${endDate}`, pageWidth - 14, 20, { align: 'right' });

        yPos = 50;

        // --- EXECUTIVE SUMMARY ---
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("1. Resumen Ejecutivo de Métricas Globales", 14, yPos);
        yPos += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        const summaryText = `Durante el período seleccionado, el sistema procesó un total de ${stats.total} predicciones. ` +
            `Se alcanzó una tasa de acierto global del ${stats.winRate.toFixed(1)}%, identificando ${stats.wins} oportunidades ganadoras. ` +
            `Este informe detalla el comportamiento de la IA segmentado por confianza y probabilidad para optimizar la toma de decisiones.`;
        doc.text(doc.splitTextToSize(summaryText, pageWidth - 28), 14, yPos);
        yPos += 25;

        // KPI CARDS ROW
        const kpiWidth = (pageWidth - 34) / 4;
        const kpiHeight = 25;
        const metrics = [
            { label: "TOTAL", value: stats.total.toString(), color: [60, 60, 60] },
            { label: "% ACIERTO", value: stats.winRate.toFixed(1) + "%", color: stats.winRate >= 60 ? [22, 163, 74] : [220, 38, 38] },
            { label: "GANADAS", value: stats.wins.toString(), color: [22, 163, 74] },
            { label: "PERDIDAS", value: stats.losses.toString(), color: [220, 38, 38] }
        ];

        metrics.forEach((m, i) => {
            const x = 14 + (i * (kpiWidth + 2));
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(x, yPos, kpiWidth, kpiHeight, 2, 2, 'FD');

            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(m.label, x + (kpiWidth / 2), yPos + 8, { align: 'center' });

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(m.color[0], m.color[1], m.color[2]);
            doc.text(m.value, x + (kpiWidth / 2), yPos + 18, { align: 'center' });
        });
        yPos += kpiHeight + 20;

        // --- CONFIDENCE ANALYSIS ---
        checkPageBreak(80);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.text("2. Análisis por Nivel de Confianza", 14, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text("Desglose de eficiencia según la clasificación de confianza del modelo (Alta, Media, Baja).", 14, yPos);
        yPos += 8;

        const confData = [
            ['Nivel', 'Predicciones', 'Ganadas', '% Eficiencia', 'Impacto'],
            ['ALTA (+80%)', stats.byConfidence.HIGH.total, stats.byConfidence.HIGH.wins, stats.byConfidence.HIGH.winRate.toFixed(1) + "%", "Crítico"],
            ['MEDIA (60-79%)', stats.byConfidence.MEDIUM.total, stats.byConfidence.MEDIUM.wins, stats.byConfidence.MEDIUM.winRate.toFixed(1) + "%", "Volumen"],
            ['BAJA (<60%)', stats.byConfidence.LOW.total, stats.byConfidence.LOW.wins, stats.byConfidence.LOW.winRate.toFixed(1) + "%", "Riesgo"]
        ];

        autoTable(doc, {
            startY: yPos,
            head: [confData[0]],
            body: confData.slice(1),
            theme: 'striped',
            headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 4 },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 3) {
                    const val = parseFloat(data.cell.raw as string);
                    if (val >= 70) data.cell.styles.textColor = [22, 163, 74]; // Green
                    else if (val < 50) data.cell.styles.textColor = [220, 38, 38]; // Red
                }
            }
        });
        yPos = (doc as any).lastAutoTable.finalY + 20;

        // --- PROBABILITY CURVE ---
        checkPageBreak(80);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.text("3. Curva de Probabilidad Real vs Esperada", 14, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text("Comparativa entre la probabilidad calculada por la IA y el resultado real obtenido.", 14, yPos);
        yPos += 8;

        const probRows = Object.entries(stats.byProbability)
            .sort((a, b) => b[0].localeCompare(a[0])) // Sort desc ie 90-100 first
            .map(([bucket, s]: [string, any]) => [
                bucket,
                s.total,
                s.wins,
                s.winRate.toFixed(1) + "%",
                s.winRate >= parseInt(bucket.split('-')[0]) ? "✅ Sobre-rendimiento" : "⚠️ Bajo rendimiento"
            ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Rango Probabilidad', 'Total', 'Aciertos', '% Real', 'Estado']],
            body: probRows,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 }, // Indigo header
            styles: { fontSize: 9 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 20;

        // --- MARKET BREAKDOWN ---
        checkPageBreak(100);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.text("4. Desglose Detallado por Mercado", 14, yPos);
        yPos += 10;

        const marketRows = Object.entries(stats.byMarket)
            .sort((a, b) => (b[1] as any).total - (a[1] as any).total) // Sort by volume
            .map(([market, s]: [string, any]) => [
                market,
                s.total,
                s.wins,
                (s.total - s.wins),
                s.winRate.toFixed(1) + "%"
            ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Mercado', 'Total', 'Ganadas', 'Perdidas', '% Acierto']],
            body: marketRows,
            headStyles: { fillColor: [60, 60, 60] },
        });
        yPos = (doc as any).lastAutoTable.finalY + 20;

        // --- LEAGUE BREAKDOWN ---
        checkPageBreak(100);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.text("5. Desglose por Competición (Ligas)", 14, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text("Análisis de rendimiento específico por liga o torneo.", 14, yPos);
        yPos += 8;

        const leagueRows = Object.entries(stats.byLeague || {})
            .sort((a, b) => (b[1] as any).total - (a[1] as any).total)
            .map(([league, s]: [string, any]) => [
                league,
                s.total,
                s.wins,
                (s.total - s.wins),
                s.winRate.toFixed(1) + "%"
            ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Competición', 'Total', 'Ganadas', 'Perdidas', '% Acierto']],
            body: leagueRows,
            headStyles: { fillColor: [15, 23, 42] }, // Dark Slate
            alternateRowStyles: { fillColor: [241, 245, 249] },
        });

        // --- FOOTER ---
        const pageCount = (doc.internal as any).getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('Generado por BetCommand AI Analytics - Reporte Confidencial', 14, doc.internal.pageSize.getHeight() - 10);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10);
        }

        doc.save(`BetCommand_Analisis_Resultados_${startDate}_${endDate}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">Desde</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-900 border border-gray-600 text-white rounded p-2 text-sm w-40" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">Hasta</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-900 border border-gray-600 text-white rounded p-2 text-sm w-40" />
                    </div>
                    <button onClick={handleAnalyze} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg flex items-center transition-colors disabled:opacity-50">
                        {loading ? <span className="animate-spin mr-2">⟳</span> : <ChartBarIcon className="w-5 h-5 mr-2" />}
                        Analizar Rendimiento
                    </button>
                    {stats && (
                        <button onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg flex items-center transition-colors ml-auto">
                            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                            Descargar PDF
                        </button>
                    )}
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <p className="text-gray-400 text-xs uppercase font-bold">Total Predicciones</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <p className="text-gray-400 text-xs uppercase font-bold">Tasa de Acierto</p>
                        <p className={`text-3xl font-bold mt-1 ${stats.winRate >= 60 ? 'text-green-500' : 'text-yellow-500'}`}>{stats.winRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <p className="text-gray-400 text-xs uppercase font-bold">Ganadas</p>
                        <p className="text-3xl font-bold text-green-500 mt-1 flex items-center"><TrophyIcon className="w-6 h-6 mr-2" /> {stats.wins}</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <p className="text-gray-400 text-xs uppercase font-bold">Perdidas</p>
                        <p className="text-3xl font-bold text-red-500 mt-1 flex items-center"><XCircleIcon className="w-6 h-6 mr-2" /> {stats.losses}</p>
                    </div>

                    {/* New Confidence Section */}
                    {stats.byConfidence && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center">
                                <span className="text-green-400 font-bold mb-1 flex items-center"><CheckBadgeIcon className="w-4 h-4 mr-1" /> Confianza ALTA</span>
                                <span className="text-2xl font-bold text-white">{stats.byConfidence.HIGH.winRate.toFixed(1)}%</span>
                                <span className="text-xs text-gray-400">{stats.byConfidence.HIGH.wins}/{stats.byConfidence.HIGH.total} aciertos</span>
                            </div>
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center">
                                <span className="text-yellow-400 font-bold mb-1 flex items-center"><SignalIcon className="w-4 h-4 mr-1" /> Confianza MEDIA</span>
                                <span className="text-2xl font-bold text-white">{stats.byConfidence.MEDIUM.winRate.toFixed(1)}%</span>
                                <span className="text-xs text-gray-400">{stats.byConfidence.MEDIUM.wins}/{stats.byConfidence.MEDIUM.total} aciertos</span>
                            </div>
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center">
                                <span className="text-gray-400 font-bold mb-1">Confianza BAJA</span>
                                <span className="text-2xl font-bold text-white">{stats.byConfidence.LOW.winRate.toFixed(1)}%</span>
                                <span className="text-xs text-gray-500">{stats.byConfidence.LOW.wins}/{stats.byConfidence.LOW.total} aciertos</span>
                            </div>
                        </div>
                    )}

                    {/* Market Breakdown */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gray-800 p-6 rounded-xl border border-gray-700 mt-4">
                        <h3 className="text-lg font-bold text-white mb-4">Desglose por Mercado</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-400">
                                <thead className="bg-gray-900 text-gray-200 uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-3">Mercado</th>
                                        <th className="px-6 py-3">Total</th>
                                        <th className="px-6 py-3">Ganadas</th>
                                        <th className="px-6 py-3">Perdidas</th>
                                        <th className="px-6 py-3">% Acierto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {Object.entries(stats.byMarket).map(([market, s]: [string, any]) => (
                                        <tr key={market} className="hover:bg-gray-750">
                                            <td className="px-6 py-3 font-medium text-white">{market}</td>
                                            <td className="px-6 py-3">{s.total}</td>
                                            <td className="px-6 py-3 text-green-400">{s.wins}</td>
                                            <td className="px-6 py-3 text-red-400">{s.total - s.wins}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${s.winRate >= 60 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                                    {s.winRate.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* League Breakdown */}
                    {stats.byLeague && Object.keys(stats.byLeague).length > 0 && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gray-800 p-6 rounded-xl border border-gray-700 mt-4">
                            <h3 className="text-lg font-bold text-white mb-4">Desglose por Competición</h3>
                            <div className="overflow-x-auto max-h-96">
                                <table className="w-full text-sm text-left text-gray-400">
                                    <thead className="bg-gray-900 text-gray-200 uppercase text-xs sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3">Competición</th>
                                            <th className="px-6 py-3">Total</th>
                                            <th className="px-6 py-3">Ganadas</th>
                                            <th className="px-6 py-3">Perdidas</th>
                                            <th className="px-6 py-3">% Acierto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700 overflow-y-auto">
                                        {Object.entries(stats.byLeague)
                                            .sort((a, b) => (b[1] as any).total - (a[1] as any).total) // Sort by volume by default
                                            .map(([league, s]: [string, any]) => (
                                                <tr key={league} className="hover:bg-gray-750">
                                                    <td className="px-6 py-3 font-medium text-white">{league}</td>
                                                    <td className="px-6 py-3">{s.total}</td>
                                                    <td className="px-6 py-3 text-green-400">{s.wins}</td>
                                                    <td className="px-6 py-3 text-red-400">{s.total - s.wins}</td>
                                                    <td className="px-6 py-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${s.winRate >= 60 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                                            {s.winRate.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
