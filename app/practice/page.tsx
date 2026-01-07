'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GameBoard from '@/components/GameBoard'
import GameKeyboard from '@/components/GameKeyboard'
import AnswerModal from '@/components/AnswerModal'
import BearTimer from '@/components/BearTimer'
import { getRandomWord, isValidWord } from '@/lib/words'
import { evaluateGuess, isCorrectGuess, getKeyboardState } from '@/lib/gameLogic'
import type { LetterResult } from '@/lib/supabase'

export default function PracticePage() {
    const router = useRouter()

    // Setup State
    const [isSetup, setIsSetup] = useState(false)
    const [gameMode, setGameMode] = useState<'untimed' | 'timed'>('untimed')
    const [showDurationSelect, setShowDurationSelect] = useState(false)

    // Game State
    const [wordLength, setWordLength] = useState(5)
    const [targetWord, setTargetWord] = useState<string>('')
    const [guesses, setGuesses] = useState<string[]>([])
    const [currentGuess, setCurrentGuess] = useState('')
    const [results, setResults] = useState<LetterResult[][]>([])
    const [gameOver, setGameOver] = useState(false)
    const [won, setWon] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Timer State
    const [timeLimit, setTimeLimit] = useState(60) // Default 60
    const [isTimerRunning, setIsTimerRunning] = useState(false)

    // Modal State
    const [showModal, setShowModal] = useState(false)

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const startRun = (mode: 'untimed' | 'timed') => {
        setGameMode(mode)
        if (mode === 'timed') {
            setShowDurationSelect(true)
        } else {
            setIsSetup(true)
            startNewGame(false)
        }
    }

    const confirmDuration = (seconds: number) => {
        setTimeLimit(seconds)
        setShowDurationSelect(false)
        setIsSetup(true)
        startNewGame(true)
    }

    const startNewGame = async (shouldStartTimer = false) => {
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
        setShowModal(false)
        setLoading(false)

        if (shouldStartTimer || (gameMode === 'timed' && isSetup)) {
            setIsTimerRunning(true)
        }
    }

    const handleTimeUp = () => {
        if (gameOver) return

        // Süre doldu: Bir hak yak
        const invalidResult = Array(wordLength).fill({ letter: '?', status: 'invalid' })
        const newGuesses = [...guesses, '?'.repeat(wordLength)]
        const newResults = [...results, invalidResult]

        setGuesses(newGuesses)
        setResults(newResults)
        setCurrentGuess('')

        setError('Süre Doldu! -1 Hak')
        setTimeout(() => setError(''), 2000)

        if (navigator.vibrate) navigator.vibrate([50, 50, 50])

        if (newGuesses.length >= 6) {
            handleLose()
        }
    }

    const handleLose = () => {
        setGameOver(true)
        setWon(false)
        setIsTimerRunning(false)
        setShowModal(true)

        if (navigator.vibrate) {
            navigator.vibrate(500)
        }
    }

    const handleWin = () => {
        setWon(true)
        setGameOver(true)
        setIsTimerRunning(false)
        setShowModal(true)

        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 100])
        }
    }

    const handleKeyPress = (key: string) => {
        if (gameOver || currentGuess.length >= wordLength || loading) return
        if (/^[a-zA-ZğüşıöçĞÜŞİÖÇ]$/.test(key)) {
            setCurrentGuess(prev => prev + key.toLocaleUpperCase('tr-TR'))
        }
    }

    const handleBackspace = () => {
        if (gameOver || loading) return
        setCurrentGuess(prev => prev.slice(0, -1))
    }

    const handleEnter = async () => {
        if (gameOver || loading) return

        if (currentGuess.length !== wordLength) {
            setError(`${wordLength} harfli kelime giriniz`)
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
            const newGuesses = [...guesses, currentGuess]
            const newResults = [...results, invalidResult]

            setGuesses(newGuesses)
            setResults(newResults)
            setCurrentGuess('')

            if (navigator.vibrate) navigator.vibrate([50, 50, 50])
            setTimeout(() => setError(''), 3000)

            if (newGuesses.length >= 6) {
                handleLose()
            }
            return
        }

        const evalResult = evaluateGuess(currentGuess, targetWord)
        const newGuesses = [...guesses, currentGuess]
        const newResults = [...results, evalResult]

        setGuesses(newGuesses)
        setResults(newResults)
        setCurrentGuess('')

        if (isCorrectGuess(currentGuess, targetWord)) {
            handleWin()
        } else if (newGuesses.length >= 6) {
            handleLose()
        }
    }

    const keyboardState = getKeyboardState(results)

    if (!isSetup) {
        if (showDurationSelect) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex flex-col items-center justify-center p-4">
                    <header className="absolute top-0 w-full p-4 flex justify-between items-center glass-effect border-b border-dark-200">
                        <button onClick={() => setShowDurationSelect(false)} className="text-dark-500 hover:text-white transition-colors">
                            ← Geri
                        </button>
                        <h1 className="text-xl font-bold gradient-text">Süre Seçimi</h1>
                        <div className="w-10"></div>
                    </header>

                    <div className="max-w-md w-full glass-effect rounded-3xl p-8 text-center animate-in zoom-in duration-300">
                        <h2 className="text-3xl font-bold text-white mb-2">Süreyi Seç</h2>
                        <p className="text-dark-400 mb-8">Her kelime için kaç saniyen olsun?</p>

                        <div className="grid grid-cols-2 gap-4">
                            {[20, 30, 40, 60].map((sec) => (
                                <button
                                    key={sec}
                                    onClick={() => confirmDuration(sec)}
                                    className="py-4 rounded-xl bg-dark-200 hover:bg-dark-300 border-2 border-transparent hover:border-primary-500 transition-all font-bold text-xl text-white"
                                >
                                    {sec} sn
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex flex-col items-center justify-center p-4">
                <header className="absolute top-0 w-full p-4 flex justify-between items-center glass-effect border-b border-dark-200">
                    <button onClick={() => router.push('/')} className="text-dark-500 hover:text-white transition-colors">
                        ← Geri
                    </button>
                    <h1 className="text-xl font-bold gradient-text">Pratik Modu</h1>
                    <div className="w-10"></div>
                </header>

                <div className="max-w-md w-full glass-effect rounded-3xl p-8 text-center animate-in zoom-in duration-300">
                    <h2 className="text-3xl font-bold text-white mb-2">Nasıl Oynamak İstersin?</h2>
                    <p className="text-dark-400 mb-8">Kendi hızında veya zamana karşı yarış.</p>

                    <div className="space-y-4">
                        <button
                            onClick={() => startRun('untimed')}
                            className="w-full py-4 rounded-xl bg-dark-200 hover:bg-dark-300 border-2 border-transparent hover:border-primary-500/30 transition-all group relative overflow-hidden"
                        >
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                <span className="text-2xl">🧘</span>
                                <div className="text-left">
                                    <div className="font-bold text-white group-hover:text-primary-400 transition-colors">Süresiz Pratik</div>
                                    <div className="text-xs text-dark-500">Rahat rahat, acele etmeden çöz</div>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => startRun('timed')}
                            className="w-full py-4 rounded-xl bg-dark-200 hover:bg-dark-300 border-2 border-transparent hover:border-danger-500/30 transition-all group relative overflow-hidden"
                        >
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                <span className="text-2xl">⚡</span>
                                <div className="text-left">
                                    <div className="font-bold text-white group-hover:text-danger-400 transition-colors">Süreli Meydan Okuma</div>
                                    <div className="text-xs text-dark-500">Kendini sına!</div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (loading && !targetWord) {
        return (
            <div className="min-h-screen bg-dark-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* Modal */}
            <AnswerModal
                isOpen={showModal}
                isWin={won}
                targetWord={targetWord}
                onNext={() => startNewGame(gameMode === 'timed')}
            />

            <header className="glass-effect border-b border-dark-200 w-full fixed top-0 z-40">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => setIsSetup(false)}
                        className="text-dark-500 hover:text-white transition-colors"
                    >
                        ← Menü
                    </button>
                    <h1 className="text-xl font-bold gradient-text">
                        {gameMode === 'timed' ? '⚡ Süreli Mod' : '🧘 Pratik Modu'}
                    </h1>
                    <button
                        onClick={toggleFullscreen}
                        className="text-dark-400 hover:text-white transition-colors text-2xl flex items-center justify-center w-10 h-10"
                    >
                        {isFullscreen ? '⊗' : '⛶'}
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto w-full pt-20">
                <div className="w-full max-w-md mx-auto relative">
                    {/* Timer Logic */}
                    {/* KEY ekleyerek her tahminde sayacın sıfırlandığını sağlıyoruz */}
                    {gameMode === 'timed' && !loading && (
                        <BearTimer
                            key={guesses.length}
                            duration={timeLimit}
                            onTimeUp={handleTimeUp}
                            isRunning={isTimerRunning && !gameOver}
                        />
                    )}

                    <GameBoard
                        guesses={guesses}
                        currentGuess={currentGuess}
                        wordLength={wordLength}
                        maxGuesses={6}
                        results={results}
                    />

                    {error && (
                        <div className="text-center mb-4 animate-pulse absolute top-20 left-0 right-0 z-40">
                            <div className="inline-block bg-danger-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg">
                                {error}
                            </div>
                        </div>
                    )}
                </div>

                {!gameOver && (
                    <div className="w-full max-w-md mx-auto pb-4">
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
