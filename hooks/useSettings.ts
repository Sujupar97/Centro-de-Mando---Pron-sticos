import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { useAuth } from './useAuth';

export const useSettings = () => {
  const { session } = useAuth();
  const [initialCapital, setInitialCapital] = useState<number>(() => {
    try {
      const storedCapital = window.localStorage.getItem('sportsBettingCapital');
      return storedCapital ? JSON.parse(storedCapital) : 0;
    } catch (error) {
      console.error('Error al leer el capital desde localStorage', error);
      return 0;
    }
  });

  // Cargar desde Supabase al iniciar sesión
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('initial_capital')
          .eq('id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // Ignorar error si no encuentra fila (aunque debería existir)
          console.error('Error cargando settings:', error);
          return;
        }

        if (data && data.initial_capital !== null && data.initial_capital !== undefined) {
          setInitialCapital(data.initial_capital);
          // Sincronizar localStorage
          window.localStorage.setItem('sportsBettingCapital', JSON.stringify(data.initial_capital));
        }
      } catch (err) {
        console.error('Excepción cargando settings:', err);
      }
    };

    loadSettings();
  }, [session?.user?.id]);

  // Guardar cambios en Supabase y LocalStorage
  const saveCapital = async (newCapital: number) => {
    setInitialCapital(newCapital);
    window.localStorage.setItem('sportsBettingCapital', JSON.stringify(newCapital));

    if (session?.user?.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ initial_capital: newCapital })
          .eq('id', session.user.id);

        if (error) throw error;
      } catch (err) {
        console.error('Error guardando settings en Supabase:', err);
      }
    }
  };

  return { initialCapital, setInitialCapital: saveCapital };
};