import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';

export function usePresentationMode() {
    const [presentationMode, setPresentationMode] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await supabase
                    .from('system_settings')
                    .select('value')
                    .eq('key', 'presentation_mode')
                    .single();

                if (data) {
                    setPresentationMode(!!data.value);
                }
            } catch {
                // Si no existe el setting, modo presentacion = false
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    return { presentationMode, loading };
}
