import React, { useState } from 'react';
import { useBets } from '../../hooks/useBets';
import { generatePerformanceReport } from '../../services/geminiService';
import { Bet, PerformanceReportResult, ChartDataPoint, BetStatus } from '../../types';
import { BrainIcon, CheckCircleIcon } from '../icons/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, PieLabelRenderProps } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { savePerformanceReport } from '../../services/performanceService';

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

const ReportDisplay: React.FC<{ report: PerformanceReportResult }> = ({ report }) => {
    const COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#1e3a8a', '#3b82f6', '#93c5fd'];
    
    const profitBySportData = (report.chartsData?.profitBySport || []).map(d => ({
        name: d.name || 'Desconocido',
        'Beneficio/Pérdida': d.value || 0,
    }));

    const betsByMarketData = (report.chartsData?.betsByMarket || []).map(d => ({
        name: d.name || 'Otro',
        value: d.value || 0,
    }));

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: PieLabelRenderProps & {index: number}) => {
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
            <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-white mb-2">Resumen Ejecutivo</h3>
                <p className="text-gray-300">{report.executiveSummary}</p>
            </div>

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

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user) {
            setError('Debes iniciar sesión para generar un informe.');
            return;
        }

        const filteredBets = bets.filter(bet => {
            const betDate = new Date(bet.date);
            return betDate >= new Date(startDate) && betDate <= new Date(endDate) && bet.status !== BetStatus.Pending;
        });

        if (filteredBets.length < 5) {
            setError('Se necesitan al menos 5 apuestas finalizadas (ganadas o perdidas) en el rango de fechas seleccionado para un análisis significativo.');
            return;
        }

        setIsLoading(true);
        setError('');
        setReport(null);
        setSuccessMessage('');
        
        try {
            const analysisResult = await generatePerformanceReport(filteredBets);
            setReport(analysisResult);
            // Guardar el informe en la base de datos después de generarlo
            await savePerformanceReport(user.id, analysisResult, startDate, endDate);
            setSuccessMessage('Informe generado y guardado exitosamente. Estos datos se usarán para personalizar tus futuros análisis.');
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`No se pudo generar el informe. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-2">Análisis de Rendimiento a Detalle</h3>
            <p className="text-sm text-gray-400 mb-4">
                Selecciona un rango de fechas y la IA analizará tu historial para generar un informe sobre tu rendimiento, fortalezas, debilidades y recomendaciones. Este informe se guardará para personalizar tus futuros análisis.
            </p>
            <form onSubmit={handleAnalyze} className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label htmlFor="start-date" className="block text-xs text-gray-400 mb-1">Desde</label>
                        <input
                            type="date"
                            id="start-date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white"
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="end-date" className="block text-xs text-gray-400 mb-1">Hasta</label>
                        <input
                            type="date"
                            id="end-date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto bg-green-accent hover:bg-green-600 text-white font-bold py-2.5 px-6 rounded-md transition duration-300 disabled:bg-gray-600"
                >
                    {isLoading ? 'Analizando...' : 'Generar Informe de Rendimiento'}
                </button>
            </form>

            <div className="flex-grow bg-gray-900 rounded-lg p-4 sm:p-6 overflow-y-auto">
                {error && <div className="bg-red-500/20 text-red-accent p-3 rounded-md text-center mb-4">{error}</div>}
                {successMessage && <div className="bg-green-500/20 text-green-accent p-3 rounded-md text-center mb-4 flex items-center justify-center gap-2"><CheckCircleIcon className="w-5 h-5" />{successMessage}</div>}
                {isLoading && <LoadingState />}
                {report && <ReportDisplay report={report} />}
                {!isLoading && !report && !error && (
                    <div className="text-center py-10 text-gray-500">
                        <p>El informe de rendimiento aparecerá aquí.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
