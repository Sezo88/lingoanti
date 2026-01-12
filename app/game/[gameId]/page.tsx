'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtimeGame } from '@/hooks/useRealtimeGame'
import { submitGuess, switchTurn, finishGame, forfeitGame } from '@/lib/games'
import { isValidWord } from '@/lib/words'
import { evaluateGuess, isCorrectGuess } from '@/lib/gameLogic'
import { supabase } from '@/lib/supabase'
import GameBoard from '@/components/GameBoard'
import GameKeyboard from '@/components/GameKeyboard'
import type { LetterResult } from '@/lib/supabase'

export default function MultiplayerGamePage() {
    const params = useParams()
    const gameId = params?.gameId as string
    const { user } = useAuth()
    const router = useRouter()

    const { game, moves, loading } = useRealtimeGame(gameId)

    const [currentGuess, setCurrentGuess] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showAnswerOverlay, setShowAnswerOverlay] = useState(false)

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const isPlayer1 = user?.id === game?.player1_id
    const isMyTurn = game?.current_turn === user?.id
    const opponent = isPlayer1 ? game?.player2_id : game?.player1_id

    const totalMoves = moves.length

    const allGuesses = moves.map(m => m.guess)
    const allResults = moves.map(m => m.result as LetterResult[])

    const handleKeyPress = (key: string) => {
        if (!isMyTurn || currentGuess.length >= (game?.word_length || 5)) return
        setCurrentGuess(prev => prev + key)
    }

    const handleBackspace = () => {
        setCurrentGuess(prev => prev.slice(0, -1))
    }

    const handleEnter = async () => {
        if (!game || !user) return
        if (currentGuess.length !== game.word_length) {
            setError(`${game.word_length} harfli kelime giriniz`)
            setTimeout(() => setError(''), 2000)
            return
        }

        const valid = await isValidWord(currentGuess)
        if (!valid) {
            setError('Geçersiz kelime! Hak kaybettiniz.')

            const invalidResult = currentGuess.split('').map(letter => ({
                letter,
                status: 'invalid' as const
            }))

            setSubmitting(true)
            await submitGuess(gameId, user.id, currentGuess, invalidResult)
            setCurrentGuess('')

            // 6. hamle bitti - kimse kazanamadı
            if (totalMoves + 1 >= 6) {
                const { finishRound, isMatchFinished, startNextRound } = await import('@/lib/matchSeries')
                await finishRound(gameId, null) // Beraberlik

                // Mesajı göster
                await supabase
                    .from('games')
                    .update({ round_message: `✋ Kimse bulamadı! Kelime: ${game.target_word.toUpperCase()}` })
                    .eq('id', gameId)

                const updatedGame = await supabase.from('games').select('*').eq('id', gameId).single()
                if (updatedGame.data) {
                    const matchResult = isMatchFinished(updatedGame.data.player1_score, updatedGame.data.player2_score, game.best_of)

                    if (!matchResult.isFinished) {
                        // Yeni el başlat
                        await new Promise(resolve => setTimeout(resolve, 3000))
                        await startNextRound(gameId)
                        await supabase.from('games').update({ round_message: null }).eq('id', gameId)
                    } else {
                        // Maç bitti
                        await finishGame(gameId, matchResult.winnerId === 'player1' ? updatedGame.data.player1_id : updatedGame.data.player2_id)
                    }
                }
            } else {
                await switchTurn(gameId, opponent!)
            }

            setSubmitting(false)
            setTimeout(() => setError(''), 3000)
            return
        }

        const evalResult = evaluateGuess(currentGuess, game.target_word)

        setSubmitting(true)
        await submitGuess(gameId, user.id, currentGuess, evalResult)
        setCurrentGuess('')

        // Kelimeyi buldu!
        if (isCorrectGuess(currentGuess, game.target_word)) {
            const { finishRound, isMatchFinished, startNextRound } = await import('@/lib/matchSeries')
            await finishRound(gameId, user.id)

            const updatedGame = await supabase.from('games').select('*').eq('id', gameId).single()
            if (updatedGame.data) {
                const player1Score = user.id === updatedGame.data.player1_id ? updatedGame.data.player1_score : updatedGame.data.player2_score
                const player2Score = user.id === updatedGame.data.player1_id ? updatedGame.data.player2_score : updatedGame.data.player1_score

                const matchResult = isMatchFinished(player1Score, player2Score, game.best_of)

                if (matchResult.isFinished) {
                    await finishGame(gameId, user.id)
                } else {
                    // Mesajı database'e kaydet (her iki oyuncu görecek)
                    await supabase
                        .from('games')
                        .update({ round_message: `🎉 El bitti! Skor: ${player1Score}-${player2Score}` })
                        .eq('id', gameId)

                    await new Promise(resolve => setTimeout(resolve, 3000))
                    await startNextRound(gameId)

                    // Mesajı temizle
                    await supabase.from('games').update({ round_message: null }).eq('id', gameId)
                }
            }

            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100])
        } else if (totalMoves + 1 >= 6) {
            // 6. hamle - kimse bulamadı, berabere
            const { finishRound, isMatchFinished, startNextRound } = await import('@/lib/matchSeries')
            await finishRound(gameId, null)

            // Mesajı database'e kaydet (her iki oyuncu görecek)
            await supabase
                .from('games')
                .update({ round_message: `✋ Kimse bulamadı! Kelime: ${game.target_word.toUpperCase()}` })
                .eq('id', gameId)

            const updatedGame = await supabase.from('games').select('*').eq('id', gameId).single()
            if (updatedGame.data) {
                const matchResult = isMatchFinished(updatedGame.data.player1_score, updatedGame.data.player2_score, game.best_of)

                if (!matchResult.isFinished) {
                    await new Promise(resolve => setTimeout(resolve, 3000))
                    await startNextRound(gameId)
                    await supabase.from('games').update({ round_message: null }).eq('id', gameId)
                } else {
                    await finishGame(gameId, matchResult.winnerId === 'player1' ? updatedGame.data.player1_id : updatedGame.data.player2_id)
                }
            }

            if (navigator.vibrate) navigator.vibrate(500)
        } else {
            // Sıra değiştir
            await switchTurn(gameId, opponent!)
        }

        setSubmitting(false)
    }

    const getKeyboardStateFromResults = (results: LetterResult[][]): Map<string, 'correct' | 'present' | 'absent'> => {
        const keyState = new Map<string, 'correct' | 'present' | 'absent'>()
        results.forEach(guessResult => {
            guessResult.forEach(({ letter, status }) => {
                if (status === 'invalid') return
                const currentStatus = keyState.get(letter)
                if (status === 'correct') {
                    keyState.set(letter, 'correct')
                } else if (status === 'present' && currentStatus !== 'correct') {
                    keyState.set(letter, 'present')
                } else if (!currentStatus && status === 'absent') {
                    keyState.set(letter, status)
                }
            })
        })
        return keyState
    }

    const keyboardState = getKeyboardStateFromResults(allResults)

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-dark-500">Oyun yükleniyor...</p>
                </div>
            </div>
        )
    }

    if (!game) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-danger-500">Oyun bulunamadı</p>
                    <button
                        onClick={() => router.push('/')}
                        className="mt-4 px-6 py-3 rounded-xl bg-primary-600 text-white font-semibold"
                    >
                        Ana Sayfa
                    </button>
                </div>
            </div>
        )
    }

    const isGameOver = game.status === 'finished'
    const iWon = game.winner_id === user?.id

    return (
        <div className="min-h-screen max-h-screen flex flex-col overflow-hidden">
            <header className="glass-effect border-b border-dark-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <button onClick={() => router.push('/')} className="text-dark-500 hover:text-white transition-colors">
                            ← Çık
                        </button>
                        {!isGameOver && isMyTurn && (
                            <button
                                onClick={() => {
                                    if (confirm('Pes etmek istediğinize emin misiniz? Rakibiniz kazanacak.')) {
                                        forfeitGame(gameId, user!.id)
                                    }
                                }}
                                className="text-danger-400 hover:text-danger-300 transition-colors text-sm font-semibold"
                            >
                                🏳️ Pes Et
                            </button>
                        )}
                        <div className="text-center">
                            <p className="text-xs text-dark-500">
                                {game.best_of > 1 ? `Best of ${game.best_of} - El ${game.current_round}` : 'Tek El'}
                            </p>
                            <p className="font-semibold">{game.word_length} Harfli Kelime</p>
                            {game.best_of > 1 && (
                                <p className="text-xs text-primary-500 font-bold">
                                    {game.player1_score} - {game.player2_score}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={toggleFullscreen}
                            className="text-dark-400 hover:text-white transition-colors text-2xl flex items-center justify-center w-10 h-10"
                            title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
                        >
                            {isFullscreen ? '⊗' : '⛶'}
                        </button>
                    </div>

                    {!isGameOver && (
                        <div className="text-center">
                            <div className={`inline-block px-4 py-2 rounded-lg ${isMyTurn ? 'bg-success-600' : 'bg-warning-600'}`}>
                                <p className="text-white font-semibold text-sm">
                                    {isMyTurn ? '✨ Senin Sıran!' : '⏳ Rakip oynuyor...'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto">
                <div className="w-full max-w-md mx-auto">
                    <GameBoard
                        guesses={allGuesses}
                        currentGuess={isMyTurn ? currentGuess : ''}
                        wordLength={game.word_length}
                        maxGuesses={6}
                        results={allResults}
                    />


                    {(error || game.round_message) && (
                        <div className="text-center mb-4 animate-pulse">
                            <div className={`border-2 px-4 py-3 rounded-xl font-semibold ${error
                                ? 'bg-danger-500/20 border-danger-500 text-danger-400'
                                : 'bg-primary-500/20 border-primary-500 text-primary-300'
                                }`}>
                                {error || game.round_message}
                            </div>
                        </div>
                    )}

                    {/* Modern Answer Overlay */}
                    {(isGameOver || showAnswerOverlay) && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <div className="w-full max-w-sm bg-dark-100 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center">
                                <div className={`absolute top-0 left-0 w-full h-2 ${iWon ? 'bg-success-500' : 'bg-danger-500'} shadow-[0_0_20px_rgba(var(--tw-colors-primary-500),0.5)]`}></div>

                                <div className="text-5xl mb-4 animate-bounce-subtle">
                                    {iWon ? '🎉' : '💔'}
                                </div>

                                <h2 className={`text-2xl font-bold mb-1 ${iWon ? 'text-white' : 'text-danger-400'}`}>
                                    {iWon ? 'Tebrikler!' : 'Maalesef...'}
                                </h2>

                                <p className="text-white/50 text-sm mb-6 uppercase tracking-widest font-semibold">
                                    {iWon ? 'Harika İş Çıkardın' : 'Doğru Kelime:'}
                                </p>

                                <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/5">
                                    <p className={`text-3xl font-mono font-bold tracking-[0.2em] ${iWon ? 'text-success-400' : 'text-white'}`}>
                                        {game.target_word.toUpperCase()}
                                    </p>
                                </div>

                                <button
                                    onClick={() => router.push('/friends')}
                                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95 ${iWon
                                        ? 'bg-success-600 hover:bg-success-500 text-white shadow-success-500/20'
                                        : 'bg-white hover:bg-gray-100 text-black'
                                        }`}
                                >
                                    Arkadaşlar 👥
                                </button>
                            </div>
                        </div>
                    )}
                </div>


                {
                    !isGameOver && isMyTurn && (
                        <div className="w-full max-w-md mx-auto pb-12">
                            <GameKeyboard
                                onKeyPress={handleKeyPress}
                                onEnter={handleEnter}
                                onBackspace={handleBackspace}
                                keyStates={keyboardState}
                            />
                        </div>
                    )
                }
            </main >
        </div >
    )
}
