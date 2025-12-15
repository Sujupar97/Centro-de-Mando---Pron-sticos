import { useState, useEffect } from 'react';

export const useSettings = () => {
  const [initialCapital, setInitialCapital] = useState<number>(() => {
    try {
      const storedCapital = window.localStorage.getItem('sportsBettingCapital');
      return storedCapital ? JSON.parse(storedCapital) : 0;
    } catch (error) {
      console.error('Error al leer el capital desde localStorage', error);
      return 0;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('sportsBettingCapital', JSON.stringify(initialCapital));
    } catch (error) {
      console.error('Error al guardar el capital en localStorage', error);
    }
  }, [initialCapital]);

  return { initialCapital, setInitialCapital };
};