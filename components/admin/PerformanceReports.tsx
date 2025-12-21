
import React, { useState, useMemo } from 'react';
import { fetchPerformanceStats, PerformanceStats, aggregateStats } from '../../services/analysisService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChartBarIcon, DocumentArrowDownIcon, CalendarDaysIcon, TrophyIcon, XCircleIcon, CheckBadgeIcon, SignalIcon, FunnelIcon } from '../icons/Icons';

export const PerformanceReports: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [stats, setStats] = useState<PerformanceStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [confidenceFilter, setConfidenceFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

    const handleAnalyze = async () => {
        if (!startDate || !endDate) return alert("Selecciona un rango de fechas.");
        setLoading(true);
        try {
            // Fix: Construct explicit UTC strings to avoid Local Timezone shifts (e.g. setHours converting to previous day)
            const startStr = new Date(`${startDate}T00:00:00.000Z`);
            const endStr = new Date(`${endDate}T23:59:59.999Z`);

            const data = await fetchPerformanceStats(startStr, endStr);
            setStats(data);
        } catch (error) {
            console.error(error);
            alert("Error al generar el reporte.");
        } finally {
            setLoading(false);
        }
    };

    // Dynamic Filter Logic
    const displayStats = useMemo(() => {
        if (!stats) return null;
        if (confidenceFilter === 'ALL') return stats;

        const filteredPreds = stats.rawPredictions.filter(p => {
            let prob = p.probability || 0;
            if (prob > 0 && prob <= 1) prob *= 100; // Normalize decimal to percentage

            if (confidenceFilter === 'HIGH') return prob >= 80;
            if (confidenceFilter === 'MEDIUM') return prob >= 60 && prob < 80;
            if (confidenceFilter === 'LOW') return prob < 60;
            return true;
        });

        return aggregateStats(filteredPreds);
    }, [stats, confidenceFilter]);

    const handleDownloadPDF = () => {
        if (!displayStats) return;

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
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        doc.setDrawColor(34, 197, 94); // Green 500
        doc.setLineWidth(1);
        doc.line(20, 20, 20, 60);

        doc.setFillColor(22, 163, 74);
        doc.circle(pageWidth - 40, 40, 20, 'F');
        doc.setFillColor(15, 23, 42);
        doc.circle(pageWidth - 40, 40, 10, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(32);
        doc.text("BetCommand", 30, 40);

        doc.setTextColor(34, 197, 94);
        doc.setFontSize(32);
        doc.text(".", 103, 40);

        const centerX = pageWidth / 2;
        const centerY = pageHeight / 2;

        doc.setTextColor(200, 200, 200);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setCharSpace(3);
        doc.text("INFORME OFICIAL", centerX, centerY - 30, { align: 'center' });

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(40);
        doc.setFont('helvetica', 'bold');
        doc.setCharSpace(0);
        doc.text("RENDIMIENTO AI", centerX, centerY, { align: 'center' });

        doc.setTextColor(34, 197, 94);
        doc.setFontSize(18);
        const filterText = confidenceFilter === 'ALL' ? "GLOBAL" : `FILTRO: CONFIANZA ${confidenceFilter}`;
        doc.text(`AUDITORÍA & EFICIENCIA (${filterText})`, centerX, centerY + 15, { align: 'center' });

        doc.setDrawColor(100, 100, 100);
        doc.line(centerX - 50, centerY + 50, centerX + 50, centerY + 50);

        doc.setTextColor(150, 150, 150);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`${startDate}  —  ${endDate}`, centerX, centerY + 65, { align: 'center' });

        doc.setFontSize(10);
        doc.text("Generado automáticamente por el Sistema", centerX, pageHeight - 30, { align: 'center' });

        // --- NEW PAGE FOR CONTENT ---
        doc.addPage();
        yPos = 20;


        // (Keep the rest of PDF logic as is, just truncated for brevity in this specific visual redesign component, 
        // assuming standard PDF generation isn't the primary visual target but the on-screen report is.)
        // ... PDF Logic omitted for brevity but should be kept if replacing full file. 
        // Note: Re-inserting the full PDF logic from the previous file content to ensuring no functionality loss.

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
        doc.text(`Reporte: ${startDate} / ${endDate} | Filtro: ${confidenceFilter}`, pageWidth - 14, 20, { align: 'right' });

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
        const summaryText = `Durante el período seleccionado ${confidenceFilter !== 'ALL' ? `(filtrando por confianza ${confidenceFilter})` : ''}, el sistema procesó un total de ${displayStats.total} predicciones. ` +
            `Se alcanzó una tasa de acierto del ${displayStats.winRate.toFixed(1)}%, identificando ${displayStats.wins} oportunidades ganadoras. ` +
            `Este informe detalla el comportamiento de la IA segmentado para optimizar la toma de decisiones.`;
        doc.text(doc.splitTextToSize(summaryText, pageWidth - 28), 14, yPos);
        yPos += 25;

        // KPI CARDS ROW
        const kpiWidth = (pageWidth - 34) / 4;
        const kpiHeight = 25;
        const metrics = [
            { label: "TOTAL", value: displayStats.total.toString(), color: [60, 60, 60] },
            { label: "% ACIERTO", value: displayStats.winRate.toFixed(1) + "%", color: displayStats.winRate >= 60 ? [22, 163, 74] : [220, 38, 38] },
            { label: "GANADAS", value: displayStats.wins.toString(), color: [22, 163, 74] },
            { label: "PERDIDAS", value: displayStats.losses.toString(), color: [220, 38, 38] }
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

        // --- CONFIDENCE ANALYSIS (Skip if single confidence filter is active unless needed for context) ---
        if (confidenceFilter === 'ALL') {
            checkPageBreak(80);
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(16);
            doc.text("2. Análisis por Nivel de Confianza", 14, yPos);
            yPos += 10;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text("Desglose de eficiencia según la clasificación de confianza del modelo.", 14, yPos);
            yPos += 8;

            const confData = [
                ['Nivel', 'Predicciones', 'Ganadas', '% Eficiencia', 'Impacto'],
                ['ALTA (+80%)', displayStats.byConfidence.HIGH.total, displayStats.byConfidence.HIGH.wins, displayStats.byConfidence.HIGH.winRate.toFixed(1) + "%", "Crítico"],
                ['MEDIA (60-79%)', displayStats.byConfidence.MEDIUM.total, displayStats.byConfidence.MEDIUM.wins, displayStats.byConfidence.MEDIUM.winRate.toFixed(1) + "%", "Volumen"],
                ['BAJA (<60%)', displayStats.byConfidence.LOW.total, displayStats.byConfidence.LOW.wins, displayStats.byConfidence.LOW.winRate.toFixed(1) + "%", "Riesgo"]
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
        }

        // --- PROBABILITY CURVE ---
        checkPageBreak(80);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.text(`${confidenceFilter === 'ALL' ? '3' : '2'}. Curva de Probabilidad Real vs Esperada`, 14, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text("Comparativa entre la probabilidad calculada por la IA y el resultado real obtenido.", 14, yPos);
        yPos += 8;

        const probRows = Object.entries(displayStats.byProbability)
            .sort((a, b) => b[0].localeCompare(a[0])) // Sort desc ie 90-100 first
            .map(([bucket, s]: [string, any]) => [
                bucket,
                s.total,
                s.wins,
                s.winRate.toFixed(1) + "%",
                // Conditional logic for simple check
                s.winRate >= (parseInt(bucket.split('-')[0]) || 0) ? "✅ Sobre-rendimiento" : "⚠️ Bajo rendimiento"
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
        doc.text(`${confidenceFilter === 'ALL' ? '4' : '3'}. Desglose Detallado por Mercado`, 14, yPos);
        yPos += 10;

        const marketRows = Object.entries(displayStats.byMarket)
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
        doc.text(`${confidenceFilter === 'ALL' ? '5' : '4'}. Desglose por Competición (Ligas)`, 14, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text("Análisis de rendimiento específico por liga o torneo.", 14, yPos);
        yPos += 8;

        const leagueRows = Object.entries(displayStats.byLeague || {})
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

        doc.save(`BetCommand_Analisis_${confidenceFilter}_${startDate}_${endDate}.pdf`);
    };

    return (
        <div className="space-y-6">
            {/* Filter Section - Glass Panel */}
            <div className="glass p-6 rounded-xl border border-white/5">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">DESDE</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-slate-900/80 border border-white/10 text-white rounded-lg p-3 text-sm w-40 focus:ring-2 focus:ring-brand outline-none shadow-inner"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">HASTA</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-slate-900/80 border border-white/10 text-white rounded-lg p-3 text-sm w-40 focus:ring-2 focus:ring-brand outline-none shadow-inner"
                        />
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        className="bg-brand hover:bg-emerald-400 text-slate-900 font-bold py-3 px-6 rounded-lg flex items-center transition-all shadow-lg shadow-brand/20 disabled:opacity-50 disabled:shadow-none"
                    >
                        {loading ? <span className="animate-spin mr-2">⟳</span> : <ChartBarIcon className="w-5 h-5 mr-2" />}
                        Analizar
                    </button>
                    {displayStats && (
                        <button
                            onClick={handleDownloadPDF}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg flex items-center transition-all shadow-lg shadow-blue-500/20 ml-auto"
                        >
                            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                            PDF
                        </button>
                    )}
                </div>
            </div>

            {/* Confidence Filter Tabs */}
            {stats && (
                <div className="glass p-3 rounded-xl border border-white/5 flex flex-wrap gap-2 items-center">
                    <span className="text-slate-400 text-xs font-bold mr-2 ml-2 flex items-center tracking-wider"><FunnelIcon className="w-4 h-4 mr-1" /> FILTRAR:</span>
                    {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(filter => (
                        <button
                            key={filter}
                            onClick={() => setConfidenceFilter(filter)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${confidenceFilter === filter
                                ? filter === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                    : filter === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                                        : filter === 'LOW' ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                            : 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                : 'bg-transparent text-slate-400 border-transparent hover:bg-white/5'
                                }`}
                        >
                            {filter === 'ALL' ? 'GLOBAL' : filter === 'HIGH' ? 'ALTA (+80%)' : filter === 'MEDIUM' ? 'MEDIA (60-79%)' : 'BAJA (<60%)'}
                        </button>
                    ))}
                </div>
            )}

            {displayStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                    {/* KPI Cards */}
                    <div className="glass p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ChartBarIcon className="w-16 h-16 text-white" />
                        </div>
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Total Predicciones</p>
                        <p className="text-4xl font-display font-bold text-white mt-2">{displayStats.total}</p>
                    </div>

                    <div className="glass p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <SignalIcon className="w-16 h-16 text-white" />
                        </div>
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Tasa de Acierto</p>
                        <p className={`text-4xl font-display font-bold mt-2 ${displayStats.winRate >= 60 ? 'text-emerald-400' : 'text-yellow-400'}`}>{displayStats.winRate.toFixed(1)}%</p>
                    </div>

                    <div className="glass p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <TrophyIcon className="w-16 h-16 text-emerald-500" />
                        </div>
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Ganadas</p>
                        <p className="text-4xl font-display font-bold text-emerald-400 mt-2">{displayStats.wins}</p>
                    </div>

                    <div className="glass p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <XCircleIcon className="w-16 h-16 text-red-500" />
                        </div>
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Perdidas</p>
                        <p className="text-4xl font-display font-bold text-red-400 mt-2">{displayStats.losses}</p>
                    </div>

                    {/* Breakdown by Confidence Cards (Only if ALL is selected) */}
                    {confidenceFilter === 'ALL' && displayStats.byConfidence && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                            <div className="bg-emerald-900/10 p-5 rounded-xl border border-emerald-500/20 flex flex-col items-center justify-center text-center">
                                <span className="text-emerald-400 font-bold mb-2 flex items-center text-sm tracking-wide"><CheckBadgeIcon className="w-4 h-4 mr-2" /> CONFIANZA ALTA</span>
                                <span className="text-3xl font-bold text-white mb-1">{displayStats.byConfidence.HIGH.winRate.toFixed(1)}%</span>
                                <span className="text-xs text-emerald-200/60 font-mono">{displayStats.byConfidence.HIGH.wins}/{displayStats.byConfidence.HIGH.total} aciertos</span>
                            </div>
                            <div className="bg-yellow-900/10 p-5 rounded-xl border border-yellow-500/20 flex flex-col items-center justify-center text-center">
                                <span className="text-yellow-400 font-bold mb-2 flex items-center text-sm tracking-wide"><SignalIcon className="w-4 h-4 mr-2" /> CONFIANZA MEDIA</span>
                                <span className="text-3xl font-bold text-white mb-1">{displayStats.byConfidence.MEDIUM.winRate.toFixed(1)}%</span>
                                <span className="text-xs text-yellow-200/60 font-mono">{displayStats.byConfidence.MEDIUM.wins}/{displayStats.byConfidence.MEDIUM.total} aciertos</span>
                            </div>
                            <div className="bg-red-900/10 p-5 rounded-xl border border-red-500/20 flex flex-col items-center justify-center text-center">
                                <span className="text-red-400 font-bold mb-2 flex items-center text-sm tracking-wide">CONFIANZA BAJA</span>
                                <span className="text-3xl font-bold text-white mb-1">{displayStats.byConfidence.LOW.winRate.toFixed(1)}%</span>
                                <span className="text-xs text-red-200/60 font-mono">{displayStats.byConfidence.LOW.wins}/{displayStats.byConfidence.LOW.total} aciertos</span>
                            </div>
                        </div>
                    )}

                    {/* Market Breakdown Table */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-4 glass p-6 rounded-xl border border-white/5 mt-4">
                        <h3 className="text-lg font-display font-bold text-white mb-6">Desglose por Mercado</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-400">
                                <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 rounded-l-lg">Mercado</th>
                                        <th className="px-6 py-4">Total</th>
                                        <th className="px-6 py-4">Ganadas</th>
                                        <th className="px-6 py-4">Perdidas</th>
                                        <th className="px-6 py-4 rounded-r-lg">% Acierto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {Object.entries(displayStats.byMarket).map(([market, s]: [string, any]) => (
                                        <tr key={market} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{market}</td>
                                            <td className="px-6 py-4">{s.total}</td>
                                            <td className="px-6 py-4 text-emerald-400 font-bold">{s.wins}</td>
                                            <td className="px-6 py-4 text-red-400">{s.total - s.wins}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${s.winRate >= 60 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {s.winRate.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* League Breakdown Table */}
                    {displayStats.byLeague && Object.keys(displayStats.byLeague).length > 0 && (
                        <div className="col-span-1 md:col-span-2 lg:col-span-4 glass p-6 rounded-xl border border-white/5 mt-4">
                            <h3 className="text-lg font-display font-bold text-white mb-6">Desglose por Competición</h3>
                            <div className="overflow-x-auto max-h-96 custom-scrollbar">
                                <table className="w-full text-sm text-left text-slate-400">
                                    <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs font-bold tracking-wider sticky top-0 backdrop-blur-md">
                                        <tr>
                                            <th className="px-6 py-4">Competición</th>
                                            <th className="px-6 py-4">Total</th>
                                            <th className="px-6 py-4">Ganadas</th>
                                            <th className="px-6 py-4">Perdidas</th>
                                            <th className="px-6 py-4">% Acierto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {Object.entries(displayStats.byLeague)
                                            .sort((a, b) => (b[1] as any).total - (a[1] as any).total) // Sort by volume by default
                                            .map(([league, s]: [string, any]) => (
                                                <tr key={league} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-white">{league}</td>
                                                    <td className="px-6 py-4">{s.total}</td>
                                                    <td className="px-6 py-4 text-emerald-400 font-bold">{s.wins}</td>
                                                    <td className="px-6 py-4 text-red-400">{s.total - s.wins}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${s.winRate >= 60 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
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
