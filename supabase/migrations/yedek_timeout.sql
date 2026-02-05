-- ESKİ HALİ (Yedek)
create or replace function handle_turn_timeout(
  p_room_id uuid,
  p_user_id uuid
)
returns void as $$
declare
  v_room rooms%rowtype;
  v_game_state jsonb;
  v_config jsonb;
  v_turn_order uuid[];
  v_current_turn int;
  v_current_player uuid;
  v_timeout_result jsonb;
  v_word_length int;
begin
  select * into v_room from rooms where id = p_room_id for update;
  v_config := v_room.config;
  v_game_state := coalesce(v_room.game_state, '{"guesses": [], "results": [], "currentWordIndex": 0}'::jsonb);
  v_current_turn := (v_config->>'currentTurn')::int;
  
  -- ... (Ara işlemler aynı) ...
  
  -- ESKİ (Sade) Increment Mantığı
  update rooms
  set config = jsonb_set(
      jsonb_set(v_config, '{currentTurn}', to_jsonb(v_current_turn + 1)), -- Burası hatalıydı ama eski hali buydu
      '{turnStartTime}', to_jsonb((extract(epoch from now()) * 1000)::bigint)
  )
  where id = p_room_id;
end;
$$ language plpgsql security definer;