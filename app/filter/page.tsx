'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { Check, X, RotateCcw, Lock, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Word {
    id: string
    word: string
    length: number
}

export default function WordFilterPage() {
    const [words, setWords] = useState<Word[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const [isFinished, setIsFinished] = useState(false)
    const [stats, setStats] = useState({ approved: 0, rejected: 0, pending: 0 })

    // Auth
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    // Motion values for swipe
    const x = useMotionValue(0)
    const rotate = useTransform(x, [-200, 200], [-25, 25])
    const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0])
    const checkOpacity = useTransform(x, [50, 150], [0, 1])
    const xOpacity = useTransform(x, [-150, -50], [1, 0])

    const fetchStats = async () => {
        // İstatistikleri ayrı ayrı sayalım (count: 'exact' performansı etkileyebilir ama doğru veri verir)
        const { count: approvedCount } = await supabase
            .from('game_words')
            .select('*', { count: 'exact', head: true })
            .eq('filter_status', 'approved')

        const { count: rejectedCount } = await supabase
            .from('game_words')
            .select('*', { count: 'exact', head: true })
            .eq('filter_status', 'rejected')

        const { count: pendingCount } = await supabase
            .from('game_words')
            .select('*', { count: 'exact', head: true })
            .eq('filter_status', 'pending')

        setStats({
            approved: approvedCount || 0,
            rejected: rejectedCount || 0,
            pending: pendingCount || 0
        })
    }

    const fetchWords = async () => {
        setLoading(true)
        await fetchStats()

        // Bekleyen kelimeleri çek
        const { data, error: fetchError } = await supabase
            .from('game_words')
            .select('id, word, length')
            .eq('filter_status', 'pending')
            .limit(50) // Her defasında 50 tane getir

        if (fetchError) {
            console.error('Fetch error:', fetchError)
            setError('Veriler yüklenirken hata oluştu.')
        } else {
            setWords(data || [])
            setCurrentIndex(0)
            if (!data || data.length === 0) {
                setIsFinished(true)
            } else {
                setIsFinished(false)
            }
        }
        setLoading(false)
    }

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault()
        // Basit şifre: lingo123
        if (password === 'lingo123') {
            setIsAuthenticated(true)
            fetchWords()
        } else {
            setError('Hatalı şifre!')
        }
    }

    const handleVote = async (approved: boolean) => {
        if (currentIndex >= words.length) return

        const currentWord = words[currentIndex]
        const status = approved ? 'approved' : 'rejected'

        // Supabase'i güncelle
        const { error: updateError } = await supabase
            .from('game_words')
            .update({ filter_status: status })
            .eq('id', currentWord.id)

        if (updateError) {
            console.error('Update error:', updateError)
            return
        }

        // Local stats güncelle
        setStats(prev => ({
            ...prev,
            [status]: prev[status as keyof typeof prev] + 1,
            pending: Math.max(0, prev.pending - 1)
        }))

        if (currentIndex + 1 < words.length) {
            setCurrentIndex(prev => prev + 1)
        } else {
            // Liste bittiyse yeni 50 taneyi çek
            fetchWords()
        }
    }

    const handleDragEnd = (event: any, info: any) => {
        if (info.offset.x > 100) {
            handleVote(true)
        } else if (info.offset.x < -100) {
            handleVote(false)
        }
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md bg-slate-800/50 p-8 rounded-3xl border border-white/10 backdrop-blur-md"
                >
                    <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Lock className="text-indigo-500 w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-2">Erişim Gerekli</h1>
                    <p className="text-slate-400 text-center mb-8">Devam etmek için filtreleme şifresini girin.</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Şifre"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                            />
                            {error && <p className="text-red-500 text-sm mt-2 ml-1">{error}</p>}
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95"
                        >
                            Giriş Yap <ChevronRight className="w-5 h-5" />
                        </button>
                    </form>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center p-4 relative overflow-hidden font-sans">
            {/* Header */}
            <header className="w-full max-w-md flex justify-between items-center mb-8 px-2">
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        Kelime Eleme (Canlı)
                    </h1>
                    <p className="text-sm text-slate-400">
                        {stats.pending} Bekleyen Kelime
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchWords}
                        disabled={loading}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors disabled:opacity-50"
                        title="Yenile"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center w-full max-w-md relative">
                <AnimatePresence mode="popLayout">
                    {loading && words.length === 0 ? (
                        <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                        </motion.div>
                    ) : !isFinished && words.length > 0 ? (
                        <div className="relative w-full aspect-[3/4] max-w-[320px]">
                            {/* Card Stack Backgrounds */}
                            {currentIndex + 1 < words.length && (
                                <div className="absolute inset-0 bg-slate-800 rounded-3xl translate-y-2 scale-95 opacity-50 border border-slate-700" />
                            )}

                            {/* Current Card */}
                            <motion.div
                                key={words[currentIndex].word}
                                style={{ x, rotate, opacity }}
                                drag="x"
                                dragConstraints={{ left: 0, right: 0 }}
                                onDragEnd={handleDragEnd}
                                className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl border border-white/10 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing p-8 z-10"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ x: x.get() > 0 ? 300 : -300, opacity: 0, scale: 0.5 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            >
                                <motion.div style={{ opacity: checkOpacity }} className="absolute top-8 right-8 text-green-500">
                                    <Check className="w-12 h-12 stroke-[3px]" />
                                </motion.div>
                                <motion.div style={{ opacity: xOpacity }} className="absolute top-8 left-8 text-red-500">
                                    <X className="w-12 h-12 stroke-[3px]" />
                                </motion.div>

                                <div className="text-center">
                                    <span className="text-sm uppercase tracking-[0.2em] text-indigo-400 font-semibold mb-2 block">
                                        {words[currentIndex].length} Harfli
                                    </span>
                                    <h2 className="text-5xl font-black tracking-wider uppercase mb-4">
                                        {words[currentIndex].word}
                                    </h2>
                                </div>
                            </motion.div>
                        </div>
                    ) : (
                        <motion.div
                            key="finished"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center p-8 bg-slate-800/50 rounded-3xl border border-white/10 backdrop-blur-sm"
                        >
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Check className="text-green-500 w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-bold mb-4">Tebrikler!</h2>
                            <p className="text-slate-400 mb-8">
                                Şimdilik bekleyen tüm kelimeleri eledin.
                            </p>
                            <button
                                onClick={fetchWords}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-bold transition-all transform active:scale-95 shadow-lg"
                            >
                                Yeni Kelimeleri Kontrol Et
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Control Buttons */}
                {!isFinished && words.length > 0 && !loading && (
                    <div className="flex gap-8 mt-12 z-20">
                        <button
                            onClick={() => handleVote(false)}
                            className="w-16 h-16 bg-slate-800 hover:bg-red-500/20 text-red-500 border border-slate-700 rounded-full flex items-center justify-center transition-all transform active:scale-90 shadow-lg group"
                        >
                            <X className="w-8 h-8 group-hover:scale-110 transition-transform" />
                        </button>
                        <button
                            onClick={() => handleVote(true)}
                            className="w-16 h-16 bg-slate-800 hover:bg-green-500/20 text-green-500 border border-slate-700 rounded-full flex items-center justify-center transition-all transform active:scale-90 shadow-lg group"
                        >
                            <Check className="w-8 h-8 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                )}
            </main>

            {/* Stats Footer */}
            <footer className="w-full max-w-md mt-8 pb-4 grid grid-cols-2 gap-4 px-2">
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                    <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Onaylandı</div>
                    <div className="text-xl font-bold text-green-500">{stats.approved}</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                    <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Elenen</div>
                    <div className="text-xl font-bold text-red-500">{stats.rejected}</div>
                </div>
            </footer>

            {/* Background Decorations */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
        </div>
    )
}
