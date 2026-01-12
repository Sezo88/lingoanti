'use client'

import { motion } from 'framer-motion'

interface GameKeyboardProps {
    onKeyPress: (key: string) => void
    onEnter: () => void
    onBackspace: () => void
    keyStates?: Map<string, 'correct' | 'present' | 'absent'>
    disabled?: boolean
}

const KEYBOARD_ROWS = [
    ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
    ['Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç']
]

export default function GameKeyboard({ onKeyPress, onEnter, onBackspace, keyStates, disabled = false }: GameKeyboardProps) {
    const rows = [
        ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
        ['Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç']
    ]

    return (
        <div className="w-full max-w-2xl mx-auto pb-safe">
            {rows.map((row, i) => (
                <div key={i} className="flex gap-1 mb-1 justify-center">
                    {row.map((key) => {
                        const state = keyStates?.get(key)
                        return (
                            <motion.button
                                key={key}
                                whileTap={disabled ? {} : { scale: 0.95 }}
                                onClick={() => !disabled && onKeyPress(key)}
                                disabled={disabled}
                                className={`flex-1 h-12 rounded-lg font-bold transition-all text-sm sm:text-base
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 active:scale-95'}
                  ${state === 'correct' ? 'bg-success-600 text-white' :
                                        state === 'present' ? 'bg-warning-600 text-white' :
                                            state === 'absent' ? 'bg-dark-400 text-dark-600' :
                                                'bg-dark-200 text-white'}`}
                            >
                                {key}
                            </motion.button>
                        )
                    })}
                    {i === 2 && (
                        <motion.button
                            whileTap={disabled ? {} : { scale: 0.95 }}
                            onClick={() => !disabled && onBackspace()}
                            disabled={disabled}
                            className={`flex-1 max-w-[60px] h-12 rounded-lg bg-dark-300 text-white font-bold transition-all text-lg
                                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-dark-400 active:scale-95'}`}
                        >
                            ⌫
                        </motion.button>
                    )}
                </div>
            ))}

            {/* Send button - standalone 4th row */}
            <div className="flex justify-center mt-2">
                <motion.button
                    whileTap={disabled ? {} : { scale: 0.95 }}
                    onClick={() => !disabled && onEnter()}
                    disabled={disabled}
                    className={`w-full max-w-md h-14 rounded-lg bg-orange-600 text-white font-bold transition-all text-lg
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-700 active:scale-95'}`}
                >
                    GÖNDER
                </motion.button>
            </div>
        </div>
    )
}
