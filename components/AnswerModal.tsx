'use client'

import { motion } from 'framer-motion'

interface AnswerModalProps {
    isOpen: boolean
    isWin: boolean
    targetWord: string
    onNext: () => void
}

export default function AnswerModal({ isOpen, isWin, targetWord, onNext }: AnswerModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-dark-100 border border-white/10 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl"
            >
                <div className="text-4xl mb-4">
                    {isWin ? '🎉' : '🤔'}
                </div>

                <h2 className={`text-2xl font-bold mb-2 ${isWin ? 'text-success-500' : 'text-danger-500'}`}>
                    {isWin ? 'Tebrikler!' : 'Bilemedin!'}
                </h2>

                {!isWin && (
                    <>
                        <p className="text-dark-400 text-sm mb-1">Doğru Cevap:</p>
                        <p className="text-3xl font-bold text-white tracking-widest mb-6 font-mono bg-dark-200 py-2 rounded-lg">
                            {targetWord}
                        </p>
                    </>
                )}

                {isWin && (
                    <p className="text-dark-300 mb-6">
                        Harika gidiyorsun!
                    </p>
                )}

                <button
                    onClick={onNext}
                    className="w-full py-3 rounded-xl font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/20"
                >
                    Tamam, Devam Et →
                </button>
            </motion.div>
        </div>
    )
}
