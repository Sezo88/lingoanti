'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GameBoard from '@/components/GameBoard'
import GameKeyboard from '@/components/GameKeyboard'
import { getRandomWord, isValidWord } from '@/lib/words'
import { evaluateGuess, isCorrectGuess, getKeyboardState } from '@/lib/gameLogic'
import type { LetterResult } from '@/lib/supabase'

export default function PracticePage() {
    const router = useRouter()
    const [wordLength, setWordLength] = useState(5) // Başlangıç için 5 harf
    const [targetWord, setTargetWord] = useState<string>('')
    const [guesses, setGuesses] = useState<string[]>([])
    const [currentGuess, setCurrentGuess] = useState('')
    const [results, setResults] = useState<LetterResult[][]>([])
    const [gameOver, setGameOver] = useState(false)
    const [won, setWon] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [isFullscreen, setIsFullscreen] = useState(false)

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    // Oyun başlat
    useEffect(() => {
        startNewGame()
    }, [])

    const startNewGame = async () => {
        setLoading(true)
        const word = await getRandomWord(wordLength)

        if (!word) {
            setError('Kelime yüklenemedi. Lütfen tekrar deneyin.')
            setLoading(false)
            return
        }

        setTargetWord(word)
        setGuesses([])
        setCurrentGuess('')
        setResults([])
        setGameOver(false)
        setWon(false)
        setError('')
        setLoading(false)
    }

    const handleKeyPress = (key: string) => {
        if (gameOver || currentGuess.length >= wordLength) return
        setCurrentGuess(prev => prev + key)
    }

    const handleBackspace = () => {
        setCurrentGuess(prev => prev.slice(0, -1))
    }

    const handleEnter = async () => {
        if (currentGuess.length !== wordLength) {
            setError(`${wordLength} harfli kelime giriniz`)
            setTimeout(() => setError(''), 2000)
            return
        }

        // Kelime kontrolü - Türkçe kelime listesinde var mı?
        const valid = await isValidWord(currentGuess)
        if (!valid) {
            setError('Geçersiz kelime! Hak kaybettiniz.')

            // Geçersiz kelimeyi kaydet (KIRMIZI gösterim için)
            const invalidResult = currentGuess.split('').map(letter => ({
                letter,
                status: 'invalid' as const
            }))
            const newGuesses = [...guesses, currentGuess]
            const newResults = [...results, invalidResult]

            setGuesses(newGuesses)
            setResults(newResults)
            setCurrentGuess('')

            // Vibrate for error
            if (navigator.vibrate) {
                navigator.vibrate([50, 50, 50])
            }

            setTimeout(() => setError(''), 3000)

            // Oyun bitti mi kontrol et
            if (newGuesses.length >= 6) {
                setGameOver(true)
                setWon(false)
            }
            return
        }

        // Tahmini değerlendir
        const evalResult = evaluateGuess(currentGuess, targetWord)
        const newGuesses = [...guesses, currentGuess]
        const newResults = [...results, evalResult]

        setGuesses(newGuesses)
        setResults(newResults)
        setCurrentGuess('')

        // Oyun bitti mi kontrol et
        if (isCorrectGuess(currentGuess, targetWord)) {
            setWon(true)
            setGameOver(true)

            // Haptic feedback (mobil)
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100, 50, 100])
            }
        } else if (newGuesses.length >= 6) {
            setGameOver(true)
            setWon(false)

            if (navigator.vibrate) {
                navigator.vibrate(500)
            }
        }
    }

    const keyboardState = getKeyboardState(results)

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-dark-500">Oyun hazırlanıyor...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex flex-col">
            {/* Header */}
            <header className="glass-effect border-b border-dark-200">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/')}
                        className="text-dark-500 hover:text-white transition-colors"
                    >
                        ← Geri
                    </button>
                    <h1 className="text-xl font-bold gradient-text">Pratik Modu</h1>
                    <button
                        onClick={toggleFullscreen}
                        className="text-dark-400 hover:text-white transition-colors text-2xl flex items-center justify-center w-10 h-10"
                        title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
                    >
                        {isFullscreen ? '⊗' : '⛶'}
                    </button>
                    <button
                        onClick={startNewGame}
                        className="text-primary-500 font-semibold hover:text-primary-400 transition-colors"
                    >
                        Yeni
                    </button>
                </div>
            </header>

            {/* Game Area */}
            <main className="flex-1 flex flex-col justify-between p-4 pb-0">
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-md">
                        {/* Game Board */}
                        <GameBoard
                            guesses={guesses}
                            currentGuess={currentGuess}
                            wordLength={wordLength}
                            maxGuesses={6}
                            results={results}
                        />

                        {/* Error Message */}
                        {error && (
                            <div className="text-center mb-4 animate-pulse">
                                <div className="bg-danger-500/20 border-2 border-danger-500 text-danger-400 px-4 py-3 rounded-xl font-semibold">
                                    {error}
                                </div>
                            </div>
                        )}

                        {/* Game Over Message */}
                        {gameOver && (
                            <div className="text-center mb-6">
                                {won ? (
                                    <div className="glass-effect rounded-2xl p-6">
                                        <p className="text-3xl mb-2">🎉</p>
                                        <h2 className="text-2xl font-bold text-success-500 mb-2">Kazandın!</h2>
                                        <p className="text-dark-500">
                                            {guesses.length} tahminde bildin
                                        </p>
                                        <button
                                            onClick={startNewGame}
                                            className="mt-4 px-6 py-3 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all"
                                        >
                                            Tekrar Oyna
                                        </button>
                                    </div>
                                ) : (
                                    <div className="glass-effect rounded-2xl p-6">
                                        <p className="text-3xl mb-2">😢</p>
                                        <h2 className="text-2xl font-bold text-danger-500 mb-2">Kaybettin!</h2>
                                        <p className="text-white font-bold text-xl mb-1">{targetWord}</p>
                                        <p className="text-dark-500 text-sm mb-4">Kelime buydu</p>
                                        <button
                                            onClick={startNewGame}
                                            className="px-6 py-3 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all"
                                        >
                                            Tekrar Oyna
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Keyboard */}
                {!gameOver && (
                    <div className="pb-4">
                        <GameKeyboard
                            onKeyPress={handleKeyPress}
                            onEnter={handleEnter}
                            onBackspace={handleBackspace}
                            keyStates={keyboardState}
                        />
                    </div>
                )}
            </main>
        </div>
    )
}
