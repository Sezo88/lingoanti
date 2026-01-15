'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtimeGame } from '@/hooks/useRealtimeGame'
import { submitGuess, switchTurn, finishGame, forfeitGame } from '@/lib/games'
import { isValidWord } from '@/lib/words'
import { evaluateGuess, isCorrectGuess } from '@/lib/gameLogic'
import { supabase } from '@/lib/supabase'
import GameBoard from '@/components/GameBoard'
import GameKeyboard from '@/components/GameKeyboard'
import JokerPanel from '@/components/JokerPanel'
import CurrencyDisplay from '@/components/CurrencyDisplay'
import type { LetterResult } from '@/lib/supabase'

export default function MultiplayerGamePage() {
    console.log('📄 SAYFA: /game/[gameId] - MultiplayerGamePage AÇILDI')
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
    const [roundEndMessage, setRoundEndMessage] = useState<string | null>(null)
    const [lastRoundWinner, setLastRoundWinner] = useState<string | null>(null)

    // Joker State
    const [maxAttempts, setMaxAttempts] = useState(6)
    const [usedJokers, setUsedJokers] = useState<Set<string>>(new Set())
    const [jokerLetters, setJokerLetters] = useState<{ position: number, letter: string, status: 'correct' | 'present' }[]>([])
    const [showJokerPanel, setShowJokerPanel] = useState(false)

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

    // Show overlay when round ends
    useEffect(() => {
        if (game?.round_message) {
            setRoundEndMessage(game.round_message)

            // Determine who won the last round based on score change
            // If message contains 🎉, someone won - check who has higher score
            if (game.round_message.includes('🎉')) {
                const myScore = isPlayer1 ? game.player1_score : game.player2_score
                const opponentScore = isPlayer1 ? game.player2_score : game.player1_score
                setLastRoundWinner(myScore > opponentScore ? user?.id || null : opponent || null)
            } else {
                setLastRoundWinner(null) // Draw
            }

            // Auto-dismiss after 3 seconds
            const timer = setTimeout(() => {
                setRoundEndMessage(null)
                setLastRoundWinner(null)
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [game?.round_message, isPlayer1, user?.id, opponent])

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

    // Joker Handler - Adapted from Practice Mode
    const handleJokerUsed = (jokerType: string, data: any) => {
        // Silently ignore if already used
        if (usedJokers.has(jokerType)) return

        if (jokerType === 'green_letter') {
            // Create array with SPACE characters (not empty strings!)
            const newGuess = Array(game.word_length).fill(' ')

            // Copy existing letters from current guess
            const current = currentGuess.split('')
            for (let i = 0; i < current.length && i < game.word_length; i++) {
                if (current[i] && current[i] !== ' ') {
                    newGuess[i] = current[i]
                }
            }

            // Place the joker letter at the EXACT position
            newGuess[data.position] = data.letter
            setCurrentGuess(newGuess.join(''))

            // Add to joker letters for coloring at CORRECT position
            setJokerLetters(prev => [...prev, { position: data.position, letter: data.letter, status: 'correct' }])
            setUsedJokers(prev => new Set(prev).add(jokerType))

        } else if (jokerType === 'yellow_letter') {
            // Find a wrong position to place the yellow letter
            const correctPositions: number[] = []
            for (let i = 0; i < game.target_word.length; i++) {
                if (game.target_word[i] === data.letter) correctPositions.push(i)
            }

            const wrongPositions: number[] = []
            for (let i = 0; i < game.word_length; i++) {
                if (!correctPositions.includes(i) && !currentGuess[i]) {
                    wrongPositions.push(i)
                }
            }

            if (wrongPositions.length > 0) {
                const randomWrongPos = wrongPositions[Math.floor(Math.random() * wrongPositions.length)]

                const newGuess = Array(game.word_length).fill(' ')
                const current = currentGuess.split('')
                for (let i = 0; i < current.length && i < game.word_length; i++) {
                    if (current[i] && current[i] !== ' ') {
                        newGuess[i] = current[i]
                    }
                }
                newGuess[randomWrongPos] = data.letter
                setCurrentGuess(newGuess.join(''))

                setJokerLetters(prev => [...prev, { position: randomWrongPos, letter: data.letter, status: 'present' }])
                setUsedJokers(prev => new Set(prev).add(jokerType))
            }

        } else if (jokerType === 'extra_attempt') {
            setMaxAttempts(prev => prev + 1)
            setUsedJokers(prev => new Set(prev).add(jokerType))

        } else if (jokerType === 'reveal_word') {
            setCurrentGuess(data.word)
            setUsedJokers(prev => new Set(prev).add(jokerType))
        }
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
            <header className="glass-effect border-b border-dark-200 w-full fixed top-0 z-40">
                <div className="container mx-auto px-3 py-2">
                    <div className="grid grid-cols-3 items-center gap-2">
                        {/* LEFT: Menu & Game Info */}
                        <div className="flex flex-col items-start gap-1">
                            <button
                                onClick={() => router.push('/')}
                                className="text-white/70 hover:text-white transition-colors text-xs flex items-center gap-1"
                            >
                                ← Çık
                            </button>
                            {!isGameOver && isMyTurn && (
                                <button
                                    onClick={async () => {
                                        if (confirm('Pes etmek istediğinize emin misiniz?')) {
                                            try {
                                                await forfeitGame(gameId, user!.id)
                                            } catch (e) {
                                                console.error(e)
                                            }
                                        }
                                    }}
                                    className="text-[10px] text-danger-400 hover:text-danger-300 font-semibold border border-danger-500/20 rounded px-1.5 py-0.5"
                                >
                                    🏳️ Pes Et
                                </button>
                            )}
                        </div>

                        {/* CENTER: Title & Score */}
                        <div className="text-center">
                            <h1 className="text-lg font-bold gradient-text leading-tight">
                                {game.word_length} Harfli
                            </h1>
                            <div className="text-xs text-white/60 leading-tight mb-1">
                                {game.best_of > 1 ? `Best of ${game.best_of} • El ${game.current_round}` : 'Tek El'}
                            </div>

                            {/* Score Badge */}
                            {game.best_of > 1 && (
                                <div className="inline-flex items-center gap-2 bg-dark-200/50 rounded-lg px-2 py-0.5 border border-white/10">
                                    <span className={`text-xs font-bold ${user?.id === game.player1_id ? 'text-primary-400' : 'text-white/50'}`}>
                                        {game.player1_score}
                                    </span>
                                    <span className="text-[10px] text-white/30">-</span>
                                    <span className={`text-xs font-bold ${user?.id === game.player2_id ? 'text-primary-400' : 'text-white/50'}`}>
                                        {game.player2_score}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Currency + Buttons (Practice Style) */}
                        <div className="flex items-center justify-end gap-2">
                            <CurrencyDisplay />
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={toggleFullscreen}
                                    className="text-white/80 hover:text-white transition-colors text-xl flex items-center justify-center w-8 h-8 bg-dark-200/50 rounded-lg"
                                >
                                    {isFullscreen ? '✕' : '⛶'}
                                </button>
                                {!isGameOver && isMyTurn && (
                                    <button
                                        onClick={() => setShowJokerPanel(!showJokerPanel)}
                                        className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center text-sm"
                                    >
                                        ✨
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>



            <main className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto w-full pt-[95px]">
                {/* Joker Panel */}
                {!isGameOver && isMyTurn && (
                    <JokerPanel
                        targetWord={game.target_word}
                        currentGuesses={allGuesses}
                        onJokerUsed={handleJokerUsed}
                        usedJokers={usedJokers}
                        showPanel={showJokerPanel}
                        onClose={() => setShowJokerPanel(false)}
                    />
                )}

                <div className="w-full max-w-md mx-auto">
                    <GameBoard
                        guesses={allGuesses}
                        currentGuess={isMyTurn ? currentGuess : ''}
                        wordLength={game.word_length}
                        maxGuesses={maxAttempts}
                        results={allResults}
                        jokerLetters={jokerLetters}
                    />


                    {/* Remove toast, use overlay instead */}

                    {/* Modern Answer Overlay - for game over OR round end */}
                    {(isGameOver || roundEndMessage) && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <div className="w-full max-w-sm bg-dark-100 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center">
                                <div className={`absolute top-0 left-0 w-full h-2 ${isGameOver
                                    ? (iWon ? 'bg-success-500' : 'bg-danger-500')
                                    : lastRoundWinner === user?.id
                                        ? 'bg-success-500'
                                        : lastRoundWinner
                                            ? 'bg-danger-500'
                                            : 'bg-warning-500'
                                    } shadow-[0_0_20px_rgba(var(--tw-colors-primary-500),0.5)]`}></div>

                                <div className="text-5xl mb-4 animate-bounce-subtle">
                                    {isGameOver
                                        ? (iWon ? '🎉' : '💔')
                                        : lastRoundWinner === user?.id
                                            ? '🎉'
                                            : lastRoundWinner
                                                ? '😔'
                                                : '😵'}
                                </div>

                                <h2 className={`text-2xl font-bold mb-1 ${isGameOver
                                    ? (iWon ? 'text-white' : 'text-danger-400')
                                    : lastRoundWinner === user?.id
                                        ? 'text-success-400'
                                        : lastRoundWinner
                                            ? 'text-danger-400'
                                            : 'text-warning-400'
                                    }`}>
                                    {isGameOver
                                        ? (iWon ? 'Tebrikler! 🎉' : game.winner_id ? 'Rakibiniz Kazandı!' : 'Berabere!')
                                        : lastRoundWinner === user?.id
                                            ? 'Tebrikler!'
                                            : lastRoundWinner
                                                ? 'Bir Daha Dene!'
                                                : 'Kimse Bulamadı!'}
                                </h2>

                                <p className="text-white/50 text-sm mb-6 uppercase tracking-widest font-semibold">
                                    Doğru Kelime:
                                </p>

                                <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/5">
                                    <p className={`text-3xl font-mono font-bold tracking-[0.2em] ${isGameOver
                                        ? (iWon ? 'text-success-400' : 'text-white')
                                        : 'text-warning-400'
                                        }`}>
                                        {game.target_word.toUpperCase()}
                                    </p>
                                </div>

                                {isGameOver && (
                                    <button
                                        onClick={() => router.push('/friends')}
                                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95 ${iWon
                                            ? 'bg-success-600 hover:bg-success-500 text-white shadow-success-500/20'
                                            : 'bg-white hover:bg-gray-100 text-black'
                                            }`}
                                    >
                                        Arkadaşlar 👥
                                    </button>
                                )}
                                {!isGameOver && roundEndMessage && (
                                    <div className="space-y-2">
                                        <p className="text-white/70 text-sm">Yeni el başlıyor...</p>
                                        <div className="flex gap-1 justify-center">
                                            <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse"></div>
                                            <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                            <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>


                {
                    !isGameOver && (
                        <div className="w-full max-w-md mx-auto pb-12">
                            <GameKeyboard
                                onKeyPress={handleKeyPress}
                                onEnter={handleEnter}
                                onBackspace={handleBackspace}
                                keyStates={keyboardState}
                                disabled={!isMyTurn}
                            />
                        </div>
                    )
                }
            </main >
        </div >
    )
}
