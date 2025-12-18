import React, { useRef } from 'react';

interface TicketUploaderProps {
    onImageSelected: (file: File) => void;
}

export const TicketUploader: React.FC<TicketUploaderProps> = ({ onImageSelected }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            onImageSelected(file);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onImageSelected(file);
        }
    };

    return (
        <div
            className="border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl p-12 text-center cursor-pointer transition-colors bg-gray-800/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleChange}
                accept="image/*"
                className="hidden"
            />
            <div className="text-gray-400 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-lg font-medium text-white">Sube una imagen del ticket</span>
            </div>
            <p className="text-sm text-gray-500">Arrastra y suelta o haz clic para seleccionar</p>
        </div>
    );
};
