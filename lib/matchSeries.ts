import { supabase } from './supabase'
import { getRandomWord } from './words'

/**
 * Bir eli bitir ve skoru güncelle
 */
export async function finishRound(
    gameId: string,
    winnerId: string | null
): Promise<{ success: boolean; error: any }> {
    // Önce mevcut oyun bilgisini al
    const { data: game, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

    if (fetchError || !game) {
        return { success: false, error: fetchError }
    }

    // Skoru güncelle
    let player1Score = game.player1_score
    let player2Score = game.player2_score

    if (winnerId === game.player1_id) {
        player1Score++
    } else if (winnerId === game.player2_id) {
        player2Score++
    }

    const { error } = await supabase
        .from('games')
        .update({
            player1_score: player1Score,
            player2_score: player2Score
        })
        .eq('id', gameId)

    return { success: !error, error }
}

/**
 * Sonraki eli başlat (yeni kelime)
 */
export async function startNextRound(gameId: string): Promise<{ success: boolean; error: any }> {
    // Oyun bilgisini al
    const { data: game, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

    if (fetchError || !game) {
        return { success: false, error: fetchError }
    }

    // Karışık mod: Her elde farklı uzunluk (4-7)
    const newLength = game.mixed_mode
        ? Math.floor(Math.random() * 4) + 4
        : game.word_length

    const newWord = await getRandomWord(newLength)

    if (!newWord) {
        return { success: false, error: new Error('Kelime seçilemedi') }
    }

    // Yeni eli başlat - Sırayı değiştir (alternating turns)
    const nextStarter = game.current_round % 2 === 0 ? game.player2_id : game.player1_id

    const { error } = await supabase
        .from('games')
        .update({
            current_round: game.current_round + 1,
            target_word: newWord,
            word_length: newLength, // Karışık modda her el farklı
            current_turn: nextStarter, // Sırayla başlangıç
            status: 'active' // Yeni el aktif
        })
        .eq('id', gameId)

    return { success: !error, error }
}

/**
 * Maçın bitip bitmediğini kontrol et
 */
export function isMatchFinished(
    player1Score: number,
    player2Score: number,
    bestOf: number
): { isFinished: boolean; winnerId: string | null } {
    const requiredWins = Math.ceil(bestOf / 2)

    if (player1Score >= requiredWins) {
        return { isFinished: true, winnerId: 'player1' }
    }

    if (player2Score >= requiredWins) {
        return { isFinished: true, winnerId: 'player2' }
    }

    return { isFinished: false, winnerId: null }
}
