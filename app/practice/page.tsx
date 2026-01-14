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
import { calculateWordScore } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { LetterResult } from '@/lib/supabase'

export default function PracticePage() {
    const router = useRouter()
    const { user } = useAuth()

    // Setup State
    const [isSetup, setIsSetup] = useState(false)
    const [gameMode, setGameMode] = useState<'untimed' | 'timed'>('untimed')
    const [showDurationSelect, setShowDurationSelect] = useState(false)
    const [showWordLengthSelect, setShowWordLengthSelect] = useState(false)

    // Game State
    const [wordLength, setWordLength] = useState(5)
    const [isMixedMode, setIsMixedMode] = useState(false)
    const [targetWord, setTargetWord] = useState<string>('')
    const [totalScore, setTotalScore] = useState(0)
    const [wordsCompleted, setWordsCompleted] = useState(0)
    const [personalBest, setPersonalBest] = useState(0)
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

    const startRun = (mode: 'untimed' | 'timed') => {
        setGameMode(mode)
        setShowWordLengthSelect(true)
    }

    const confirmWordLength = (length: number) => {
        setWordLength(length)
        setShowWordLengthSelect(false)

        // Fetch personal best for this mode
        fetchPersonalBest(length)

        if (gameMode === 'timed') {
            setShowDurationSelect(true)
        } else {
            setIsSetup(true)
            startNewGame(false, length)
        }
    }

    const fetchPersonalBest = async (length: number) => {
        if (!user) return

        const wordLengthParam = isMixedMode ? 0 : length
        const { data, error } = await supabase.rpc('get_personal_best', {
            p_user_id: user.id,
            p_game_mode: gameMode,
            p_word_length: wordLengthParam
        })

        if (!error && data !== null) {
            setPersonalBest(data)
        }
    }

    const saveScore = async () => {
        if (!user || totalScore === 0) return

        const wordLengthParam = isMixedMode ? 0 : wordLength

        await supabase.from('practice_scores').insert({
            user_id: user.id,
            game_mode: gameMode,
            word_length: wordLengthParam,
            score: totalScore,
            words_completed: wordsCompleted
        })

        // Check if new personal best
        if (totalScore > personalBest) {
            setPersonalBest(totalScore)
            setError('🎉 YENİ REKOR!')
            setTimeout(() => setError(''), 3000)
        }
    }

    const confirmDuration = (seconds: number) => {
        setTimeLimit(seconds)
        setShowDurationSelect(false)
        setIsSetup(true)
        startNewGame(true, wordLength)
    }

    const startNewGame = async (shouldStartTimer = false, selectedLength?: number) => {
        setLoading(true)

        // Use provided length or current wordLength
        let currentLength = selectedLength || wordLength

        // Mixed mode: randomize word length
        if (isMixedMode) {
            currentLength = [4, 5, 6, 7][Math.floor(Math.random() * 4)]
            setWordLength(currentLength)
        }

        console.log('🎮 START NEW GAME:', { selectedLength, wordLength, currentLength, isMixedMode })
        const word = await getRandomWord(currentLength)

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

        // Timed mode: save score on game end
        if (gameMode === 'timed') {
            saveScore()
        }

        if (navigator.vibrate) {
            navigator.vibrate(500)
        }
    }

    const handleWin = () => {
        setWon(true)
        setGameOver(true)
        setIsTimerRunning(false)

        // Calculate score for this word (timed mode only)
        if (gameMode === 'timed') {
            const attemptNumber = guesses.length + 1
            const wordScore = calculateWordScore(0, attemptNumber)
            setTotalScore(prev => prev + wordScore)
            setWordsCompleted(prev => prev + 1)
        }

        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 100])
        }

        // Auto-advance to next word after 1.5 seconds
        setTimeout(() => {
            startNewGame(gameMode === 'timed')
        }, 1500)
    }

    const handleKeyPress = (key: string) => {
        console.log('🎹 KEY PRESSED:', key, { gameOver, loading, wordLength, currentGuess })

        if (gameOver || loading) {
            console.log('❌ BLOCKED: gameOver or loading')
            return
        }

        if (/^[a-zA-ZğüşıöçĞÜŞİÖÇ]$/.test(key)) {
            console.log('✅ VALID KEY')

            // Initialize with spaces if empty
            let chars = currentGuess.split('')
            if (chars.length === 0) {
                chars = Array(wordLength).fill(' ')
            }

            // Find first empty or space position
            const firstEmptyIndex = chars.findIndex(c => !c || c === ' ')

            console.log('📍 First empty index:', firstEmptyIndex, 'chars:', chars)

            if (firstEmptyIndex === -1) {
                console.log('❌ ALL POSITIONS FILLED')
                return // All positions filled
            }

            // Ensure array is full length
            while (chars.length < wordLength) {
                chars.push(' ')
            }

            chars[firstEmptyIndex] = key.toLocaleUpperCase('tr-TR')
            const newGuess = chars.join('')
            console.log('✅ NEW GUESS:', newGuess)
            setCurrentGuess(newGuess)
        } else {
            console.log('❌ INVALID KEY (not a letter)')
        }
    }

    const handleBackspace = () => {
        if (gameOver || loading) return

        // Find last non-empty, non-space character
        const chars = currentGuess.split('')
        for (let i = chars.length - 1; i >= 0; i--) {
            if (chars[i] && chars[i] !== ' ') {
                chars[i] = ' '
                setCurrentGuess(chars.join(''))
                return
            }
        }
    }

    const handleEnter = async () => {
        if (gameOver || loading) return

        // Count non-space characters
        const filledCount = currentGuess.split('').filter(c => c && c !== ' ').length
        if (filledCount !== wordLength) {
            setError(`${wordLength} harfli kelime giriniz`)
            setTimeout(() => setError(''), 2000)
            return
        }

        // Remove spaces for validation
        const guess = currentGuess.replace(/ /g, '')
        const valid = await isValidWord(guess)
        if (!valid) {
            setError('Geçersiz kelime! Hak kaybettiniz.')

            const invalidResult = guess.split('').map(letter => ({
                letter,
                status: 'invalid' as const
            }))
            const newGuesses = [...guesses, guess]
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

        const evalResult = evaluateGuess(guess, targetWord)
        const newGuesses = [...guesses, guess]
        const newResults = [...results, evalResult]

        setGuesses(newGuesses)
        setResults(newResults)
        setCurrentGuess('')
        setUsedJokers(new Set()) // Reset joker usage for next attempt
        setJokerLetters([]) // Reset joker letters

        if (isCorrectGuess(guess, targetWord)) {
            handleWin()
        } else if (newGuesses.length >= maxAttempts) {
            handleLose()
        }
    }

    // Joker Handler
    const handleJokerUsed = (jokerType: string, data: any) => {
        // Silently ignore if already used (UI will show it as disabled)
        if (usedJokers.has(jokerType)) {
            return
        }

        if (jokerType === 'green_letter') {
            console.log('🟢 GREEN LETTER DEBUG:', {
                position: data.position,
                letter: data.letter,
                wordLength,
                currentGuess
            })

            // Create array with SPACE characters (not empty strings!)
            const newGuess = Array(wordLength).fill(' ')

            // Copy existing letters from current guess
            const current = currentGuess.split('')
            for (let i = 0; i < current.length && i < wordLength; i++) {
                if (current[i] && current[i] !== ' ') {
                    newGuess[i] = current[i]
                }
            }

            // Place the joker letter at the EXACT position
            newGuess[data.position] = data.letter

            console.log('🟢 AFTER PLACEMENT:', {
                newGuessArray: newGuess,
                newGuessString: newGuess.join(''),
                letterAtPosition: newGuess[data.position]
            })

            setCurrentGuess(newGuess.join(''))

            // Add to joker letters for coloring at CORRECT position
            setJokerLetters(prev => [...prev, { position: data.position, letter: data.letter, status: 'correct' }])

            // Mark joker as used
            setUsedJokers(prev => new Set(prev).add(jokerType))

            setError(`✅ ${data.letter} harfi ${data.position + 1}. pozisyonda!`)
            setTimeout(() => setError(''), 2000)
        } else if (jokerType === 'yellow_letter') {
            const correctPositions = []
            for (let i = 0; i < targetWord.length; i++) {
                if (targetWord[i] === data.letter) {
                    correctPositions.push(i)
                }
            }

            const wrongPositions = []
            for (let i = 0; i < wordLength; i++) {
                if (!correctPositions.includes(i) && !currentGuess[i]) {
                    wrongPositions.push(i)
                }
            }

            if (wrongPositions.length > 0) {
                const randomWrongPos = wrongPositions[Math.floor(Math.random() * wrongPositions.length)]

                // Create array with SPACE characters (same as green letter)
                const newGuess = Array(wordLength).fill(' ')
                const current = currentGuess.split('')
                for (let i = 0; i < current.length && i < wordLength; i++) {
                    if (current[i] && current[i] !== ' ') {
                        newGuess[i] = current[i]
                    }
                }
                newGuess[randomWrongPos] = data.letter
                setCurrentGuess(newGuess.join(''))

                // Add to joker letters for coloring
                setJokerLetters(prev => [...prev, { position: randomWrongPos, letter: data.letter, status: 'present' }])

                // Mark joker as used
                setUsedJokers(prev => new Set(prev).add(jokerType))

                setError(`💡 ${data.letter} harfi kelimede var!`)
                setTimeout(() => setError(''), 3000)
            }
        } else if (jokerType === 'extra_attempt') {
            setMaxAttempts(prev => prev + 1)
            setUsedJokers(prev => new Set(prev).add(jokerType))
            setError('✅ +1 Ekstra Hak!')
            setTimeout(() => setError(''), 2000)
        } else if (jokerType === 'reveal_word') {
            setCurrentGuess(data.word)
            setUsedJokers(prev => new Set(prev).add(jokerType))
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

                        <div className="grid grid-cols-2 gap-4">
                            {[4, 5, 6, 7].map((length) => (
                                <button
                                    key={length}
                                    onClick={() => {
                                        setIsMixedMode(false)
                                        confirmWordLength(length)
                                    }}
                                    className="py-6 rounded-xl bg-dark-200 hover:bg-dark-300 border-2 border-transparent hover:border-primary-500 transition-all font-bold text-2xl text-white"
                                >
                                    {length}
                                </button>
                            ))}
                            <button
                                onClick={() => {
                                    setIsMixedMode(true)
                                    confirmWordLength(5) // Default, will be randomized
                                }}
                                className="col-span-2 py-6 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-2 border-transparent transition-all font-bold text-xl text-white"
                            >
                                🎲 Karışık (4-7)
                            </button>
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
            {/* Modal - Only show on lose */}
            {!won && (
                <AnswerModal
                    isOpen={showModal}
                    isWin={won}
                    targetWord={targetWord}
                    onNext={() => startNewGame(gameMode === 'timed')}
                    onRestart={() => setIsSetup(false)}
                />
            )}

            <header className="glass-effect border-b border-dark-200 w-full fixed top-0 z-40">
                <div className="container mx-auto px-3 py-2">
                    <div className="grid grid-cols-3 items-center gap-2">
                        {/* LEFT: Menu + Score */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsSetup(false)}
                                className="text-white/70 hover:text-white transition-colors text-xs"
                            >
                                ← Menü
                            </button>

                            {/* Score Display - Timed mode only - Vertical Stack */}
                            {gameMode === 'timed' && (
                                <div className="flex flex-col gap-0.5">
                                    <div className="bg-dark-200/80 backdrop-blur-sm rounded px-1.5 py-0.5 border border-white/10">
                                        <div className="text-[7px] text-white/60 text-center leading-none">PUAN</div>
                                        <div className="text-xs font-bold text-yellow-400 text-center leading-tight">{totalScore}</div>
                                    </div>
                                    {personalBest > 0 && (
                                        <div className="bg-dark-200/80 backdrop-blur-sm rounded px-1.5 py-0.5 border border-green-500/30">
                                            <div className="text-[7px] text-white/60 text-center leading-none">REKOR</div>
                                            <div className="text-xs font-bold text-green-400 text-center leading-tight">{personalBest}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* CENTER: Title */}
                        <div className="text-center">
                            <h1 className="text-lg font-bold gradient-text leading-tight">
                                {gameMode === 'timed' ? 'Süreli' : 'Süresiz'}
                            </h1>
                            <div className="text-xs text-white/60 leading-tight">Pratik Mod</div>
                        </div>

                        {/* RIGHT: Currency + Buttons (Vertical) */}
                        <div className="flex items-center justify-end gap-2">
                            <CurrencyDisplay />
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={toggleFullscreen}
                                    className="text-white/80 hover:text-white transition-colors text-xl flex items-center justify-center w-8 h-8 bg-dark-200/50 rounded-lg"
                                >
                                    {isFullscreen ? '✕' : '⛶'}
                                </button>
                                {!gameOver && (
                                    <button
                                        onClick={() => setShowJokerPanel(!showJokerPanel)}
                                        className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center text-base"
                                    >
                                        ✨
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto w-full pt-16">
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
                        usedJokers={usedJokers}
                        showPanel={showJokerPanel}
                        onClose={() => setShowJokerPanel(false)}
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
