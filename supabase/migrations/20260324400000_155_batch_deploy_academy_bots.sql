-- Migration 155: Batch academy bot deployment RPC
-- Batch-inserts bot_players + epoch_participants in one atomic call.
-- Auto-drafting is handled by Python (personality-based aptitude scoring).
-- Called from academy_service._populate_academy_bots().

CREATE OR REPLACE FUNCTION public.fn_deploy_academy_bots(
    p_epoch_id     UUID,
    p_user_id      UUID,
    p_human_sim_id UUID,
    p_bot_sim_ids  UUID[],        -- template sim IDs for bots (length = bot_count)
    p_difficulty   TEXT DEFAULT 'easy',
    p_personalities TEXT[] DEFAULT ARRAY['sentinel','warlord','diplomat','strategist']
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_bot_row     RECORD;
    v_participant RECORD;
    v_bots        JSONB := '[]'::JSONB;
    v_idx         INT := 0;
    v_personality TEXT;
    v_bot_id      UUID;
BEGIN
    -- 1. Validate epoch is in lobby
    IF NOT EXISTS (
        SELECT 1 FROM public.game_epochs
        WHERE id = p_epoch_id AND status = 'lobby'
    ) THEN
        RETURN jsonb_build_object(
            'error_code', 'EPOCH_NOT_LOBBY',
            'user_message', 'Epoch is not in lobby phase.'
        );
    END IF;

    -- 2. Insert human participant
    INSERT INTO public.epoch_participants (epoch_id, simulation_id, user_id)
    VALUES (p_epoch_id, p_human_sim_id, p_user_id)
    ON CONFLICT DO NOTHING;

    -- 3. Batch create bots + participants
    FOREACH v_bot_id IN ARRAY p_bot_sim_ids LOOP
        v_personality := p_personalities[(v_idx % array_length(p_personalities, 1)) + 1];

        -- Create bot player
        INSERT INTO public.bot_players (name, personality, difficulty, created_by_id)
        VALUES (
            'Academy ' || initcap(v_personality),
            v_personality,
            p_difficulty,
            p_user_id
        )
        RETURNING * INTO v_bot_row;

        -- Add as epoch participant (is_bot flag for identification)
        INSERT INTO public.epoch_participants (epoch_id, simulation_id, is_bot, bot_player_id)
        VALUES (p_epoch_id, v_bot_id, TRUE, v_bot_row.id)
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_participant;

        v_bots := v_bots || jsonb_build_object(
            'bot_player_id', v_bot_row.id,
            'participant_id', v_participant.id,
            'simulation_id', v_bot_id,
            'personality', v_personality
        );

        v_idx := v_idx + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'deployed_count', jsonb_array_length(v_bots),
        'bots', v_bots
    );
END;
$$;

COMMENT ON FUNCTION public.fn_deploy_academy_bots IS
    'Atomic batch deployment of academy bots — creates bot_players and epoch_participants. Auto-drafting is handled by Python caller.';
