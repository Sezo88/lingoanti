'use client'

import { useEffect, useState } from 'react'

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

    // Renk belirle
    // > %50 Yeşil, < %50 Sarı, < %20 Kırmızı
    let colorClass = 'bg-success-500'
    if (progress < 20) colorClass = 'bg-danger-500'
    else if (progress < 50) colorClass = 'bg-warning-500'

    return (
        <div className="w-full mb-6 relative">
            <div className="flex justify-between items-end text-xs text-dark-400 mb-1 font-mono">
                <span>Süre</span>
                <span className={`text-lg font-bold ${timeLeft <= 10 ? 'text-danger-500 animate-pulse' : 'text-white'}`}>
                    {timeLeft}s
                </span>
            </div>

            <div className="relative h-3 bg-dark-200/50 rounded-full overflow-hidden border border-white/5">
                <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(var(--color),0.5)] ${colorClass}`}
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    )
}
