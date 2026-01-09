'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import GameKeyboard from './GameKeyboard'
import AnswerModal from './AnswerModal'
import BearTimer from './BearTimer'
import { isCorrectGuess, evaluateGuess, getKeyboardState } from '@/lib/gameLogic'
import { isValidWord } from '@/lib/words'
import type { LetterResult } from '@/lib/supabase'

interface TurnBasedBoardProps {
    targetWord: string
    isMyTurn: boolean
    currentPlayerName: string
    onTurnComplete: (success: boolean, attempts: number) => void
    onTimeUp: () => void
}

export default function TurnBasedBoard({
    targetWord,
    isMyTurn,
    currentPlayerName,
    onTurnComplete,
    onTimeUp
}: TurnBasedBoardProps) {
    const [guesses, setGuesses] = useState<string[]>([])
    const [results, setResults] = useState<LetterResult[][]>([])
    const [currentGuess, setCurrentGuess] = useState('')
    const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing')
    const [shakeRow, setShakeRow] = useState(false)
    const [error, setError] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [isWin, setIsWin] = useState(false)

    const handleKeyPress = (key: string) => {
        if (!isMyTurn || gameStatus !== 'playing') return
        if (currentGuess.length < targetWord.length) {
            if (/^[a-zA-ZğüşıöçĞÜŞİÖÇ]$/.test(key)) {
                setCurrentGuess(prev => prev + key.toLocaleUpperCase('tr-TR'))
            }
        }
    }

    const handleEnter = async () => {
        if (!isMyTurn || gameStatus !== 'playing') return
        await submitGuess()
    }

    const handleBackspace = () => {
        if (!isMyTurn || gameStatus !== 'playing') return
        setCurrentGuess(prev => prev.slice(0, -1))
    }

    const handleWin = () => {
        setIsWin(true)
        setShowModal(true)
        setGameStatus('won')
        onTurnComplete(true, guesses.length + 1)
    }

    const handleLose = () => {
        setIsWin(false)
        setShowModal(true)
        setGameStatus('lost')
        onTurnComplete(false, 6)
    }

    const submitGuess = async () => {
        if (currentGuess.length !== targetWord.length) {
            setShakeRow(true)
            setTimeout(() => setShakeRow(false), 500)
            return
        }

        const valid = await isValidWord(currentGuess)

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

    const handleTimeUpInternal = () => {
        if (gameStatus !== 'playing') return
        handleLose()
        onTimeUp()
    }

    const keyboardState = getKeyboardState(results)

    // Spectator view - Show the board but disabled
    if (!isMyTurn) {
        return (
            <div className="flex flex-col h-full max-w-lg mx-auto w-full relative opacity-75">
                <div className="text-center mb-4 p-4 bg-primary-500/20 rounded-xl border border-primary-500/30">
                    <div className="text-2xl mb-2">👀</div>
                    <h2 className="text-lg font-bold text-white mb-1">Sıra {currentPlayerName}'de</h2>
                    <p className="text-sm text-white/70">Tahmin yapması bekleniyor...</p>
                </div>

                <div className="flex-1 overflow-y-auto min-h-[400px] flex items-center justify-center">
                    <div className="grid gap-2 p-4">
                        {guesses.map((guess, i) => (
                            <Row
                                key={i}
                                word={guess}
                                target={targetWord}
                                submitted={true}
                                result={results[i]}
                            />
                        ))}

                        {gameStatus === 'playing' && (
                            <Row
                                word={currentGuess}
                                target={targetWord}
                                submitted={false}
                                shake={shakeRow}
                                length={targetWord.length}
                            />
                        )}

                        {Array.from({ length: Math.max(0, 5 - guesses.length - 1) }).map((_, i) => (
                            <Row key={`empty-${i}`} word="" target="" submitted={false} length={targetWord.length} />
                        ))}
                    </div>
                </div>

                <div className="pb-4 opacity-50 pointer-events-none">
                    <GameKeyboard
                        onKeyPress={() => { }}
                        onEnter={() => { }}
                        onBackspace={() => { }}
                        keyStates={keyboardState}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full max-w-lg mx-auto w-full relative">
            <AnswerModal
                isOpen={showModal}
                isWin={isWin}
                targetWord={targetWord}
                onNext={() => setShowModal(false)}
            />

            {error && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="bg-danger-500/90 text-white px-4 py-2 rounded-lg shadow-lg font-bold animate-pulse">
                        {error}
                    </div>
                </div>
            )}

            <div className="px-4 mb-4">
                <BearTimer
                    key={guesses.length}
                    duration={60}
                    onTimeUp={handleTimeUpInternal}
                    isRunning={gameStatus === 'playing' && !showModal}
                />
            </div>

            <div className="text-center mb-4">
                <span className="bg-primary-600 text-white px-4 py-2 rounded-full text-sm font-bold">
                    Senin Sıran! 🎯
                </span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[400px] flex items-center justify-center">
                <div className="grid gap-2 p-4">
                    {guesses.map((guess, i) => (
                        <Row
                            key={i}
                            word={guess}
                            target={targetWord}
                            submitted={true}
                            result={results[i]}
                        />
                    ))}

                    {gameStatus === 'playing' && (
                        <Row
                            word={currentGuess}
                            target={targetWord}
                            submitted={false}
                            shake={shakeRow}
                            length={targetWord.length}
                        />
                    )}

                    {Array.from({ length: Math.max(0, 5 - guesses.length - 1) }).map((_, i) => (
                        <Row key={`empty-${i}`} word="" target="" submitted={false} length={targetWord.length} />
                    ))}
                </div>
            </div>

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

function Row({ word, target, submitted, shake, length = 5, result }: any) {
    const letters = word.split('')
    const emptyCount = length - letters.length
    const feedback = result || []

    return (
        <motion.div
            className="flex gap-2"
            animate={shake ? { x: [-5, 5, -5, 5, 0] } : {}}
            transition={{ duration: 0.4 }}
        >
            {letters.map((letter: string, i: number) => {
                let bgColor = 'bg-dark-200/50 border-white/10'

                if (submitted && feedback[i]) {
                    if (feedback[i].status === 'correct') bgColor = 'bg-success-500 border-success-500'
                    else if (feedback[i].status === 'present') bgColor = 'bg-warning-500 border-warning-500'
                    else if (feedback[i].status === 'invalid') bgColor = 'bg-danger-500 border-danger-500'
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
