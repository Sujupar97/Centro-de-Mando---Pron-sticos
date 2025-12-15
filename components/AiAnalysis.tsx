import React, { useState } from 'react';
import { ScenarioAnalyzer } from './ai/ScenarioAnalyzer';
import { ComparativeAnalysis } from './ai/ComparativeAnalysis';
import { ParlayBuilder } from './ai/ParlayBuilder';
import { ApiTestRunner } from './ai/ApiTestRunner';
import { PerformanceAnalyzer } from './ai/PerformanceAnalyzer';
import { MagnifyingGlassIcon, TableCellsIcon, PuzzlePieceIcon, ListBulletIcon, PresentationChartLineIcon } from './icons/Icons';

type AiTab = 'scenario' | 'parlay' | 'performance' | 'compare' | 'test';

const TABS: { id: AiTab, name: string, icon: React.ReactNode }[] = [
    { id: 'scenario', name: 'Análisis de Escenarios', icon: <MagnifyingGlassIcon /> },
    { id: 'parlay', name: 'Constructor de Parlays', icon: <PuzzlePieceIcon /> },
    { id: 'performance', name: 'Análisis de Rendimiento', icon: <PresentationChartLineIcon /> },
    { id: 'compare', name: 'Análisis Comparativo', icon: <TableCellsIcon /> },
    { id: 'test', name: 'Prueba de API', icon: <ListBulletIcon /> },
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
        <div className="flex flex-col h-full">
            <h2 className="text-3xl font-bold text-white mb-6">Análisis con IA de Gemini</h2>
            <div className="flex border-b border-gray-700 mb-6 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium transition-colors flex-shrink-0 ${
                            activeTab === tab.id
                                ? 'border-b-2 border-green-accent text-green-accent'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {tab.icon}
                        <span>{tab.name}</span>
                    </button>
                ))}
            </div>
            <div className="flex-grow bg-gray-800 p-6 rounded-lg shadow-inner">
                {renderContent()}
            </div>
        </div>
    );
};
