'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import GameKeyboard from './GameKeyboard'
import { evaluateGuess, getKeyboardState } from '@/lib/gameLogic'
import { isValidWord } from '@/lib/words'
import type { LetterResult } from '@/lib/supabase'

interface TurnBasedBoardProps {
    targetWord: string
    isMyTurn: boolean
    currentPlayerName: string
    sharedGuesses: string[]
    sharedResults: any[]
    onGuessSubmit: (guess: string, result: any[]) => void
    winFeedback?: { winnerName: string; word: string; score: number; isMe: boolean } | null
    participants: any[]
    duration: number
    turnStartTime?: number
    onLeave: () => void
    onTimeout: () => void
}

export default function TurnBasedBoard({
    targetWord,
    isMyTurn,
    currentPlayerName,
    sharedGuesses,
    sharedResults,
    onGuessSubmit,
    winFeedback,
    participants,
    duration,
    turnStartTime,
    onLeave,
    onTimeout
}: TurnBasedBoardProps) {
    const [currentGuess, setCurrentGuess] = useState('')
    const [shakeRow, setShakeRow] = useState(false)
    const [error, setError] = useState('')
    const [timeLeft, setTimeLeft] = useState(duration)

    // Server-Sync Timer Logic
    useEffect(() => {
        if (!turnStartTime) return

        const calculateTimeLeft = () => {
            const now = Date.now()
            const elapsed = Math.floor((now - turnStartTime) / 1000)
            const remaining = Math.max(0, duration - elapsed)
            return remaining
        }

        setTimeLeft(calculateTimeLeft())

        const timer = setInterval(() => {
            const remaining = calculateTimeLeft()
            setTimeLeft(remaining)

            if (remaining === 0 && isMyTurn) {
                clearInterval(timer)
                onTimeout()
            }
        }, 1000)

        return () => clearInterval(timer)
    }, [turnStartTime, duration, isMyTurn])

    // Sıra değiştiğinde input'u temizle
    useEffect(() => {
        if (!isMyTurn) {
            setCurrentGuess('')
        }
    }, [isMyTurn])

    const handleKeyPress = (key: string) => {
        if (!isMyTurn) return
        if (currentGuess.length < targetWord.length) {
            if (/^[a-zA-ZğüşıöçĞÜŞİÖÇ]$/.test(key)) {
                setCurrentGuess(prev => prev + key.toLocaleUpperCase('tr-TR'))
            }
        }
    }

    const handleEnter = async () => {
        if (!isMyTurn) return
        await submitGuess()
    }

    const handleBackspace = () => {
        if (!isMyTurn) return
        setCurrentGuess(prev => prev.slice(0, -1))
    }

    const submitGuess = async () => {
        if (currentGuess.length !== targetWord.length) {
            setShakeRow(true)
            setTimeout(() => setShakeRow(false), 500)
            return
        }

        const valid = await isValidWord(currentGuess)

        if (!valid) {
            // Geçersiz kelime - Kırmızı göster ve hak yak
            setShakeRow(true)
            setTimeout(() => setShakeRow(false), 500)
            setError('Geçersiz kelime!')
            setTimeout(() => setError(''), 2000)

            const invalidResult = currentGuess.split('').map(letter => ({
                letter,
                status: 'invalid' as const
            }))

            // Geçersiz kelimeyi de kaydet ve sırayı değiştir
            onGuessSubmit(currentGuess, invalidResult)
            setCurrentGuess('')
            return
        }

        const evalResult = evaluateGuess(currentGuess, targetWord)

        console.log('🎯 Evaluation:', {
            guess: currentGuess,
            target: targetWord,
            result: evalResult
        })

        // Tahmini parent'a gönder
        onGuessSubmit(currentGuess, evalResult)
        setCurrentGuess('')
    }

    console.log('📊 Shared Data:', {
        guesses: sharedGuesses,
        results: sharedResults,
        resultsType: typeof sharedResults,
        isArray: Array.isArray(sharedResults)
    })

    const keyboardState = getKeyboardState(sharedResults)

    return (
        <div className="flex flex-col h-full max-w-lg mx-auto w-full relative">
            {error && (
                <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="bg-danger-500/90 text-white px-4 py-2 rounded-lg shadow-lg font-bold animate-pulse">
                        {error}
                    </div>
                </div>
            )}

            {/* HEADER & LEAVE BUTTON */}
            <div className="flex items-center justify-between mb-2 px-2 relative z-20">
                <button
                    onClick={onLeave}
                    className="p-2 bg-danger-500/20 text-danger-400 hover:bg-danger-500 hover:text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                >
                    🚧 Çık
                </button>

                <div className="flex-1 text-center">
                    <div className="bg-primary-500/20 px-4 py-2 rounded-xl inline-block border border-primary-500/30">
                        <div className="text-xs text-white/70 mb-0.5">
                            {isMyTurn ? '🎯 SIRA SENDE!' : `⏳ ${currentPlayerName} oynuyor`}
                        </div>
                        <div className="text-xl font-mono font-bold text-white">
                            {timeLeft}sn
                        </div>
                    </div>
                </div>

                <div className="w-[50px]"></div> {/* Spacer */}
            </div>

            {/* KAZANAN GERİ BİLDİRİMİ OVERLAY */}
            {winFeedback && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-xl"
                >
                    <div className="text-center p-6 bg-dark-100 border border-success-500/50 rounded-2xl shadow-2xl animate-bounce-subtle">
                        <div className="text-4xl mb-2">🏆</div>
                        <h3 className="text-xl font-bold text-white mb-1">
                            {winFeedback.isMe ? 'TEBRİKLER!' : `${winFeedback.winnerName} Bildi!`}
                        </h3>
                        <p className="text-success-400 font-mono text-2xl font-bold tracking-widest mb-2">
                            {winFeedback.word}
                        </p>
                        <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold inline-block">
                            +{winFeedback.score} Puan
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="flex-1 overflow-y-auto flex items-center justify-center py-2">
                <div className="grid gap-1.5 px-4">
                    {/* Ortak tahminler */}
                    {sharedGuesses.map((guess, i) => (
                        <Row
                            key={i}
                            word={guess}
                            target={targetWord}
                            submitted={true}
                            result={sharedResults[i]}
                            length={targetWord.length}
                        />
                    ))}

                    {/* Şu anki tahmin (sadece sıra sendeyse) */}
                    {isMyTurn && (
                        <Row
                            word={currentGuess}
                            target={targetWord}
                            submitted={false}
                            shake={shakeRow}
                            length={targetWord.length}
                        />
                    )}

                    {/* Boş satırlar */}
                    {Array.from({ length: Math.max(0, 5 - sharedGuesses.length - (isMyTurn ? 1 : 0)) }).map((_, i) => (
                        <Row key={`empty-${i}`} word="" target="" submitted={false} length={targetWord.length} />
                    ))}
                </div>
            </div>

            <div className={`pb-2 ${!isMyTurn ? 'opacity-50 pointer-events-none' : ''}`}>
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
            className="flex gap-2 justify-center"
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
