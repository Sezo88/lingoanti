import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameKeyboard from './GameKeyboard'
import AnswerModal from './AnswerModal'
import BearTimer from './BearTimer'
import JokerPanel from './JokerPanel'
import { isCorrectGuess, evaluateGuess, getKeyboardState } from '@/lib/gameLogic'
import { isValidWord } from '@/lib/words'
import type { LetterResult } from '@/lib/supabase'

import { calculateWordScore } from '@/lib/scoring'

interface ArenaBoardProps {
    targetWords: string[]
    duration?: number
    onProgress: (wordIndex: number, isFinished: boolean) => void
    onWordCompleted: (wordIndex: number, timeSeconds: number, score: number) => void
}

export default function ArenaBoard({
    targetWords,
    duration = 60,
    onProgress,
    onWordCompleted
}: ArenaBoardProps) {
    const [wordIndex, setWordIndex] = useState(0)
    const [guesses, setGuesses] = useState<string[]>([])
    const [results, setResults] = useState<LetterResult[][]>([])
    const [currentGuess, setCurrentGuess] = useState('')
    const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost' | 'finished'>('playing')
    const [shakeRow, setShakeRow] = useState(false)
    const [error, setError] = useState('')

    // Scoring State
    const [totalScore, setTotalScore] = useState(0)
    const [wordStartTime, setWordStartTime] = useState<number>(Date.now())

    // Modal State
    const [showModal, setShowModal] = useState(false)
    const [isWin, setIsWin] = useState(false)

    // Joker State
    const [maxAttempts, setMaxAttempts] = useState(6)
    const [usedJokers, setUsedJokers] = useState<Set<string>>(new Set())
    const [jokerLetters, setJokerLetters] = useState<{ position: number, letter: string, status: 'correct' | 'present' }[]>([])
    const [showJokerPanel, setShowJokerPanel] = useState(false)

    // Şu anki hedef kelime
    const targetWord = targetWords[wordIndex]

    // Oyun bitti mi kontrolü
    useEffect(() => {
        if (wordIndex >= targetWords.length) {
            setGameStatus('finished')
        }
    }, [wordIndex, targetWords.length])

    const handleKeyPress = (key: string) => {
        if (gameStatus !== 'playing') return

        // Initialize with spaces if empty
        let chars = currentGuess.split('')
        if (chars.length === 0) {
            chars = Array(targetWord.length).fill(' ')
        }

        // Find first empty position
        const emptyIndex = chars.findIndex(c => c === ' ' || c === '')
        if (emptyIndex !== -1 && /^[a-zA-ZğüşıöçĞÜŞİÖÇ]$/.test(key)) {
            chars[emptyIndex] = key.toLocaleUpperCase('tr-TR')
            setCurrentGuess(chars.join(''))
        }
    }

    const handleEnter = async () => {
        if (gameStatus !== 'playing') return
        await submitGuess()
    }

    const handleBackspace = () => {
        if (gameStatus !== 'playing') return

        // Find last non-empty, non-space character
        const chars = currentGuess.split('')
        for (let i = chars.length - 1; i >= 0; i--) {
            if (chars[i] && chars[i] !== ' ') {
                chars[i] = ' '
                setCurrentGuess(chars.join(''))
                break
            }
        }
    }

    const handleJokerUsed = (jokerType: string, data: any) => {
        if (jokerType === 'green_letter') {
            // Initialize guess array with spaces
            const newGuess = Array(targetWord.length).fill(' ')

            // Copy existing letters from current guess
            const current = currentGuess.split('')
            for (let i = 0; i < current.length && i < targetWord.length; i++) {
                if (current[i] && current[i] !== ' ') {
                    newGuess[i] = current[i]
                }
            }

            // Place the joker letter at the EXACT position (UPPERCASE)
            newGuess[data.position] = data.letter.toLocaleUpperCase('tr-TR')
            setCurrentGuess(newGuess.join(''))

            // Add to joker letters for coloring at CORRECT position
            setJokerLetters(prev => [...prev, { position: data.position, letter: data.letter, status: 'correct' }])
            setUsedJokers(prev => new Set(prev).add(jokerType))

        } else if (jokerType === 'yellow_letter') {
            // Find a wrong position to place the yellow letter
            const correctPositions: number[] = []
            for (let i = 0; i < targetWord.length; i++) {
                if (targetWord[i] === data.letter) correctPositions.push(i)
            }

            const wrongPositions: number[] = []
            for (let i = 0; i < targetWord.length; i++) {
                if (!correctPositions.includes(i) && !currentGuess[i]) {
                    wrongPositions.push(i)
                }
            }

            if (wrongPositions.length > 0) {
                const randomWrongPos = wrongPositions[Math.floor(Math.random() * wrongPositions.length)]
                const newGuess = Array(targetWord.length).fill(' ')
                for (let i = 0; i < currentGuess.length; i++) {
                    if (currentGuess[i]) newGuess[i] = currentGuess[i]
                }
                newGuess[randomWrongPos] = data.letter.toLocaleUpperCase('tr-TR')
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

    // Helper functions defined before usage
    const handleWin = () => {
        setIsWin(true)
        setShowModal(true)
        setGameStatus('won')

        // Calculate Score with attempt bonus
        const timeSeconds = (Date.now() - wordStartTime) / 1000
        const attemptNumber = guesses.length + 1  // Current attempt number
        const wordScore = calculateWordScore(timeSeconds, attemptNumber)
        setTotalScore(prev => prev + wordScore)

        onWordCompleted(wordIndex, timeSeconds, wordScore)

        // Otomatik geçiş YOK - Kullanıcı "Tamam" deyecek
    }

    const handleLose = () => {
        setIsWin(false)
        setShowModal(true)
        setGameStatus('lost')

        // Otomatik geçiş YOK - Kullanıcı "Tamam" deyecek veya 10s beklenecek
    }

    const handleNextWord = () => {
        setShowModal(false)
        const nextIndex = wordIndex + 1
        setWordIndex(nextIndex)
        setGuesses([])
        setResults([])
        setCurrentGuess('')
        setJokerLetters([])
        setUsedJokers(new Set())
        setMaxAttempts(6)
        setGameStatus('playing')
        setWordStartTime(Date.now()) // Reset timer

        onProgress(nextIndex, nextIndex >= targetWords.length)

        if (nextIndex >= targetWords.length) {
            setGameStatus('finished')
        }
    }

    const submitGuess = async () => {
        if (currentGuess.length !== targetWord.length) {
            setShakeRow(true)
            setTimeout(() => setShakeRow(false), 500)
            return
        }

        const valid = await isValidWord(currentGuess)

        // GEÇERSİZ KELİME MANTIĞI (Hak yer)
        if (!valid) {
            setShakeRow(true)
            setTimeout(() => setShakeRow(false), 500)
            setError('Geçersiz kelime!')
            setTimeout(() => setError(''), 2000)

            const invalidResult = currentGuess.split('').map(letter => ({
                letter,
                status: 'invalid' as const
            }))

            const newGuesses = [...guesses, currentGuess]
            const newResults = [...results, invalidResult]
            setCurrentGuess('')
            setJokerLetters([])

            setGuesses(newGuesses)
            setResults(newResults)
            setCurrentGuess('')

            // Max attempts reached?
            if (newGuesses.length >= maxAttempts) {
                handleLose()
            }
            return
        }

        // GEÇERLİ KELİME
        const evalResult = evaluateGuess(currentGuess, targetWord)
        const newGuesses = [...guesses, currentGuess]
        const newResults = [...results, evalResult]

        setGuesses(newGuesses)
        setResults(newResults)
        setCurrentGuess('')

        // Doğru tahmin mi?
        const won = evalResult.every(l => l.status === 'correct')

        if (won) {
            // Kelime bilindi!
            handleWin()
        } else if (newGuesses.length >= maxAttempts) {
            handleLose()
        }
    }

    const handleTimeUp = () => {
        if (gameStatus !== 'playing') return

        // Süre doldu: Bir hak yak
        const invalidResult = Array(targetWord.length).fill({ letter: '?', status: 'invalid' })
        const placeholderGuess = '?'.repeat(targetWord.length)

        const newGuesses = [...guesses, placeholderGuess]
        const newResults = [...results, invalidResult]

        setGuesses(newGuesses)
        setResults(newResults)
        setCurrentGuess('')

        setError('Süre Doldu! -1 Hak')
        setTimeout(() => setError(''), 2000)

        if (newGuesses.length >= 6) {
            handleLose()
        }
    }

    if (gameStatus === 'finished') {
        return (
            <div className="flex flex-col items-center justify-center p-10 text-center animate-in zoom-in">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-3xl font-bold text-white mb-2">Tebrikler!</h2>
                <div className="text-4xl font-black text-yellow-400 mb-4">{totalScore} Puan</div>
                <p className="text-dark-300">Tüm kelimeleri tamamladın.</p>
                <p className="text-sm text-dark-400 mt-4">Diğerlerinin bitirmesi bekleniyor...</p>
            </div>
        )
    }

    // Klavye durumunu hesapla
    const keyboardState = getKeyboardState(results)

    return (
        <div className="flex flex-col h-full max-w-lg mx-auto w-full relative">
            {/* Score Display */}
            <div className="text-center mb-2 animate-in fade-in">
                <div className="inline-block px-4 py-1 rounded-full bg-black/20 border border-white/5 backdrop-blur-sm">
                    <span className="text-sm text-white/70 mr-2">PUAN:</span>
                    <span className="text-xl font-bold text-yellow-400">{totalScore}</span>
                </div>
            </div>

            {/* Modal */}
            <AnswerModal
                isOpen={showModal}
                isWin={isWin}
                targetWord={targetWord}
                onNext={handleNextWord}
            />

            {/* Hata Mesajı (Toast) */}
            {error && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="bg-danger-500/90 text-white px-4 py-2 rounded-lg shadow-lg font-bold animate-pulse">
                        {error}
                    </div>
                </div>
            )}

            {/* Timer - Multiplayer için şimdilik opsiyonel, ileride prop olarak alınabilir */}
            <div className="px-4">
                <BearTimer
                    key={guesses.length}
                    duration={duration}
                    onTimeUp={handleTimeUp}
                    isRunning={gameStatus === 'playing' && !showModal}
                />
            </div>

            {/* Header: Kaçıncı kelime + Joker Button */}
            <div className="flex items-center justify-between px-4 mb-4">
                <div className="flex-1" />
                <span className="bg-dark-200 text-primary-400 px-3 py-1 rounded-full text-sm font-bold border border-white/5">
                    Kelime {wordIndex + 1} / {targetWords.length}
                </span>
                <div className="flex-1 flex justify-end">
                    {(() => {
                        console.log('🎮 ARENA JOKER BUTTON - gameStatus:', gameStatus)
                        return gameStatus === 'playing' && (
                            <button
                                onClick={() => {
                                    console.log('✨ ARENA JOKER BUTTON CLICKED')
                                    setShowJokerPanel(true)
                                }}
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center text-lg"
                            >
                                ✨
                            </button>
                        )
                    })()}
                </div>
            </div>

            {/* Joker Panel */}
            {gameStatus === 'playing' && (
                <JokerPanel
                    targetWord={targetWord}
                    currentGuesses={guesses}
                    onJokerUsed={handleJokerUsed}
                    usedJokers={usedJokers}
                    showPanel={showJokerPanel}
                    onClose={() => setShowJokerPanel(false)}
                />
            )}

            {/* Grid */}
            <div className="flex-1 overflow-y-auto min-h-[400px] flex items-center justify-center">
                <div className="grid gap-2 p-4">
                    {/* Geçmiş tahminler */}
                    {guesses.map((guess, i) => (
                        <Row
                            key={i}
                            word={guess}
                            target={targetWord}
                            submitted={true}
                            result={results[i]} // Sonucu pass et
                        />
                    ))}

                    {/* Şu anki tahmin */}
                    {gameStatus === 'playing' && (
                        <Row
                            word={currentGuess}
                            target={targetWord}
                            submitted={false}
                            shake={shakeRow}
                            length={targetWord.length}
                            jokerLetters={jokerLetters}
                        />
                    )}

                    {/* Boş satırlar */}
                    {Array.from({ length: Math.max(0, 5 - guesses.length - 1) }).map((_, i) => (
                        <Row key={`empty-${i}`} word="" target="" submitted={false} length={targetWord.length} />
                    ))}
                </div>
            </div>

            {/* Joker Panel */}
            {gameStatus === 'playing' && (
                <JokerPanel
                    targetWord={targetWord}
                    currentGuesses={guesses}
                    onJokerUsed={handleJokerUsed}
                    usedJokers={usedJokers}
                    showPanel={showJokerPanel}
                    onClose={() => setShowJokerPanel(false)}
                />
            )}

            {/* Keyboard */}
            <div className="pb-4">
                <GameKeyboard
                    onKeyPress={handleKeyPress}
                    onEnter={handleEnter}
                    onBackspace={handleBackspace}
                    keyStates={keyboardState}
                />
            </div>
        </div>
    )
}

// Yardımcı Row Bileşeni
function Row({ word, target, submitted, shake, length = 5, result, jokerLetters = [] }: any) {
    const letters = word.split('')
    const emptyCount = length - letters.length

    // Eğer result prop geldiyse (geçmiş tahmin) onu kullan, yoksa boş array
    const feedback = result || []

    return (
        <motion.div
            className="flex gap-2"
            animate={shake ? { x: [-5, 5, -5, 5, 0] } : {}}
            transition={{ duration: 0.4 }}
        >
            {/* ... letters mapping ... */}
            {letters.map((letter: string, i: number) => {
                let bgColor = 'bg-dark-200/50 border-white/10'

                // Check if this position has a joker letter
                const jokerLetter = jokerLetters.find((j: any) => j.position === i)
                if (jokerLetter && !submitted) {
                    // Apply joker color
                    if (jokerLetter.status === 'correct') bgColor = 'bg-success-500 border-success-500'
                    else if (jokerLetter.status === 'present') bgColor = 'bg-warning-500 border-warning-500'
                } else if (submitted && feedback[i]) {
                    if (feedback[i].status === 'correct') bgColor = 'bg-success-500 border-success-500'
                    else if (feedback[i].status === 'present') bgColor = 'bg-warning-500 border-warning-500'
                    else if (feedback[i].status === 'invalid') bgColor = 'bg-danger-500 border-danger-500' // Kırmızı
                    else bgColor = 'bg-dark-300 border-dark-300'
                }

                return (
                    <div
                        key={i}
                        className={`w-12 h-12 sm:w-14 sm:h-14 border-2 rounded-lg flex items-center justify-center text-2xl font-bold text-white transition-all ${bgColor}`}
                    >
                        {letter}
                    </div>
                )
            })}

            {Array.from({ length: emptyCount }).map((_, i) => (
                <div
                    key={`empty-${i}`}
                    className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-white/5 bg-black/20 rounded-lg"
                />
            ))}
        </motion.div>
    )
}
