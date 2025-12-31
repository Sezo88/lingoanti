'use client'

import { motion } from 'framer-motion'

interface GameKeyboardProps {
    onKeyPress: (key: string) => void
    onEnter: () => void
    onBackspace: () => void
    keyStates?: Map<string, 'correct' | 'present' | 'absent'>
}

const KEYBOARD_ROWS = [
    ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
    ['Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç']
]

export default function GameKeyboard({
    onKeyPress,
    onEnter,
    onBackspace,
    keyStates
}: GameKeyboardProps) {
    return (
        <div className="w-full max-w-2xl mx-auto pb-safe">
            {KEYBOARD_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-1 mb-2 justify-center">
                    {/* Backspace button (left side, row 3) */}
                    {rowIndex === 2 && (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={onBackspace}
                            className="px-3 py-4 bg-dark-200 hover:bg-dark-300 rounded-lg font-semibold text-sm min-w-[60px] active:bg-dark-400 transition-colors"
                        >
                            ⌫
                        </motion.button>
                    )}

                    {/* Letter keys */}
                    {row.map(key => {
                        const status = keyStates?.get(key)

                        return (
                            <motion.button
                                key={key}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onKeyPress(key)}
                                className={`
                  px-3 py-4 rounded-lg font-bold text-lg min-w-[32px] sm:min-w-[40px]
                  transition-colors active:scale-95
                  ${status === 'correct' ? 'bg-success-600 text-white' : ''}
                  ${status === 'present' ? 'bg-warning-500 text-white' : ''}
                  ${status === 'absent' ? 'bg-dark-400 text-dark-700' : ''}
                  ${!status ? 'bg-dark-200 hover:bg-dark-300 text-white' : ''}
                `}
                            >
                                {key}
                            </motion.button>
                        )
                    })}

                    {/* Enter button (right side, row 3 - ORANGE) */}
                    {rowIndex === 2 && (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={onEnter}
                            className="px-3 py-4 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold text-sm min-w-[60px] active:bg-orange-800 transition-colors text-white"
                        >
                            GÖNDER
                        </motion.button>
                    )}
                </div>
            ))}
        </div>
    )
}
