'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface TimerBarProps {
    startTime: string
    duration: number
    isMyTurn: boolean
}

export default function TimerBar({ startTime, duration, isMyTurn }: TimerBarProps) {
    const [progress, setProgress] = useState(100)

    useEffect(() => {
        const start = new Date(startTime).getTime()
        const end = start + (duration * 1000)

        const tick = () => {
            const now = Date.now()
            const remaining = Math.max(0, end - now)
            const p = (remaining / (duration * 1000)) * 100

            setProgress(p)

            if (p > 0) requestAnimationFrame(tick)
        }

        tick()
    }, [startTime, duration])

    return (
        <motion.div
            className="h-full"
            initial={{ width: '100%' }}
            animate={{
                width: `${progress}%`,
                backgroundColor: progress < 20 ? '#ef4444' : progress < 50 ? '#f59e0b' : '#3b82f6'
            }}
            transition={{ ease: 'linear', duration: 0.1 }} // Smooth updates from rAF
        />
    )
}
