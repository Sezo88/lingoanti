'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface AnswerModalProps {
    isOpen: boolean
    isWin: boolean
    targetWord: string
    onNext: () => void
    onRestart?: () => void
}

export default function AnswerModal({ isOpen, isWin, targetWord, onNext, onRestart }: AnswerModalProps) {
    useEffect(() => {
        if (isOpen && !onRestart) {
            // Auto-advance only if no restart option (multiplayer)
            const timer = setTimeout(() => {
                onNext()
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [isOpen, onNext, onRestart])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-card p-8 rounded-2xl max-w-md w-full mx-4 text-center border-2 border-white/20"
            >
                <h2 className={`text-3xl font-bold mb-4 ${isWin ? 'text-green-400' : 'text-white'}`}>
                    {isWin ? 'Tebrikler!' : 'Bilemedin!'}
                </h2>
                <div className="mb-6">
                    <p className="text-white/80 mb-3 text-lg">Doğru kelime:</p>
                    <div className="text-5xl font-black text-yellow-400 tracking-wider drop-shadow-lg mb-2">
                        {targetWord.toLocaleUpperCase('tr-TR')}
                    </div>
                    {!onRestart && (
                        <div className="flex flex-col gap-3 mt-6 w-full">
                            <button
                                onClick={onNext}
                                className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold transition-all text-lg shadow-lg shadow-primary-600/20"
                            >
                                Tamam
                            </button>
                            <p className="text-xs text-white/40 animate-pulse">3 saniye sonra otomatik devam edecek...</p>
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    {onRestart && (
                        <button
                            onClick={onNext}
                            className="flex-1 px-6 py-3 bg-dark-300 hover:bg-dark-400 text-white rounded-xl font-semibold transition-all text-lg"
                        >
                            Çıkış
                        </button>
                    )}
                    <button
                        onClick={onRestart}
                        className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold transition-all text-lg"
                    >
                        Yeni Oyun
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
