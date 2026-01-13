'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GameBoard from '@/components/GameBoard'
import GameKeyboard from '@/components/GameKeyboard'
import AnswerModal from '@/components/AnswerModal'
import BearTimer from '@/components/BearTimer'
import CurrencyDisplay from '@/components/CurrencyDisplay'
import JokerPanel from '@/components/JokerPanel'
import { getRandomWord, isValidWord } from '@/lib/words'
import { evaluateGuess, isCorrectGuess, getKeyboardState } from '@/lib/gameLogic'
import type { LetterResult } from '@/lib/supabase'

export default function PracticePage() {
    const router = useRouter()

    // Setup State
    const [isSetup, setIsSetup] = useState(false)
    const [gameMode, setGameMode] = useState<'untimed' | 'timed'>('untimed')
    const [showDurationSelect, setShowDurationSelect] = useState(false)
    const [showWordLengthSelect, setShowWordLengthSelect] = useState(false)

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

    // Joker State
    const [maxAttempts, setMaxAttempts] = useState(6)
    const [revealedLetters, setRevealedLetters] = useState<{ position: number, letter: string }[]>([])
    const [hintLetter, setHintLetter] = useState<string | null>(null)

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
        setShowWordLengthSelect(true)
    }

    const confirmWordLength = (length: number) => {
        setWordLength(length)
        setShowWordLengthSelect(false)

        if (gameMode === 'timed') {
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
        setUsedJokers(new Set()) // Reset joker usage
        setJokerLetters([]) // Reset joker letters

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
        setUsedJokers(new Set()) // Reset joker usage for next attempt
        setJokerLetters([]) // Reset joker letters

        if (isCorrectGuess(currentGuess, targetWord)) {
            handleWin()
        } else if (newGuesses.length >= maxAttempts) {
            handleLose()
        }
    }

    // Joker Handler
    const handleJokerUsed = (jokerType: string, data: any) => {
        if (jokerType === 'green_letter') {
            // Place letter in correct position in current guess
            const newGuess = currentGuess.split('')
            while (newGuess.length < wordLength) {
                newGuess.push('')
            }
            newGuess[data.position] = data.letter
            setCurrentGuess(newGuess.join(''))

            // Show success message
            setError(`✅ ${data.letter} harfi ${data.position + 1}. pozisyonda!`)
            setTimeout(() => setError(''), 2000)
        } else if (jokerType === 'yellow_letter') {
            // Place letter in a wrong position in current guess
            const correctPositions = []
            for (let i = 0; i < targetWord.length; i++) {
                if (targetWord[i] === data.letter) {
                    correctPositions.push(i)
                }
            }

            // Find available wrong positions
            const wrongPositions = []
            for (let i = 0; i < wordLength; i++) {
                if (!correctPositions.includes(i) && !currentGuess[i]) {
                    wrongPositions.push(i)
                }
            }

            if (wrongPositions.length > 0) {
                const randomWrongPos = wrongPositions[Math.floor(Math.random() * wrongPositions.length)]
                const newGuess = currentGuess.split('')
                while (newGuess.length < wordLength) {
                    newGuess.push('')
                }
                newGuess[randomWrongPos] = data.letter
                setCurrentGuess(newGuess.join(''))

                setError(`💡 ${data.letter} harfi kelimede var!`)
                setTimeout(() => setError(''), 3000)
            }
        } else if (jokerType === 'extra_attempt') {
            // Add extra attempt
            setMaxAttempts(prev => prev + 1)
            setError('✅ +1 Ekstra Hak!')
            setTimeout(() => setError(''), 2000)
        } else if (jokerType === 'reveal_word') {
            // Auto-fill and submit the word
            setCurrentGuess(data.word)
            setTimeout(() => {
                const evalResult = evaluateGuess(data.word, targetWord)
                setGuesses([...guesses, data.word])
                setResults([...results, evalResult])
                handleWin()
            }, 500)
        }
    }

    const keyboardState = getKeyboardState(results)

    if (!isSetup) {
        // Word Length Selection Screen
        if (showWordLengthSelect) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex flex-col items-center justify-center p-4">
                    <header className="absolute top-0 w-full p-4 flex justify-between items-center glass-effect border-b border-dark-200">
                        <button onClick={() => setShowWordLengthSelect(false)} className="text-white/70 hover:text-white transition-colors">
                            ← Geri
                        </button>
                        <h1 className="text-xl font-bold gradient-text">Kelime Uzunluğu</h1>
                        <div className="w-10"></div>
                    </header>

                    <div className="max-w-md w-full glass-effect rounded-3xl p-8 text-center animate-in zoom-in duration-300">
                        <h2 className="text-3xl font-bold text-white mb-2">Kaç Harfli?</h2>
                        <p className="text-white/80 mb-8">Kelime uzunluğunu seç</p>

                        <div className="grid grid-cols-3 gap-4">
                            {[4, 5, 6].map((length) => (
                                <button
                                    key={length}
                                    onClick={() => confirmWordLength(length)}
                                    className="py-6 rounded-xl bg-dark-200 hover:bg-dark-300 border-2 border-transparent hover:border-primary-500 transition-all font-bold text-2xl text-white"
                                >
                                    {length}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )
        }

        if (showDurationSelect) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex flex-col items-center justify-center p-4">
                    <header className="absolute top-0 w-full p-4 flex justify-between items-center glass-effect border-b border-dark-200">
                        <button onClick={() => setShowDurationSelect(false)} className="text-white/70 hover:text-white transition-colors">
                            ← Geri
                        </button>
                        <h1 className="text-xl font-bold gradient-text">Süre Seçimi</h1>
                        <div className="w-10"></div>
                    </header>

                    <div className="max-w-md w-full glass-effect rounded-3xl p-8 text-center animate-in zoom-in duration-300">
                        <h2 className="text-3xl font-bold text-white mb-2">Süreyi Seç</h2>
                        <p className="text-white/80 mb-8">Her kelime için kaç saniyen olsun?</p>

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
                    <button onClick={() => router.push('/')} className="text-white/70 hover:text-white transition-colors">
                        ← Geri
                    </button>
                    <h1 className="text-xl font-bold gradient-text">Pratik Modu</h1>
                    <div className="w-10"></div>
                </header>

                <div className="max-w-md w-full glass-effect rounded-3xl p-8 text-center animate-in zoom-in duration-300">
                    <h2 className="text-3xl font-bold text-white mb-2">Nasıl Oynamak İstersin?</h2>
                    <p className="text-white/80 mb-8">Kendi hızında veya zamana karşı yarış.</p>

                    <div className="space-y-4">
                        <button
                            onClick={() => startRun('untimed')}
                            className="w-full py-4 rounded-xl bg-dark-200 hover:bg-dark-300 border-2 border-transparent hover:border-primary-500/30 transition-all group relative overflow-hidden"
                        >
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                <span className="text-2xl">🧘</span>
                                <div className="text-left">
                                    <div className="font-bold text-white group-hover:text-primary-400 transition-colors">Süresiz Pratik</div>
                                    <div className="text-xs text-white/70">Rahat rahat, acele etmeden çöz</div>
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
                                    <div className="text-xs text-white/70">Kendini sına!</div>
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
                        className="text-white/70 hover:text-white transition-colors"
                    >
                        ← Menü
                    </button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold gradient-text">
                            {gameMode === 'timed' ? '⚡ Süreli Mod' : '🧘 Pratik Modu'}
                        </h1>
                        <CurrencyDisplay />
                    </div>
                    <button
                        onClick={toggleFullscreen}
                        className="text-white/80 hover:text-white transition-colors text-2xl flex items-center justify-center w-10 h-10"
                    >
                        {isFullscreen ? '⊗' : '⛶'}
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto w-full pt-24">
                <div className="w-full max-w-md mx-auto relative">
                    {/* Hint Letter Display */}
                    {hintLetter && (
                        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
                            <div className="bg-warning-500/90 text-white px-6 py-3 rounded-xl shadow-lg font-bold text-xl">
                                💡 İpucu: <span className="text-2xl">{hintLetter}</span>
                            </div>
                        </div>
                    )}
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
                        maxGuesses={maxAttempts}
                        results={results}
                        jokerLetters={jokerLetters}
                    />

                    {error && (
                        <div className="text-center mb-4 animate-pulse absolute top-20 left-0 right-0 z-40">
                            <div className="inline-block bg-danger-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg">
                                {error}
                            </div>
                        </div>
                    )}
                </div>

                {/* Joker Panel */}
                {!gameOver && (
                    <JokerPanel
                        targetWord={targetWord}
                        currentGuesses={guesses}
                        onJokerUsed={handleJokerUsed}
                    />
                )}

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
