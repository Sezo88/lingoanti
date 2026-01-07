import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameKeyboard from './GameKeyboard'
import AnswerModal from './AnswerModal'
import BearTimer from './BearTimer'
import { isCorrectGuess, evaluateGuess, getKeyboardState } from '@/lib/gameLogic'
import { isValidWord } from '@/lib/words'
import type { LetterResult } from '@/lib/supabase'

interface ArenaBoardProps {
    targetWords: string[] // Sırasıyla sorulacak kelimeler
    onProgress: (wordIndex: number, isFinished: boolean) => void // İlerleme olduğunda (yeni kelimeye geçince) tetiklenir
}

export default function ArenaBoard({ targetWords, onProgress }: ArenaBoardProps) {
    const [wordIndex, setWordIndex] = useState(0)
    const [guesses, setGuesses] = useState<string[]>([])
    const [results, setResults] = useState<LetterResult[][]>([]) // Sonuçları tutmak için
    const [currentGuess, setCurrentGuess] = useState('')
    const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost' | 'finished'>('playing')
    const [shakeRow, setShakeRow] = useState(false)
    const [error, setError] = useState('')

    // Modal State
    const [showModal, setShowModal] = useState(false)
    const [isWin, setIsWin] = useState(false)

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
        if (currentGuess.length < targetWord.length) {
            // Sadece Türkçe karakterleri ve harfleri kabul et
            if (/^[a-zA-ZğüşıöçĞÜŞİÖÇ]$/.test(key)) {
                setCurrentGuess(prev => prev + key.toLocaleUpperCase('tr-TR'))
            }
        }
    }

    const handleEnter = async () => {
        if (gameStatus !== 'playing') return
        await submitGuess()
    }

    const handleBackspace = () => {
        if (gameStatus !== 'playing') return
        setCurrentGuess(prev => prev.slice(0, -1))
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

            setGuesses(newGuesses)
            setResults(newResults)
            setCurrentGuess('')

            // Hak bitti mi?
            if (newGuesses.length >= 6) {
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
        if (isCorrectGuess(currentGuess, targetWord)) {
            // Kelime bilindi!
            handleWin()
        } else if (newGuesses.length >= 6) {
            handleLose()
        }
    }

    const handleWin = () => {
        setIsWin(true)
        setShowModal(true)
        setGameStatus('won') // Geçici durum
    }

    const handleLose = () => {
        setIsWin(false)
        setShowModal(true)
        setGameStatus('lost')
    }

    const handleNextWord = () => {
        setShowModal(false)
        const nextIndex = wordIndex + 1
        setWordIndex(nextIndex)
        setGuesses([])
        setResults([])
        setGameStatus('playing')

        onProgress(nextIndex, nextIndex >= targetWords.length)

        if (nextIndex >= targetWords.length) {
            setGameStatus('finished')
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
                <p className="text-dark-300">Tüm kelimeleri tamamladın.</p>
                <p className="text-sm text-dark-400 mt-4">Diğerlerinin bitirmesi bekleniyor...</p>
            </div>
        )
    }

    // Klavye durumunu hesapla
    const keyboardState = getKeyboardState(results)

    return (
        <div className="flex flex-col h-full max-w-lg mx-auto w-full relative">
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
                    duration={60}
                    onTimeUp={handleTimeUp}
                    isRunning={gameStatus === 'playing' && !showModal}
                />
            </div>

            {/* Header: Kaçıncı kelime */}
            <div className="text-center mb-4">
                <span className="bg-dark-200 text-primary-400 px-3 py-1 rounded-full text-sm font-bold border border-white/5">
                    Kelime {wordIndex + 1} / {targetWords.length}
                </span>
            </div>

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
                        />
                    )}

                    {/* Boş satırlar */}
                    {Array.from({ length: Math.max(0, 5 - guesses.length - 1) }).map((_, i) => (
                        <Row key={`empty-${i}`} word="" target="" submitted={false} length={targetWord.length} />
                    ))}
                </div>
            </div>

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
function Row({ word, target, submitted, shake, length = 5, result }: any) {
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

                if (submitted && feedback[i]) {
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
