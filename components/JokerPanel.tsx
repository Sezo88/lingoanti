'use client'

import { useState } from 'react'
import { useJoker } from '@/hooks/useJoker'
import { motion, AnimatePresence } from 'framer-motion'
import { useCurrency } from '@/hooks/useCurrency'

interface JokerPanelProps {
    targetWord: string
    currentGuesses: string[]
    gameId?: string
    onJokerUsed: (jokerType: string, data: any) => void
}

export default function JokerPanel({ targetWord, currentGuesses, gameId, onJokerUsed }: JokerPanelProps) {
    const { tickets } = useCurrency()
    const { loading, useGreenLetter, useYellowLetter, useExtraAttempt, useRevealWord } = useJoker(
        targetWord,
        currentGuesses,
        gameId
    )
    const [showPanel, setShowPanel] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const jokers = [
        {
            id: 'green_letter',
            name: 'Yeşil Harf',
            icon: '🟢',
            cost: 50,
            description: 'Doğru yerde bir harf göster',
            action: useGreenLetter
        },
        {
            id: 'yellow_letter',
            name: 'Sarı Harf',
            icon: '🟡',
            cost: 30,
            description: 'Kelimede var olan bir harf göster',
            action: useYellowLetter
        },
        {
            id: 'extra_attempt',
            name: 'Ekstra Hak',
            icon: '➕',
            cost: 40,
            description: '1 ekstra tahmin hakkı',
            action: useExtraAttempt
        },
        {
            id: 'reveal_word',
            name: 'Kelimeyi Aç',
            icon: '🔓',
            cost: 200,
            description: 'Tüm kelimeyi göster',
            action: useRevealWord
        }
    ]

    const handleJokerClick = async (joker: typeof jokers[0]) => {
        setError(null)

        const result = await joker.action()

        if (result.success) {
            onJokerUsed(joker.id, result.data)
            setShowPanel(false)
        } else {
            setError(result.error || 'Joker kullanılamadı')
        }
    }

    return (
        <>
            {/* Joker Button */}
            <motion.button
                onClick={() => setShowPanel(!showPanel)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full shadow-lg flex items-center justify-center text-2xl z-40"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                ⚡
            </motion.button>

            {/* Joker Panel */}
            <AnimatePresence>
                {showPanel && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowPanel(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass-card p-6 rounded-[24px] max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                <span>⚡</span>
                                Jokerler
                            </h2>

                            {error && (
                                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-3">
                                {jokers.map((joker) => {
                                    const canAfford = tickets >= joker.cost
                                    return (
                                        <motion.button
                                            key={joker.id}
                                            onClick={() => handleJokerClick(joker)}
                                            disabled={!canAfford || loading}
                                            className={`w-full p-4 rounded-xl border-2 transition-all ${canAfford
                                                    ? 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/40'
                                                    : 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                                                }`}
                                            whileHover={canAfford ? { scale: 1.02 } : {}}
                                            whileTap={canAfford ? { scale: 0.98 } : {}}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-3xl">{joker.icon}</span>
                                                    <div className="text-left">
                                                        <div className="font-bold text-white">{joker.name}</div>
                                                        <div className="text-xs text-white/60">{joker.description}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 px-3 py-1 bg-yellow-500/20 rounded-full border border-yellow-500/30">
                                                    <span className="text-sm">🎫</span>
                                                    <span className="font-bold text-white text-sm">{joker.cost}</span>
                                                </div>
                                            </div>
                                        </motion.button>
                                    )
                                })}
                            </div>

                            <button
                                onClick={() => setShowPanel(false)}
                                className="mt-4 w-full py-2 text-white/60 hover:text-white transition-colors"
                            >
                                İptal
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
