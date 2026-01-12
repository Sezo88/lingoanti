'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface GameSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (settings: GameSettings) => void
    friendName: string
}

export interface GameSettings {
    wordLength: number | 'mixed'
    bestOf: 3 | 5 | 7
    duration: number // 0 = unlimited
}

export default function GameSettingsModal({ isOpen, onClose, onConfirm, friendName }: GameSettingsModalProps) {
    const [wordLength, setWordLength] = useState<number | 'mixed'>(5)
    const [bestOf, setBestOf] = useState<3 | 5 | 7>(3)
    const [duration, setDuration] = useState<number>(60)

    const handleConfirm = () => {
        onConfirm({ wordLength, bestOf, duration })
        onClose()
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="glass-effect rounded-2xl p-6 max-w-md w-full"
                >
                    <h2 className="text-2xl font-bold mb-2 text-center gradient-text">
                        Oyun Ayarları
                    </h2>
                    <p className="text-center text-dark-500 mb-6">
                        {friendName} ile oynanacak
                    </p>

                    {/* Kelime Uzunluğu */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-3 text-white">
                            Kelime Uzunluğu
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[4, 5, 6, 7].map((length) => (
                                <button
                                    key={length}
                                    onClick={() => setWordLength(length)}
                                    className={`py-3 rounded-xl font-semibold transition-all ${wordLength === length
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-dark-200 text-dark-500 hover:bg-dark-300'
                                        }`}
                                >
                                    {length} Harf
                                </button>
                            ))}
                            <button
                                onClick={() => setWordLength('mixed')}
                                className={`py-3 rounded-xl font-semibold transition-all col-span-3 ${wordLength === 'mixed'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-dark-200 text-dark-500 hover:bg-dark-300'
                                    }`}
                            >
                                🎲 Karışık (Her el farklı)
                            </button>
                        </div>
                    </div>

                    {/* Best Of */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-3 text-white">
                            Kaç El?
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[3, 5, 7].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => setBestOf(num as 3 | 5 | 7)}
                                    className={`py-3 rounded-xl font-semibold transition-all ${bestOf === num
                                        ? 'bg-success-600 text-white'
                                        : 'bg-dark-200 text-dark-500 hover:bg-dark-300'
                                        }`}
                                >
                                    Best of {num}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-dark-500 mt-2 text-center">
                            İlk {Math.ceil(bestOf / 2)} eli kazanan maçı alır
                        </p>
                    </div>

                    {/* Süre Seçimi */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-3 text-white">
                            Süre (Her El İçin)
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {[30, 60, 90, 0].map((dur) => (
                                <button
                                    key={dur}
                                    onClick={() => setDuration(dur)}
                                    className={`py-3 rounded-xl font-semibold transition-all ${duration === dur
                                        ? 'bg-warning-600 text-white'
                                        : 'bg-dark-200 text-dark-500 hover:bg-dark-300'
                                        }`}
                                >
                                    {dur === 0 ? '∞' : `${dur}s`}
                                </button>
                            ))}
                        </div>
                        {duration === 0 && (
                            <p className="text-xs text-dark-500 mt-2 text-center">
                                Süresiz - Rahatça düşünebilirsiniz
                            </p>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl font-semibold bg-dark-300 text-white hover:bg-dark-400 transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 py-3 rounded-xl font-semibold gradient-bg text-white hover:opacity-90 transition-all"
                        >
                            Davet Gönder
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
