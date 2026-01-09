'use client'

import { motion } from 'framer-motion'

interface AnswerModalProps {
    isOpen: boolean
    isWin: boolean
    targetWord: string
    onNext: () => void
}

export default function AnswerModal({ isOpen, isWin, targetWord, onNext }: AnswerModalProps) {
    useEffect(() => {
        if (isOpen && !isWin) {
            // Kaybedince 5 saniye sonra otomatik kapat
            const timer = setTimeout(() => {
                onNext()
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [isOpen, isWin, onNext])

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
                    {!isWin && (
                        <p className="text-sm text-white/60 mt-4">5 saniye sonra otomatik kapanacak...</p>
                    )}
                </div>
                <button
                    onClick={onNext}
                    className="px-8 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold transition-all text-lg"
                >
                    {isWin ? 'Devam Et' : 'Tamam'}
                </button>
            </motion.div>
        </div>
    )
}
