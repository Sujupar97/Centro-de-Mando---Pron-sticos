import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import { SparklesIcon, ComputerDesktopIcon, BoltIcon, CheckCircleIcon, ChartBarIcon, EyeSlashIcon, BrainIcon, LightBulbIcon } from '../icons/Icons';

export const OperationsCenter: React.FC = () => {
    const [settings, setSettings] = useState<{ [key: string]: boolean }>({
        auto_analysis_enabled: true,
        auto_parlay_enabled: true,
        auto_verification_enabled: true,
        ml_strategic_insights_enabled: false,
        presentation_mode: false,
    });
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [displayBankroll, setDisplayBankroll] = useState<number>(100);
    const [bankrollInput, setBankrollInput] = useState<string>('100');
    const [bankrollSaved, setBankrollSaved] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const { data } = await supabase.from('system_settings').select('*');
            if (data) {
                const map = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
                setSettings(prev => ({ ...prev, ...map }));
                if (map.display_bankroll !== undefined) {
                    setDisplayBankroll(map.display_bankroll);
                    setBankrollInput(String(map.display_bankroll));
                }
            }
        } catch (e) {
            console.error("Error loading settings:", e);
        } finally {
            setLoadingSettings(false);
        }
    };

    const saveBankroll = async () => {
        const val = parseFloat(bankrollInput);
        if (isNaN(val) || val <= 0) return;
        try {
            await supabase.from('system_settings')
                .update({ value: val, updated_at: new Date().toISOString() })
                .eq('key', 'display_bankroll');
            setDisplayBankroll(val);
            setBankrollSaved(true);
            setTimeout(() => setBankrollSaved(false), 2000);
        } catch (e) {
            console.error("Error saving bankroll:", e);
        }
    };

    const toggleSetting = async (key: string) => {
        const newValue = !settings[key];
        setSettings(prev => ({ ...prev, [key]: newValue }));

        try {
            const { error } = await supabase
                .from('system_settings')
                .update({ value: newValue })
                .eq('key', key);

            if (error) throw error;
        } catch (e) {
            console.error(`Error updating setting ${key}:`, e);
            setSettings(prev => ({ ...prev, [key]: !newValue }));
            alert("Error al actualizar la configuración.");
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="glass p-4 sm:p-6 rounded-xl border border-white/5 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-800">
                <h2 className="text-xl font-display font-bold text-white mb-6 flex items-center gap-3">
                    <ComputerDesktopIcon className="w-6 h-6 text-blue-400" />
                    Control de Automatización del Sistema
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Switch 1: Auto Analysis */}
                    <div className={`p-4 rounded-xl border transition-all ${settings.auto_analysis_enabled ? 'bg-blue-900/20 border-blue-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <BoltIcon className={`w-6 h-6 ${settings.auto_analysis_enabled ? 'text-blue-400' : 'text-slate-500'}`} />
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.auto_analysis_enabled}
                                    onChange={() => toggleSetting('auto_analysis_enabled')}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                        <h3 className="font-bold text-gray-200">Análisis Diario</h3>
                        <p className="text-xs text-gray-400 mt-1">Genera automáticamente análisis para partidos del día siguiente (2:00 AM).</p>
                    </div>

                    {/* Switch 2: Auto Parlay */}
                    <div className={`p-4 rounded-xl border transition-all ${settings.auto_parlay_enabled ? 'bg-green-900/20 border-green-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <SparklesIcon className={`w-6 h-6 ${settings.auto_parlay_enabled ? 'text-green-400' : 'text-slate-500'}`} />
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.auto_parlay_enabled}
                                    onChange={() => toggleSetting('auto_parlay_enabled')}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                        <h3 className="font-bold text-gray-200">Generador de Parlays</h3>
                        <p className="text-xs text-gray-400 mt-1">Crea combinadas automáticamente tras finalizar los análisis diarios.</p>
                    </div>

                    {/* Switch 3: ML Auto-Learning */}
                    <div className={`p-4 rounded-xl border transition-all ${settings.ml_auto_learning_enabled ? 'bg-cyan-900/20 border-cyan-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 rounded-lg bg-cyan-500/10">
                                <BrainIcon className={`w-6 h-6 ${settings.ml_auto_learning_enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.ml_auto_learning_enabled}
                                    onChange={() => toggleSetting('ml_auto_learning_enabled')}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                            </label>
                        </div>
                        <h3 className="font-bold text-gray-200">ML Auto-Learning</h3>
                        <p className="text-xs text-gray-400 mt-1">Activa la inyeccion dinamica de calibracion ML en el motor de analisis.</p>
                    </div>

                    {/* Switch 4: Auto Verification */}
                    <div className={`p-4 rounded-xl border transition-all ${settings.auto_verification_enabled ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <CheckCircleIcon className={`w-6 h-6 ${settings.auto_verification_enabled ? 'text-amber-400' : 'text-slate-500'}`} />
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.auto_verification_enabled}
                                    onChange={() => toggleSetting('auto_verification_enabled')}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                            </label>
                        </div>
                        <h3 className="font-bold text-gray-200">Verificador de Resultados</h3>
                        <p className="text-xs text-gray-400 mt-1">Verifica resultados cada hora vía SportMonks y actualiza picks WON/LOST.</p>
                    </div>
                </div>
            </div>

            {/* Modo Presentación */}
            <div className="glass p-4 sm:p-6 rounded-xl border border-white/5 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-800">
                <div className={`p-4 rounded-xl border transition-all ${settings.presentation_mode ? 'bg-purple-900/20 border-purple-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <EyeSlashIcon className={`w-6 h-6 ${settings.presentation_mode ? 'text-purple-400' : 'text-slate-500'}`} />
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.presentation_mode}
                                onChange={() => toggleSetting('presentation_mode')}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>
                    <h3 className="font-bold text-gray-200">Modo Presentación</h3>
                    <p className="text-xs text-gray-400 mt-1">Oculta resultados (GANADO/PERDIDO) y el tab de Resultados para demos y capturas de pantalla.</p>
                    {settings.presentation_mode && (
                        <p className="text-xs text-purple-400 mt-2 font-bold">ACTIVO — Los resultados están ocultos para todos los usuarios.</p>
                    )}
                </div>
            </div>

            {/* Aprendizajes Estratégicos */}
            <div className="glass p-4 sm:p-6 rounded-xl border border-white/5 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-800">
                <div className={`p-4 rounded-xl border transition-all ${settings.ml_strategic_insights_enabled ? 'bg-violet-900/20 border-violet-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 rounded-lg bg-violet-500/10">
                            <LightBulbIcon className={`w-6 h-6 ${settings.ml_strategic_insights_enabled ? 'text-violet-400' : 'text-slate-500'}`} />
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.ml_strategic_insights_enabled}
                                onChange={() => toggleSetting('ml_strategic_insights_enabled')}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                        </label>
                    </div>
                    <h3 className="font-bold text-gray-200">Aprendizajes Estratégicos</h3>
                    <p className="text-xs text-gray-400 mt-1">Inyecta insights cualitativos (basados en picks verificados) al prompt de Gemini. OFF = Gemini puro.</p>
                    {settings.ml_strategic_insights_enabled && (
                        <p className="text-xs text-violet-400 mt-2 font-bold">ACTIVO — Los aprendizajes se inyectan al final del prompt.</p>
                    )}
                </div>
            </div>

            {/* Bankroll Configuration */}
            <div className="glass p-4 sm:p-6 rounded-xl border border-white/5 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-800">
                <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-3">
                    <ChartBarIcon className="w-6 h-6 text-emerald-400" />
                    Bankroll de Referencia
                </h2>
                <p className="text-sm text-slate-400 mb-4">
                    Este valor se usa como base para la proyección de rendimiento que ven todos los usuarios en la pestaña Resultados.
                </p>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">$</span>
                        <input
                            type="number"
                            value={bankrollInput}
                            onChange={e => setBankrollInput(e.target.value)}
                            className="w-32 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                            min="1"
                        />
                    </div>
                    <button
                        onClick={saveBankroll}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            bankrollSaved
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                    >
                        {bankrollSaved ? 'Guardado' : 'Guardar'}
                    </button>
                    <span className="text-xs text-slate-500">Actual: ${displayBankroll}</span>
                </div>
            </div>
        </div>
    );
};
