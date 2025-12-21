import { useState, useEffect, useCallback } from 'react';
import { Bet, BetStatus, BetLeg } from '../types';
import { supabase } from '../services/supabaseService';
import { useAuth } from './useAuth';
import { useOrganization } from '../contexts/OrganizationContext';

// Tipo para una nueva apuesta que viene del formulario, antes de tener IDs de la base de datos.
type NewBetData = Omit<Bet, 'id' | 'user_id' | 'payout'>;

export const useBets = () => {
  const { user } = useAuth();
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBets = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setBets([]);
      return;
    };

    // Si la organización aún está cargando o no existe, no intentamos hacer fetch para evitar error de UUID inválido
    if (orgLoading) return;

    if (!currentOrg) {
      setLoading(false);
      setBets([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bets')
        .select('*, bet_legs(*)')
        .eq('organization_id', currentOrg.id) // Non-optional access since we checked above
        .order('date', { ascending: false });

      if (error) throw error;

      // Mapea 'bet_legs' de Supabase a 'legs' en nuestro tipo Bet para mantener la consistencia.
      const formattedBets = data.map(bet => ({
        ...bet,
        legs: (bet as any).bet_legs,
      })) as Bet[];

      setBets(formattedBets);
    } catch (error) {
      console.error('Error al cargar las apuestas desde Supabase', error);
      setBets([]); // Limpiar en caso de error
    } finally {
      setLoading(false);
    }
  }, [user, currentOrg, orgLoading]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  const addBet = async (newBetData: NewBetData) => {
    if (!user || !currentOrg) throw new Error("Usuario no autenticado o sin organización.");

    const payout = newBetData.status === BetStatus.Won ? newBetData.stake * newBetData.odds : 0;

    // Prepara la carga útil para la función RPC, asegurando la atomicidad de la operación.
    const payload = {
      p_date: newBetData.date,
      p_event: newBetData.event,
      p_market: newBetData.market,
      p_stake: newBetData.stake,
      p_odds: newBetData.odds,
      p_status: newBetData.status,
      p_payout: payout,
      p_image: newBetData.image || null,
      p_legs: newBetData.legs || [],
      p_organization_id: currentOrg?.id
    };

    // Llama a la función de la base de datos para crear la apuesta y sus selecciones en una sola transacción.
    const { data: newBetId, error } = await supabase.rpc('create_bet_with_legs', payload);

    if (error) {
      console.error('Error al crear la apuesta con RPC:', error);
      throw error;
    }

    // Actualiza el estado local de forma optimista con la nueva apuesta completa.
    const fullNewBet: Bet = {
      id: newBetId,
      user_id: user.id,
      ...newBetData,
      payout,
    };
    setBets(prevBets => [fullNewBet, ...prevBets].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const deleteBet = async (betId: number) => {
    // Actualización optimista de la UI
    setBets(prevBets => prevBets.filter(bet => bet.id !== betId));

    const { error } = await supabase.from('bets').delete().eq('id', betId);

    if (error) {
      console.error('Error al eliminar la apuesta:', error);
      // Si la eliminación falla, se recargan las apuestas para revertir el cambio en la UI.
      await fetchBets();
    }
  };

  return { bets, addBet, deleteBet };
};