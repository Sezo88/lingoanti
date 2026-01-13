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
            <div className="w-32 h-20 bg-white/10 rounded-2xl animate-pulse" />
        )
    }

    return (
        <motion.div
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/20 shadow-lg"
            whileHover={{ scale: 1.02 }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="flex flex-col gap-2">
                {/* Tickets */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🎫</span>
                        <span className="font-bold text-white text-lg">{tickets}</span>
                    </div>
                    <span className="text-xs text-white/60 uppercase tracking-wide">Bilet</span>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10" />

                {/* Hearts */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">❤️</span>
                        <span className="font-bold text-white text-lg">{hearts}/5</span>
                    </div>
                    {timeUntilRegen && hearts < 5 ? (
                        <span className="text-xs text-white/60 font-mono">{timeUntilRegen}</span>
                    ) : (
                        <span className="text-xs text-white/60 uppercase tracking-wide">Kalp</span>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
