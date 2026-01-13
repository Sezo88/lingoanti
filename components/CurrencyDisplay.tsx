'use client'

import { useEffect, useState } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { motion, AnimatePresence } from 'framer-motion'

export default function CurrencyDisplay() {
    const { tickets, hearts, loading, getTimeUntilNextHeart } = useCurrency()
    const [timeUntilRegen, setTimeUntilRegen] = useState<string | null>(null)

    // Update countdown every second
    useEffect(() => {
        const interval = setInterval(() => {
            const time = getTimeUntilNextHeart()
            setTimeUntilRegen(time)
        }, 1000)

        return () => clearInterval(interval)
    }, [getTimeUntilNextHeart])

    if (loading) {
        return (
            <div className="flex gap-3 items-center">
                <div className="w-16 h-8 bg-white/10 rounded-full animate-pulse" />
                <div className="w-16 h-8 bg-white/10 rounded-full animate-pulse" />
            </div>
        )
    }

    return (
        <div className="flex gap-3 items-center">
            {/* Tickets */}
            <motion.div
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full border border-yellow-500/30"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <span className="text-xl">🎫</span>
                <span className="font-bold text-white">{tickets}</span>
            </motion.div>

            {/* Hearts */}
            <motion.div
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-full border border-red-500/30"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <span className="text-xl">❤️</span>
                <span className="font-bold text-white">{hearts}/5</span>
                {timeUntilRegen && hearts < 5 && (
                    <span className="text-xs text-white/60 ml-1">
                        {timeUntilRegen}
                    </span>
                )}
            </motion.div>
        </div>
    )
}
