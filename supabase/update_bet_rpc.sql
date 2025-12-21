
-- Update RPC function to support organization_id
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION create_bet_with_legs(
    p_date TIMESTAMP WITH TIME ZONE,
    p_event TEXT,
    p_market TEXT,
    p_stake NUMERIC,
    p_odds NUMERIC,
    p_status TEXT,
    p_payout NUMERIC,
    p_image TEXT,
    p_legs JSONB,
    p_organization_id UUID -- Nueva columna obligatoria
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bet_id BIGINT;
    v_leg JSONB;
BEGIN
    -- Insert Bet
    INSERT INTO bets (
        user_id,
        organization_id, -- Insertar organization_id
        date,
        event,
        market,
        stake,
        odds,
        status,
        payout,
        image
    ) VALUES (
        auth.uid(),
        p_organization_id,
        p_date,
        p_event,
        p_market,
        p_stake,
        p_odds,
        p_status,
        p_payout,
        p_image
    )
    RETURNING id INTO v_bet_id;

    -- Insert Legs
    IF p_legs IS NOT NULL AND jsonb_array_length(p_legs) > 0 THEN
        FOR v_leg IN SELECT * FROM jsonb_array_elements(p_legs)
        LOOP
            INSERT INTO bet_legs (
                bet_id,
                sport,
                league,
                event,
                market,
                odds,
                status
            ) VALUES (
                v_bet_id,
                v_leg->>'sport',
                v_leg->>'league',
                v_leg->>'event',
                v_leg->>'market',
                (v_leg->>'odds')::numeric,
                v_leg->>'status'
            );
        END LOOP;
    END IF;

    RETURN v_bet_id;
END;
$$;
