import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
                    <div className="bg-gray-800 p-8 rounded-lg border border-red-500 max-w-2xl w-full">
                        <h1 className="text-3xl font-bold text-red-500 mb-4">¡Oops! Algo salió mal.</h1>
                        <p className="text-gray-300 mb-4">
                            La aplicación ha detectado un error crítico y no puede continuar.
                        </p>
                        {this.state.error && (
                            <div className="bg-black/50 p-4 rounded text-red-300 font-mono text-sm overflow-auto max-h-60 mb-4">
                                <p className="font-bold">{this.state.error.toString()}</p>
                                {this.state.errorInfo && (
                                    <pre className="mt-2 text-xs opacity-75">{this.state.errorInfo.componentStack}</pre>
                                )}
                            </div>
                        )}
                        <div className="flex gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded transition-colors"
                            >
                                Recargar Página
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded transition-colors"
                            >
                                Volver al Inicio
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
