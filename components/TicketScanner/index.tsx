import React, { useState } from 'react';
import { TicketUploader } from './TicketUploader';
import { TicketReviewForm } from './TicketReviewForm';
import { supabase } from '../../services/supabaseService';

export type TicketData = {
    date?: string;
    time?: string;
    event?: string;
    market?: string;
    selection?: string;
    stake?: number;
    odds?: number;
    potential_payout?: number;
    bookmaker?: string;
    status: 'pending' | 'won' | 'lost';
    type: 'single' | 'parlay';
    legs?: any[]; // Defined more strictly if needed
    image_url?: string;
};

export const TicketScanner: React.FC = () => {
    const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'success'>('upload');
    const [ticketData, setTicketData] = useState<TicketData | null>(null);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleImageSelected = async (file: File) => {
        setStep('processing');
        setError(null);
        try {
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('tickets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('tickets')
                .getPublicUrl(filePath);

            setUploadedImageUrl(publicUrl);

            // 2. Call Edge Function
            // We can pass the public URL or base64. Public URL is better if bucket is public, 
            // but if bucket is private we might need signed URL or pass base64. 
            // For now assuming we can use public URL or a signed URL.

            // Let's create a signed URL to be safe if bucket is private
            const { data: signedData, error: signedError } = await supabase.storage
                .from('tickets')
                .createSignedUrl(filePath, 60); // 60 seconds validity for the function to fetch

            if (signedError) throw signedError;

            const { data, error: funcError } = await supabase.functions.invoke('scan-ticket', {
                body: { image: signedData.signedUrl },
            });

            if (funcError) throw funcError;
            if (data.error) throw new Error(data.error);

            setTicketData({ ...data, image_url: publicUrl }); // Keep public URL for display if open, or use signed for now.
            setStep('review');

        } catch (err: any) {
            console.error('Error scanning ticket:', err);
            setError(err.message || 'Error processing ticket');
            setStep('upload');
        }
    };

    const handleSave = async (confirmedData: TicketData) => {
        try {
            // Save to 'bets' table
            // We need to map TicketData to existing schema variables
            // Schema: create_bet_with_legs(p_date, p_event, p_market, p_stake, p_odds, p_status, p_payout, p_image, p_legs)

            const { error } = await supabase.rpc('create_bet_with_legs', {
                p_date: confirmedData.date || new Date().toISOString().split('T')[0],
                p_event: confirmedData.event || 'Unknown Event',
                p_market: confirmedData.market || 'Unknown Market',
                p_stake: confirmedData.stake || 0,
                p_odds: confirmedData.odds || 0,
                p_status: confirmedData.status || 'pending',
                p_payout: confirmedData.potential_payout || 0,
                p_image: uploadedImageUrl,
                p_legs: confirmedData.legs || []
            });

            if (error) throw error;

            setStep('success');
        } catch (err: any) {
            console.error('Error saving bet:', err);
            setError(err.message || 'Failed to save bet');
        }
    };

    if (step === 'success') {
        return (
            <div className="p-8 text-center bg-green-900/20 rounded-lg border border-green-500/50">
                <h2 className="text-2xl font-bold text-green-400 mb-4">¡Ticket Guardado!</h2>
                <button
                    onClick={() => { setStep('upload'); setTicketData(null); }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                    Escanear Otro
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6 text-white">Escanear Ticket</h1>

            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded mb-4">
                    {error}
                </div>
            )}

            {step === 'upload' && (
                <TicketUploader onImageSelected={handleImageSelected} />
            )}

            {step === 'processing' && (
                <div className="text-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-300">Analizando ticket con IA...</p>
                </div>
            )}

            {step === 'review' && ticketData && (
                <TicketReviewForm
                    initialData={ticketData}
                    image={uploadedImageUrl}
                    onSave={handleSave}
                    onCancel={() => setStep('upload')}
                />
            )}
        </div>
    );
};
