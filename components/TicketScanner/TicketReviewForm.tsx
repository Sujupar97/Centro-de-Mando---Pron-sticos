import React, { useState } from 'react';
import { TicketData } from './index';

interface TicketReviewFormProps {
    initialData: TicketData;
    image: string | null;
    onSave: (data: TicketData) => void;
    onCancel: () => void;
}

export const TicketReviewForm: React.FC<TicketReviewFormProps> = ({ initialData, image, onSave, onCancel }) => {
    const [formData, setFormData] = useState<TicketData>(initialData);

    const handleChange = (field: keyof TicketData, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Preview Image */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Imagen del Ticket</h3>
                {image ? (
                    <div className="rounded-lg overflow-hidden border border-gray-700 bg-black/40">
                        <img src={image} alt="Ticket" className="w-full h-auto object-contain max-h-[600px]" />
                    </div>
                ) : (
                    <div className="bg-gray-800 h-64 flex items-center justify-center text-gray-500">No image</div>
                )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <h3 className="text-lg font-semibold text-white">Datos Extraídos</h3>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-400 mb-1">Fecha</label>
                        <input
                            type="date"
                            value={formData.date || ''}
                            onChange={e => handleChange('date', e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-1">Hora</label>
                        <input
                            type="time"
                            value={formData.time || ''}
                            onChange={e => handleChange('time', e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-gray-400 mb-1">Evento</label>
                    <input
                        type="text"
                        value={formData.event || ''}
                        onChange={e => handleChange('event', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-400 mb-1">Mercado</label>
                        <input
                            type="text"
                            value={formData.market || ''}
                            onChange={e => handleChange('market', e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-1">Selección</label>
                        <input
                            type="text"
                            value={formData.selection || ''}
                            onChange={e => handleChange('selection', e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-gray-400 mb-1">Stake ($)</label>
                        <input
                            type="number"
                            value={formData.stake || 0}
                            onChange={e => handleChange('stake', parseFloat(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-1">Cuota (Odds)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.odds || 0}
                            onChange={e => handleChange('odds', parseFloat(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-1">Pago Potencial</label>
                        <input
                            type="number"
                            value={formData.potential_payout || 0}
                            onChange={e => handleChange('potential_payout', parseFloat(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                    </div>
                </div>

                {formData.type === 'parlay' && (
                    <div className="bg-gray-800/50 p-3 rounded">
                        <span className="text-yellow-400 text-xs uppercase font-bold">Parlay detectado</span>
                        <p className="text-gray-400 text-xs mt-1">
                            {formData.legs?.length} selecciones encontradas. (Edición de legs avanzada no implementada en esta vista rápida).
                        </p>
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded text-gray-300 hover:text-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium"
                    >
                        Confirmar y Guardar
                    </button>
                </div>
            </form>
        </div>
    );
};
