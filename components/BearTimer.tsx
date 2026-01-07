'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface BearTimerProps {
    duration: number // saniye cinsinden
    onTimeUp: () => void
    isRunning?: boolean
}

export default function BearTimer({ duration, onTimeUp, isRunning = true }: BearTimerProps) {
    const [timeLeft, setTimeLeft] = useState(duration)

    useEffect(() => {
        setTimeLeft(duration)
    }, [duration])

    useEffect(() => {
        if (!isRunning || timeLeft <= 0) return

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval)
                    onTimeUp()
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [isRunning, timeLeft, onTimeUp])

    // Progress yüzdesi (100 -> 0)
    const progress = (timeLeft / duration) * 100

    // Ayının pozisyonu (0 -> 100%)
    // Ayı sağa doğru yürüsün: left: (100 - progress)%
    const bearPosition = 100 - progress

    return (
        <div className="w-full max-w-md mx-auto mb-6">
            <div className="flex justify-between text-xs text-dark-400 mb-1 font-mono">
                <span>Başlangıç</span>
                <span className={`${timeLeft <= 10 ? 'text-danger-500 animate-pulse font-bold' : ''}`}>
                    {timeLeft}sn
                </span>
                <span>Bitiş</span>
            </div>

            <div className="relative h-4 bg-dark-300 rounded-full overflow-visible">
                {/* Progress Bar Background */}
                <div
                    className="absolute top-0 left-0 h-full bg-primary-500/30 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                ></div>

                {/* Yürüyen Ayı */}
                <motion.div
                    className="absolute -top-3 text-2xl"
                    style={{ left: `${bearPosition}%` }}
                    animate={{
                        // Hafif zıplama efekti (yürüyüş)
                        y: [0, -2, 0]
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 0.5
                    }}
                >
                    <div className="transform -translate-x-1/2">
                        🐻
                    </div>
                </motion.div>

                {/* Hedef Bayrağı */}
                <div className="absolute -right-2 -top-3 text-xl">
                    🏁
                </div>
            </div>
        </div>
    )
}
