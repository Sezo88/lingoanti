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
    usedJokers?: Set<string>
    showPanel?: boolean
    onClose?: () => void
}

export default function JokerPanel({ targetWord, currentGuesses, gameId, onJokerUsed, usedJokers = new Set(), showPanel = false, onClose }: JokerPanelProps) {
    const { tickets } = useCurrency()
    const { loading, useGreenLetter, useYellowLetter, useExtraAttempt, useRevealWord } = useJoker(
        targetWord,
        currentGuesses,
        gameId
    )
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
            name: 'Kelimeyi Göster',
            icon: '💡',
            cost: 100,
            description: 'Doğru kelimeyi göster',
            action: useRevealWord
        }
    ]

    const handleJokerClick = async (joker: typeof jokers[0]) => {
        setError(null)

        if (tickets < joker.cost) {
            setError(`Yeterli biletiniz yok! ${joker.cost} bilet gerekli.`)
            setTimeout(() => setError(null), 3000)
            return
        }

        const result = await joker.action()
        if (result && result.success) {
            onJokerUsed(joker.id, result.data)
            if (onClose) onClose()
        } else if (result && result.error) {
            setError(result.error)
            setTimeout(() => setError(null), 3000)
        }
    }

    return (
        <>
            {/* Joker Panel Modal - Compact */}
            <AnimatePresence>
                {showPanel && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center p-4"
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="glass-card rounded-t-3xl max-w-md w-full p-4 pb-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-bold text-white">✨ Jokerler</h3>
                                    <div className="flex items-center gap-1.5 bg-primary-500/20 border border-primary-500/30 rounded-lg px-2 py-1">
                                        <span className="text-sm">🎫</span>
                                        <span className="text-sm font-bold text-primary-400">{tickets}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-white/60 hover:text-white text-xl"
                                >
                                    ✕
                                </button>
                            </div>

                            {error && (
                                <div className="mb-3 p-2 bg-danger-500/20 border border-danger-500/50 rounded-lg text-danger-400 text-xs text-center">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                {jokers.map((joker) => {
                                    const isUsed = usedJokers.has(joker.id)
                                    const canAfford = tickets >= joker.cost
                                    const isDisabled = isUsed || !canAfford || loading

                                    return (
                                        <button
                                            key={joker.id}
                                            onClick={() => handleJokerClick(joker)}
                                            disabled={isDisabled}
                                            className={`
                                                p-3 rounded-xl border-2 transition-all text-left
                                                ${isDisabled
                                                    ? 'bg-dark-300/50 border-dark-300 opacity-50 cursor-not-allowed'
                                                    : 'bg-dark-200 border-primary-500/30 hover:border-primary-500 hover:scale-105'
                                                }
                                            `}
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <span className="text-2xl">{joker.icon}</span>
                                                <div className="text-xs font-bold text-yellow-400">
                                                    🎫 {joker.cost}
                                                </div>
                                            </div>
                                            <div className="text-sm font-bold text-white mb-0.5">{joker.name}</div>
                                            <div className="text-[10px] text-white/60 leading-tight">{joker.description}</div>
                                            {isUsed && (
                                                <div className="text-[9px] text-danger-400 mt-1 font-bold">
                                                    (Kullanıldı)
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                onClick={onClose}
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
