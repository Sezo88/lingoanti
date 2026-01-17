'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AdModalProps {
    isOpen: boolean
    onClose: () => void
    onReward: () => void
}

export default function AdModal({ isOpen, onClose, onReward }: AdModalProps) {
    const [timeLeft, setTimeLeft] = useState(15) // 15 seconds ad
    const [canSkip, setCanSkip] = useState(false)
    const [rewardEarned, setRewardEarned] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setTimeLeft(15)
            setCanSkip(false)
            setRewardEarned(false)

            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer)
                        setCanSkip(true)
                        setRewardEarned(true)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)

            return () => clearInterval(timer)
        }
    }, [isOpen])

    const handleClose = () => {
        if (rewardEarned) {
            onReward()
        }
        onClose()
    }

    // Early close attempt
    const handleOverlayClick = () => {
        if (canSkip) {
            handleClose()
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/95 backdrop-blur-sm"
                        onClick={handleOverlayClick}
                    />

                    {/* Ad Content */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative w-full max-w-lg aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col items-center justify-center p-6 z-[101]"
                    >
                        {/* Fake Ad Video Content */}
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 bg-primary-500 rounded-2xl mx-auto flex items-center justify-center animate-bounce">
                                <span className="text-4xl">🛍️</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white">Süper İndirimler!</h3>
                            <p className="text-white/70">En iyi ürünler LingoAnti'de...</p>
                        </div>

                        {/* Timer / Skip Button */}
                        <div className="absolute top-4 right-4">
                            {!canSkip ? (
                                <div className="bg-black/50 text-white text-sm font-mono px-3 py-1.5 rounded-full border border-white/20">
                                    Reklam: {timeLeft}s
                                </div>
                            ) : (
                                <button
                                    onClick={handleClose}
                                    className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
                                >
                                    <span>Ödülü Al</span>
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                            <motion.div
                                className="h-full bg-primary-500"
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 15, ease: "linear" }}
                            />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
