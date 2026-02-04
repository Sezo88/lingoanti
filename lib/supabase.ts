import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Client-side Supabase client (Singleton)
// Uses cookies for session management (compatible with Next.js App Router & Server Actions)
export const supabase = createClientComponentClient()

// Database Types
export type User = {
    id: string
    email: string
    username: string
    display_name: string
    avatar_url?: string
    created_at: string
    last_seen: string
}

export type Friendship = {
    id: string
    user_id: string
    friend_id: string
    status: 'pending' | 'accepted'
    created_at: string
}

export type Word = {
    id: string
    word: string
    length: number
    created_at: string
}

export type Game = {
    id: string
    player1_id: string
    player2_id: string
    word_length: number
    target_word: string
    current_turn: string | null
    status: 'waiting' | 'active' | 'finished'
    winner_id: string | null
    best_of: 1 | 3 | 5 | 7
    current_round: number
    player1_score: number
    player2_score: number
    mixed_mode: boolean
    round_message: string | null
    created_at: string
    finished_at: string | null
    forfeited_by?: string
}

export type GameMove = {
    id: string
    game_id: string
    player_id: string
    guess: string
    result: LetterResult[]
    move_number: number
    created_at: string
}

export type LetterResult = {
    letter: string
    status: 'correct' | 'present' | 'absent' | 'invalid'
}

// Tournament Types
export type TournamentLobby = {
    id: string
    lobby_code: string
    leader_id: string
    game_mode: 'arena' | 'turn_based'
    status: 'waiting' | 'searching' | 'matched'
    created_at: string
}

export type TournamentLobbyMember = {
    id: string
    lobby_id: string
    user_id: string
    joined_at: string
}

export type TournamentQueue = {
    id: string
    lobby_id?: string
    user_id?: string
    game_mode: 'arena' | 'turn_based'
    is_team: boolean
    created_at: string
}

export type TournamentWaitingRoom = {
    id: string
    room_id: string
    game_mode: 'arena' | 'turn_based'
    min_players: number
    max_players: number
    current_players: number
    countdown_started_at?: string
    status: 'filling' | 'countdown' | 'started'
    created_at: string
}
