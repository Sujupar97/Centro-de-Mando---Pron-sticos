import React from 'react';
import { Link } from 'react-router-dom';
import { ChartBarIcon } from '../icons/Icons';

interface LegalLayoutProps {
    title: string;
    lastUpdated: string;
    children: React.ReactNode;
}

export const LegalLayout: React.FC<LegalLayoutProps> = ({ title, lastUpdated, children }) => {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 font-sans">
            {/* Header */}
            <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand to-emerald-600 flex items-center justify-center">
                            <ChartBarIcon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-base font-display font-bold text-white tracking-tight">
                            Der<span className="text-brand">bix</span>
                        </span>
                    </Link>
                    <Link
                        to="/"
                        className="text-sm text-slate-500 hover:text-white transition-colors"
                    >
                        Volver al inicio
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-display font-bold text-white mb-2">{title}</h1>
                <p className="text-sm text-slate-500 mb-10">
                    Last updated: {lastUpdated}
                </p>

                <div className="prose prose-invert prose-slate max-w-none
                    prose-headings:text-white prose-headings:font-display
                    prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
                    prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                    prose-p:text-slate-400 prose-p:leading-relaxed
                    prose-li:text-slate-400
                    prose-strong:text-slate-200
                    prose-a:text-brand prose-a:no-underline hover:prose-a:underline
                ">
                    {children}
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 mt-16">
                <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} Derbix. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to="/terms" className="text-xs text-slate-500 hover:text-white transition-colors">Terms</Link>
                        <Link to="/privacy" className="text-xs text-slate-500 hover:text-white transition-colors">Privacy</Link>
                        <Link to="/refund" className="text-xs text-slate-500 hover:text-white transition-colors">Refund</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};
