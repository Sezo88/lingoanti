import { supabase } from './supabase'
import type { Game } from './supabase'
import { getRandomWord } from './words'

/**
 * Yeni oyun daveti oluştur (pending status)
 */
export async function createGame(
    player1Id: string,
    player2Id: string,
    wordLength: number = 5,
    bestOf: 1 | 3 | 5 | 7 = 1,
    duration: number = 60
): Promise<{ game: Game | null; error: any }> {
    const isMixed = wordLength === 0
    const actualLength = isMixed ? Math.floor(Math.random() * 4) + 4 : wordLength

    const targetWord = await getRandomWord(actualLength)

    if (!targetWord) {
        return { game: null, error: new Error('Kelime seçilemedi') }
    }

    const { data, error } = await supabase
        .from('games')
        .insert({
            player1_id: player1Id,
            player2_id: player2Id,
            word_length: actualLength,
            target_word: targetWord,
            current_turn: player1Id,
            status: 'waiting',
            best_of: bestOf,
            current_round: 1,
            player1_score: 0,
            player2_score: 0,
            mixed_mode: isMixed,
            duration: duration
        })
        .select()
        .single()

    return { game: data, error }
}

/**
 * Oyuna tahmin ekle
 */
export async function submitGuess(
    gameId: string,
    playerId: string,
    guess: string,
    result: any[]
): Promise<{ success: boolean; error: any }> {
    // Get fresh game data to ensure correct round_number
    const { data: game } = await supabase
        .from('games')
        .select('current_round')
        .eq('id', gameId)
        .single()

    if (!game) {
        return { success: false, error: new Error('Oyun bulunamadı') }
    }

    // Get current move count for this round
    const { data: existingMoves } = await supabase
        .from('game_moves')
        .select('move_number')
        .eq('game_id', gameId)
        .eq('round_number', game.current_round)
        .order('move_number', { ascending: false })
        .limit(1)

    const moveNumber = existingMoves && existingMoves.length > 0 ? existingMoves[0].move_number + 1 : 1

    const { error } = await supabase
        .from('game_moves')
        .insert({
            game_id: gameId,
            player_id: playerId,
            guess,
            result,
            move_number: moveNumber,
            round_number: game.current_round // Use fresh current_round
        })

    return { success: !error, error }
}

/**
 * Oyunun sırasını değiştir
 */
export async function switchTurn(
    gameId: string,
    nextPlayerId: string
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('games')
        .update({ current_turn: nextPlayerId })
        .eq('id', gameId)

    return { success: !error, error }
}

/**
 * Oyunu bitir ve kazananı belirle
 */
export async function finishGame(
    gameId: string,
    winnerId: string | null
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('games')
        .update({
            status: 'finished',
            winner_id: winnerId,
            finished_at: new Date().toISOString()
        })
        .eq('id', gameId)

    return { success: !error, error }
}

/**
 * Oyundan pes et
 */
export async function forfeitGame(
    gameId: string,
    userId: string
): Promise<{ success: boolean; error: any }> {
    // Oyun bilgisini al
    const { data: game } = await supabase
        .from('games')
        .select('player1_id, player2_id')
        .eq('id', gameId)
        .single()

    if (!game) {
        return { success: false, error: new Error('Oyun bulunamadı') }
    }

    // Karşı oyuncu kazansın
    const winnerId = game.player1_id === userId ? game.player2_id : game.player1_id

    const { error } = await supabase
        .from('games')
        .update({
            status: 'finished',
            winner_id: winnerId,
            forfeited_by: userId,
            finished_at: new Date().toISOString()
        })
        .eq('id', gameId)

    return { success: !error, error }
}

/**
 * Oyun detaylarını getir
 */
export async function getGame(gameId: string): Promise<{ game: Game | null; error: any }> {
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

    return { game: data, error }
}

/**
 * Oyunun tüm hamlelerini getir
 */
export async function getGameMoves(gameId: string): Promise<{ moves: any[]; error: any }> {
    const { data, error } = await supabase
        .from('game_moves')
        .select('*')
        .eq('game_id', gameId)
        .order('move_number', { ascending: true })

    return { moves: data || [], error }
}

/**
 * Oyun davetini kabul et
 */
export async function acceptGameInvite(
    gameId: string
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('games')
        .update({ status: 'active' })
        .eq('id', gameId)

    return { success: !error, error }
}

/**
 * Oyun davetini reddet
 */
export async function rejectGameInvite(
    gameId: string
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId)

    return { success: !error, error }
}

/**
 * Gönderilen oyun davetini iptal et (sadece gönderen iptal edebilir)
 */
export async function cancelGameInvite(
    gameId: string,
    userId: string
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase.rpc('cancel_game_invite', {
        p_game_id: gameId,
        p_user_id: userId
    })

    return { success: !error, error }
}

/**
 * Kullanıcının aktif oyunlarını getir
 */
export async function getActiveGames(userId: string): Promise<{ games: Game[]; error: any }> {
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })

    return { games: data || [], error }
}

/**
 * Kullanıcının tamamlanmış oyunlarını getir
 */
export async function getCompletedGames(userId: string): Promise<{ games: Game[]; error: any }> {
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq('status', 'finished')
        .order('finished_at', { ascending: false })
        .limit(20)

    return { games: data || [], error }
}
