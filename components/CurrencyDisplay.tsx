'use client'

import { useEffect, useState } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { motion, AnimatePresence } from 'framer-motion'

export default function CurrencyDisplay() {
    const useCurrencyInstance = useCurrency()
    const { tickets, hearts, loading, getTimeUntilNextHeart } = useCurrencyInstance
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
            <div className="w-20 h-12 bg-white/10 rounded-lg animate-pulse" />
        )
    }

    return (
        <motion.div
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-lg p-1.5 border border-white/20 shadow-lg"
            whileHover={{ scale: 1.02 }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="flex flex-col gap-1">
                {/* LPara (Eski Tickets) */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <span className="text-base">🪙</span>
                        <span className="font-bold text-white text-sm">{tickets}</span>
                    </div>
                    <span className="text-[8px] text-white/60 uppercase tracking-wide">LPara</span>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10" />

                {/* Lbilet (Eski Hearts) */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <span className="text-base">🎫</span>
                        <span className="font-bold text-white text-sm">{hearts}/5</span>
                        {hearts < 5 && (
                            <button
                                onClick={async () => {
                                    if (confirm('📺 Reklam izleyip +1 Lbilet kazanmak ister misin?')) {
                                        // Simulate ad watch
                                        const btn = document.activeElement as HTMLButtonElement
                                        if (btn) btn.disabled = true;
                                        await new Promise(r => setTimeout(r, 1000)); // 1s simulation

                                        const { rewardAd } = useCurrencyInstance;
                                        const success = await rewardAd('hearts');

                                        if (success) {
                                            alert('🎉 Tebrikler! +1 Lbilet kazandın.');
                                        } else {
                                            alert('❌ Bir hata oluştu.');
                                        }
                                        if (btn) btn.disabled = false;
                                    }
                                }}
                                className="w-4 h-4 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center text-white text-[10px] font-bold leading-none shadow-sm transition-colors ml-0.5"
                                title="Reklam izle +1 Lbilet kazan"
                            >
                                +
                            </button>
                        )}
                    </div>
                    {timeUntilRegen && hearts < 5 ? (
                        <span className="text-[8px] text-white/60 font-mono">{timeUntilRegen}</span>
                    ) : (
                        <span className="text-[8px] text-white/60 uppercase tracking-wide">Lbilet</span>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
