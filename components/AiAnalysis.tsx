import React, { useState } from 'react';
import { ScenarioAnalyzer } from './ai/ScenarioAnalyzer';
import { ComparativeAnalysis } from './ai/ComparativeAnalysis';
import { ParlayBuilder } from './ai/ParlayBuilder';
import { ApiTestRunner } from './ai/ApiTestRunner';
import { PerformanceAnalyzer } from './ai/PerformanceAnalyzer';
import { MagnifyingGlassIcon, TableCellsIcon, PuzzlePieceIcon, ListBulletIcon, PresentationChartLineIcon } from './icons/Icons';

type AiTab = 'scenario' | 'parlay' | 'performance' | 'compare' | 'test';

const TABS: { id: AiTab, name: string, icon: React.ReactNode }[] = [
    { id: 'scenario', name: 'Escenarios', icon: <MagnifyingGlassIcon className="w-4 h-4" /> },
    { id: 'parlay', name: 'Parlay Builder', icon: <PuzzlePieceIcon className="w-4 h-4" /> },
    { id: 'performance', name: 'Rendimiento', icon: <PresentationChartLineIcon className="w-4 h-4" /> },
    { id: 'compare', name: 'Comparador', icon: <TableCellsIcon className="w-4 h-4" /> },
    { id: 'test', name: 'API Test', icon: <ListBulletIcon className="w-4 h-4" /> },
];

export const AiAnalysis: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AiTab>('scenario');

    const renderContent = () => {
        switch (activeTab) {
            case 'scenario':
                return <ScenarioAnalyzer />;
            case 'parlay':
                return <ParlayBuilder />;
            case 'performance':
                return <PerformanceAnalyzer />;
            case 'compare':
                return <ComparativeAnalysis />;
            case 'test':
                return <ApiTestRunner />;
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-white tracking-tight">Inteligencia Artificial</h2>
                    <p className="text-slate-400 mt-1">Herramientas avanzadas de predicción y análisis.</p>
                </div>
            </div>

            {/* Apple-style Segmented Control */}
            <div className="flex p-1 space-x-1 bg-slate-900/60 backdrop-blur-md rounded-xl border border-white/5 overflow-x-auto self-start max-w-full">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 whitespace-nowrap ${isActive
                                    ? 'bg-slate-700 text-white shadow-md shadow-black/20 ring-1 ring-white/10'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                }`}
                        >
                            <span className={isActive ? 'text-brand' : ''}>{tab.icon}</span>
                            <span>{tab.name}</span>
                        </button>
                    );
                })}
            </div>

            <div className="flex-grow glass rounded-2xl p-6 md:p-8 animate-fade-in border border-white/5 shadow-2xl overflow-hidden relative">
                {/* Decorative background blur */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

                {renderContent()}
            </div>
        </div>
    );
};
