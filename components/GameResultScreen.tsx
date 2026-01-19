'use client'

import { motion } from 'framer-motion'
import { Trophy, Home, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { useEffect } from 'react'

interface GameResultScreenProps {
    participants: any[]
    winner: any
    lastWinType?: string // 'survivor' or 'normal'
    roomCode: string
}

export default function GameResultScreen({ participants, winner, lastWinType, roomCode }: GameResultScreenProps) {
    const router = useRouter()

    // Confetti effect on mount
    useEffect(() => {
        const duration = 3000
        const end = Date.now() + duration

        const frame = () => {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#fbbf24', '#f59e0b', '#d97706']
            })
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#fbbf24', '#f59e0b', '#d97706']
            })

            if (Date.now() < end) requestAnimationFrame(frame)
        }
        frame()
    }, [])

    const sortedParticipants = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0))

    return (
        <div className="min-h-screen bg-dark-100 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl w-full glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden"
            >
                {/* Background Glow */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-yellow-500/10 to-transparent pointer-events-none" />

                <div className="relative z-10 text-center mb-10">
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-block p-4 bg-yellow-500/20 rounded-full mb-4 ring-2 ring-yellow-500/50 shadow-lg shadow-yellow-500/20"
                    >
                        <Trophy size={48} className="text-yellow-400" />
                    </motion.div>

                    <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 mb-2">
                        {lastWinType === 'survivor' ? 'SON KALAN KAZANDI!' : 'OYUN BİTTİ!'}
                    </h1>
                    <p className="text-white/60 text-lg">
                        {lastWinType === 'survivor'
                            ? 'Diğer tüm oyuncular elendi.'
                            : 'Tüm kelimeler tamamlandı.'}
                    </p>
                </div>

                {/* Leaderboard */}
                <div className="space-y-4 mb-10">
                    {sortedParticipants.map((p, index) => (
                        <motion.div
                            key={p.user_id}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4 + (index * 0.1) }}
                            className={`flex items-center justify-between p-4 rounded-xl border ${index === 0
                                ? 'bg-yellow-500/10 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                                : index === 1
                                    ? 'bg-gray-400/10 border-gray-400/30' // Silver for 2nd
                                    : 'bg-white/5 border-white/5'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${index === 0 ? 'bg-yellow-500 text-black'
                                    : index === 1 ? 'bg-gray-400 text-black'
                                        : index === 2 ? 'bg-orange-700 text-white'
                                            : 'bg-dark-300 text-white/50'
                                    }`}>
                                    {index + 1}
                                </div>
                                <div className="text-left">
                                    <div className="flex items-center gap-2">
                                        <div className={`font-bold text-lg ${index === 0 ? 'text-yellow-400' : 'text-white'}`}>
                                            {p.display_name}
                                        </div>
                                        {/* Reward Badge */}
                                        <div className="flex items-center gap-1 bg-primary-500/20 border border-primary-500/30 rounded px-1.5 py-0.5 ml-2">
                                            <span className="text-xs">🪙</span>
                                            <span className="text-xs font-bold text-primary-400">
                                                +{index === 0 ? 50 : index === 1 ? 25 : 10}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-white/50">
                                        {p.status === 'left' ? 'Ayrıldı' : p.status === 'finished' ? 'Tamamladı' : 'Oynuyor'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-2xl font-black text-white">
                                {p.score || 0}<span className="text-sm font-normal text-white/50 ml-1">P</span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 px-6 py-3 bg-dark-300 hover:bg-dark-200 text-white rounded-xl font-bold transition-colors border border-white/10"
                    >
                        <Home size={20} />
                        Ana Menü
                    </button>
                    <button
                        onClick={() => router.push(`/rooms/${roomCode}`)} // Just reload/rejoin
                        className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-primary-600/20"
                    >
                        <RotateCcw size={20} />
                        Tekrar Oyna
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
