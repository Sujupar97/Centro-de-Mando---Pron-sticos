import React, { useState } from 'react';
import { ComparativeAnalysis } from './ComparativeAnalysis';
import { ParlayBuilder } from './ParlayBuilder';
import { TableCellsIcon, PuzzlePieceIcon } from '../icons/Icons';

type AiTab = 'parlay' | 'compare';

const TABS: { id: AiTab, name: string, icon: React.ReactNode }[] = [
    { id: 'parlay', name: 'Constructor de Parlays', icon: <PuzzlePieceIcon /> },
    { id: 'compare', name: 'Análisis Comparativo', icon: <TableCellsIcon /> },
];

export const AiAnalysis: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AiTab>('parlay');

    const renderContent = () => {
        switch (activeTab) {
            case 'parlay':
                return <ParlayBuilder />;
            case 'compare':
                return <ComparativeAnalysis />;
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
                        className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium transition-colors flex-shrink-0 ${activeTab === tab.id
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
