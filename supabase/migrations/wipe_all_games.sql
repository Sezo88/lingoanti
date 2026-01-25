-- WIPE ALL GAME DATA
-- This script removes all active games, rooms, tournaments, and queues.
-- It keeps Users and Words.

TRUNCATE TABLE 
    room_participants,
    tournament_queue,
    tournament_lobby_members,
    tournament_lobbies,
    tournament_waiting_rooms,
    rooms
CASCADE;
