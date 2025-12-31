'use client'

import { motion } from 'framer-motion'
import type { LetterResult } from '@/lib/supabase'

interface GameBoardProps {
    guesses: string[]
    currentGuess: string
    wordLength: number
    maxGuesses?: number
    results: LetterResult[][]
}

export default function GameBoard({
    guesses,
    currentGuess,
    wordLength,
    maxGuesses = 6,
    results
}: GameBoardProps) {
    const emptyRows = maxGuesses - guesses.length - (currentGuess ? 1 : 0)

    return (
        <div className="flex flex-col gap-2 mb-6">
            {/* Submitted guesses */}
            {guesses.map((guess, rowIndex) => (
                <div key={`guess-${rowIndex}`} className="flex gap-2 justify-center">
                    {guess.split('').map((letter, colIndex) => {
                        const result = results[rowIndex]?.[colIndex]
                        const status = result?.status || 'absent'

                        return (
                            <motion.div
                                key={`${rowIndex}-${colIndex}`}
                                initial={{ scale: 0.8, rotateX: 0 }}
                                animate={{ scale: 1, rotateX: 360 }}
                                transition={{ delay: colIndex * 0.1, duration: 0.4 }}
                                className={`
                  w-14 h-14 flex items-center justify-center
                  text-2xl font-bold rounded-lg
                  ${status === 'correct' ? 'letter-correct' : ''}
                  ${status === 'present' ? 'letter-present' : ''}
                  ${status === 'absent' ? 'letter-absent' : ''}
                  ${status === 'invalid' ? 'letter-invalid' : ''}
                `}
                            >
                                {letter}
                            </motion.div>
                        )
                    })}
                </div>
            ))}

            {/* Current guess (active row) */}
            {currentGuess && (
                <div className="flex gap-2 justify-center">
                    {Array.from({ length: wordLength }).map((_, colIndex) => {
                        const letter = currentGuess[colIndex] || ''

                        return (
                            <motion.div
                                key={`current-${colIndex}`}
                                animate={{ scale: letter ? [1, 1.1, 1] : 1 }}
                                transition={{ duration: 0.2 }}
                                className={`
                  w-14 h-14 flex items-center justify-center
                  text-2xl font-bold rounded-lg
                  ${letter ? 'letter-empty border-primary-500' : 'letter-empty'}
                `}
                            >
                                {letter}
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Empty rows */}
            {Array.from({ length: emptyRows }).map((_, rowIndex) => (
                <div key={`empty-${rowIndex}`} className="flex gap-2 justify-center">
                    {Array.from({ length: wordLength }).map((_, colIndex) => (
                        <div
                            key={`${rowIndex}-${colIndex}`}
                            className="w-14 h-14 letter-empty rounded-lg"
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}
