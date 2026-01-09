import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameKeyboard from './GameKeyboard'
import AnswerModal from './AnswerModal'
import BearTimer from './BearTimer'
import { isCorrectGuess, evaluateGuess, getKeyboardState } from '@/lib/gameLogic'
import { isValidWord } from '@/lib/words'
import type { LetterResult } from '@/lib/supabase'

import { calculateWordScore } from '@/lib/scoring'

interface ArenaBoardProps {
    targetWords: string[]
    duration?: number // Optional prop added
    onProgress: (wordIndex: number, isFinished: boolean) => void
    onWordCompleted: (wordIndex: number, timeSeconds: number, score: number) => void
}

export default function ArenaBoard({
    targetWords,
    duration = 60, // Default value
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

    // Refs
    // const timerRef = useRef<any>(null) // Timer'ı parent yönetiyor aslında ama burada görsel

    const currentTargetWord = targetWords[wordIndex] || ''

    // İlk ve kelime geçişlerinde zamanlayıcıyı başlatma
    useEffect(() => {
        setWordStartTime(Date.now())
    }, [wordIndex])


    // Klavye olaylarını dinle
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameStatus !== 'playing') return

            const key = e.key.toUpperCase()

            if (key === 'ENTER') {
                handleEnter()
            } else if (key === 'BACKSPACE') {
                handleBackspace()
            } else if (/^[A-ZĞÜŞİÖÇ]$/.test(key)) { // Türkçe karakter desteği
                handleKeyPress(key)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [currentGuess, gameStatus])

    const handleKeyPress = (key: string) => {
        if (currentGuess.length < 5) {
            setCurrentGuess(prev => prev + key)
        }
    }

    const handleBackspace = () => {
        setCurrentGuess(prev => prev.slice(0, -1))
    }

    const handleEnter = async () => {
        if (currentGuess.length !== 5) {
            setError('5 harfli olmalı')
            setShakeRow(true)
            setTimeout(() => setShakeRow(false), 500)
            return
        }

        if (!await isValidWord(currentGuess)) {
            setError('Geçersiz kelime')
            setShakeRow(true)
            setTimeout(() => setShakeRow(false), 500)
            return
        }

        submitGuess(currentGuess)
    }

    const submitGuess = (guess: string) => {
        const result = evaluateGuess(guess, currentTargetWord)
        const newGuesses = [...guesses, guess]
        const newResults = [...results, result]

        setGuesses(newGuesses)
        setResults(newResults)
        setCurrentGuess('')

        const won = result.every(l => l.status === 'correct')

        if (won) {
            handleWin(newGuesses.length)
        } else if (newGuesses.length >= 6) {
            // Son hakta yanlış kelime olsa bile "submitGuess" çalıştığı için
            // buraya düşeriz. Ancak kelime geçerliyse (yukarıda isValidWord kontrolü var)
            // burası çalışır.
            handleLose()
        }
    }

    const handleWin = (attempts: number) => {
        setGameStatus('won') // Geçici durum, modal için

        // Puan hesapla
        const timeSpent = (Date.now() - wordStartTime) / 1000
        const score = calculateWordScore(attempts, timeSpent)
        setTotalScore(prev => prev + score)

        // Veritabanına kaydet
        onWordCompleted(wordIndex, timeSpent, score)

        setIsWin(true)
        setShowModal(true)
    }

    const handleLose = () => {
        setGameStatus('lost') // Geçici durum
        setIsWin(false)
        setShowModal(true)
    }

    // Modal kapandığında (Süre bitti veya kullanıcı bastı)
    const handleNextWord = () => {
        setShowModal(false)

        if (wordIndex < targetWords.length - 1) {
            // Sonraki kelimeye geç
            setWordIndex(prev => prev + 1)
            setGuesses([])
            setResults([])
            setCurrentGuess('')
            setGameStatus('playing')
            setWordStartTime(Date.now())
        } else {
            // Oyun bitti
            setGameStatus('finished')
            onProgress(wordIndex + 1, true) // Finish
        }
    }

    // Modal'daki süre bittiğinde otomatik geç
    const handleModalTimeUp = () => {
        handleNextWord()
    }

    const keyboardState = getKeyboardState(results)

    return (
        <div className="flex flex-col h-full max-w-lg mx-auto relative">
            <AnswerModal
                isOpen={showModal}
                isWin={isWin}
                targetWord={currentTargetWord}
                onNext={handleNextWord} // Manuel geçiş
                onTimeUp={handleModalTimeUp} // Otomatik geçiş
            />

            {/* Üst Bilgi */}
            <div className="flex justify-between items-center p-4 bg-black/20 rounded-xl mb-4 border border-white/5">
                <div className="text-center">
                    <div className="text-xs text-white/50">KELİME</div>
                    <div className="font-bold text-xl">{wordIndex + 1}/{targetWords.length}</div>
                </div>

                {/* Timer */}
                <BearTimer
                    duration={duration} // 60 saniye
                    onTimeUp={handleLose}
                    isRunning={gameStatus === 'playing'}
                />

                <div className="text-center">
                    <div className="text-xs text-white/50">PUAN</div>
                    <div className="font-bold text-xl text-yellow-400">{totalScore}</div>
                </div>
            </div>

            {/* Oyun Tahtası */}
            <div className="flex-1 flex flex-col justify-center mb-4 min-h-[350px]">
                <div className="grid grid-rows-6 gap-1.5 aspect-[5/6] max-h-[400px] mx-auto w-full">
                    {/* Geçmiş Tahminler */}
                    {guesses.map((guess, i) => (
                        <div key={i} className="grid grid-cols-5 gap-1.5">
                            {guess.split('').map((letter, j) => (
                                <motion.div
                                    key={j}
                                    initial={{ rotateX: 0 }}
                                    animate={{ rotateX: 360 }}
                                    transition={{ delay: j * 0.1, duration: 0.5 }}
                                    className={`
                                        flex items-center justify-center text-2xl font-bold rounded-lg border-2 select-none
                                        ${results[i][j].status === 'correct' ? 'bg-success-500 border-success-600' :
                                            results[i][j].status === 'present' ? 'bg-warning-500 border-warning-600' :
                                                'bg-dark-300 border-dark-400 text-white/50'}
                                    `}
                                >
                                    {letter}
                                </motion.div>
                            ))}
                        </div>
                    ))}

                    {/* Mevcut Tahmin */}
                    {gameStatus === 'playing' && guesses.length < 6 && (
                        <motion.div
                            className="grid grid-cols-5 gap-1.5"
                            animate={shakeRow ? { x: [-5, 5, -5, 5, 0] } : {}}
                            transition={{ duration: 0.4 }}
                        >
                            {[...Array(5)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`
                                        flex items-center justify-center text-2xl font-bold rounded-lg border-2 bg-dark-200/50
                                        ${currentGuess[i] ? 'border-white/50 text-white' : 'border-white/10 text-transparent'}
                                        ${shakeRow ? 'border-error-500' : ''}
                                    `}
                                >
                                    {currentGuess[i] || ''}
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {/* Boş Satırlar */}
                    {[...Array(Math.max(0, 5 - guesses.length))].map((_, i) => (
                        <div key={`empty-${i}`} className="grid grid-cols-5 gap-1.5 opacity-30">
                            {[...Array(5)].map((_, j) => (
                                <div key={j} className="border-2 border-white/10 rounded-lg bg-dark-200/20"></div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Hata Mesajı */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-20 left-1/2 -translate-x-1/2 bg-error-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg z-50 text-sm whitespace-nowrap"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sanal Klavye */}
            <div className="pb-4">
                <GameKeyboard
                    onKeyPress={handleKeyPress}
                    onDelete={handleBackspace}
                    onEnter={handleEnter}
                    keyState={keyboardState}
                />
            </div>
        </div>
    )
}
