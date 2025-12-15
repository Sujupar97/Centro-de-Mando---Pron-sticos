import React, { useState, useEffect } from 'react';

interface SettingsProps {
    initialCapital: number;
    setInitialCapital: (capital: number) => void;
}

export const Settings: React.FC<SettingsProps> = ({ initialCapital, setInitialCapital }) => {
    const [capitalInput, setCapitalInput] = useState(initialCapital.toString());
    const [savedMessage, setSavedMessage] = useState(false);

    useEffect(() => {
        setCapitalInput(initialCapital.toString());
    }, [initialCapital]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const newCapital = parseFloat(capitalInput) || 0;
        setInitialCapital(newCapital);
        setSavedMessage(true);
        setTimeout(() => setSavedMessage(false), 3000); // El mensaje desaparece después de 3 segundos
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6">Configuración</h2>
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
                <form onSubmit={handleSave} className="space-y-6">
                    <div>
                        <label htmlFor="initialCapital" className="block text-sm font-medium text-gray-400 mb-2">
                            Capital Inicial (COP)
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                            Establece tu capital inicial para calcular tu balance y rendimiento de forma precisa.
                        </p>
                        <input
                            type="number"
                            id="initialCapital"
                            value={capitalInput}
                            onChange={(e) => setCapitalInput(e.target.value)}
                            step="1000"
                            min="0"
                            placeholder="500000"
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2.5 text-white focus:ring-green-accent focus:border-green-accent"
                        />
                    </div>
                    <div className="flex items-center space-x-4">
                        <button type="submit" className="bg-green-accent hover:bg-green-600 text-white font-bold py-2 px-6 rounded-md transition duration-300">
                          Guardar Cambios
                        </button>
                        {savedMessage && (
                            <span className="text-green-accent text-sm transition-opacity duration-300">
                                ¡Guardado correctamente!
                            </span>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};