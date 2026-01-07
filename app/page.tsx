'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

import { useMatchmaking } from '@/hooks/useMatchmaking'

export default function HomePage() {
    const { user, loading, signOut } = useAuth()
    const router = useRouter()
    const { isSearching, findMatch, cancelSearch } = useMatchmaking()
    const [stats, setStats] = useState({ score: 0, wins: 0, losses: 0, total_games: 0 })

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login')
        }

        if (user) {
            console.log('Fetching stats for user:', user.id)
            fetchStats()
        }
    }, [user, loading, router])

    const fetchStats = async () => {
        if (!user) return
        const { data, error } = await supabase
            .from('users')
            .select('score, wins, losses, total_games')
            .eq('id', user.id)
            .single()

        if (error) {
            console.error('Error fetching stats:', error)
        }

        if (data) {
            console.log('Stats received:', data)
            setStats(data)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
                {/* Background Animation - Kaldırıldı, global arka plan var */}

                <div className="z-10 text-center space-y-8 max-w-md w-full animate-in zoom-in duration-500">
                    {/* Logo & Title */}
                    <div className="space-y-4">
                        <div className="w-24 h-24 bg-gradient-to-tr from-primary-500 to-accent-500 rounded-3xl mx-auto shadow-2xl flex items-center justify-center transform rotate-12 hover:rotate-0 transition-transform duration-300">
                            <span className="text-5xl">L</span>
                        </div>
                        <h1 className="text-5xl font-extrabold tracking-tight gradient-text">Lingo Türkiye</h1>
                        <p className="text-dark-400 text-lg">Yükleniyor...</p>
                    </div>

                    {/* Loading Spinner */}
                    <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-500"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (!user) return null

    return (
        <main className="min-h-screen relative">
            {/* Matchmaking Overlay */}
            {isSearching && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="glass-effect p-8 rounded-3xl max-w-sm w-full text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-500 mx-auto mb-6"></div>
                        <h2 className="text-2xl font-bold text-white mb-2">Rakip Aranıyor...</h2>
                        <p className="text-dark-400 mb-8">Uygun bir rakip bekleniyor</p>
                        <button
                            onClick={cancelSearch}
                            className="w-full py-3 rounded-xl font-semibold bg-dark-200 text-white hover:bg-dark-300 transition-colors"
                        >
                            İptal Et
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="glass-effect border-b border-dark-200 sticky top-0 z-40">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold gradient-text">Lingo Türkiye</h1>
                    <button
                        onClick={signOut}
                        className="px-4 py-2 rounded-xl bg-dark-200 hover:bg-dark-300 transition-colors text-sm"
                    >
                        Çıkış
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                {/* Welcome Section */}
                <div className="text-center mb-8">
                    <div className="mb-4 flex justify-center">
                        <img
                            src="/lingo_logo.png"
                            alt="Lingo Türkiye"
                            className="w-64 h-auto"
                        />
                    </div>
                    <p className="text-dark-400">Kelime tahmin oyunu</p>
                </div>

                {/* Active Games Notification */}
                <Link
                    href="/games"
                    className="max-w-md mx-auto mb-6 block glass-effect rounded-xl p-4 hover:bg-white/10 transition-all"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl">🎮</div>
                            <div>
                                <p className="font-semibold text-white">Oyunlarım</p>
                                <p className="text-sm text-dark-500">Devam eden ve davetler</p>
                            </div>
                        </div>
                        <div className="text-primary-500">→</div>
                    </div>
                </Link>

                {/* Game Modes */}
                <div className="space-y-4 max-w-md mx-auto">
                    <div className="glass-effect rounded-2xl p-6 hover:bg-white/10 transition-all active:scale-95">
                        <h3 className="text-xl font-semibold mb-2">🎯 Pratik Yap</h3>
                        <p className="text-dark-500 text-sm mb-4">
                            Tek başına pratik yap, oyunu öğren
                        </p>
                        <Link
                            href="/practice"
                            className="block w-full py-3 rounded-xl font-semibold text-white bg-primary-600 text-center hover:bg-primary-700 transition-all"
                        >
                            Başla
                        </Link>
                    </div>

                    <div className="glass-effect rounded-2xl p-6 hover:bg-white/10 transition-all active:scale-95 border border-primary-500/30 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-primary-500/5 group-hover:bg-primary-500/10 transition-colors"></div>
                        <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                            🎲 Hızlı Oyun
                            <span className="text-xs px-2 py-1 bg-primary-500/20 text-primary-300 rounded-full">Popüler</span>
                        </h3>
                        <p className="text-dark-500 text-sm mb-4">
                            Rastgele bir oyuncuyla hemen eşleş
                        </p>
                        <button
                            onClick={findMatch}
                            className="w-full py-3 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all shadow-lg shadow-primary-500/20 relative z-10"
                        >
                            Hemen Oyna
                        </button>
                    </div>

                    <div className="glass-effect rounded-2xl p-6 hover:bg-white/10 transition-all active:scale-95 border border-indigo-500/30 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors"></div>
                        <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                            🏁 Kelime Yarışı
                            <span className="text-xs px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-full">Yeni</span>
                        </h3>
                        <p className="text-dark-500 text-sm mb-4">
                            Oda kur, arkadaşlarınla aynı anda yarış
                        </p>
                        <Link
                            href="/rooms"
                            className="block w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 text-center hover:opacity-90 transition-all shadow-lg shadow-indigo-500/20 relative z-10"
                        >
                            Oda Kur / Katıl
                        </Link>
                    </div>

                    <div className="glass-effect rounded-2xl p-6 hover:bg-white/10 transition-all active:scale-95">
                        <h3 className="text-xl font-semibold mb-2">👥 Arkadaşlarınla Oyna</h3>
                        <p className="text-dark-500 text-sm mb-4">
                            Arkadaşlarla eşleş ve oyna
                        </p>
                        <Link
                            href="/friends"
                            className="block w-full py-3 rounded-xl font-semibold text-white bg-dark-200 text-center hover:bg-dark-300 transition-all"
                        >
                            Arkadaşlar
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-10 max-w-md mx-auto grid grid-cols-3 gap-4">
                    <div className="glass-effect rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-primary-500">{stats.wins}</div>
                        <div className="text-xs text-dark-500 mt-1">Kazandım</div>
                    </div>
                    <div className="glass-effect rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-danger-500">{stats.losses}</div>
                        <div className="text-xs text-dark-500 mt-1">Kaybettim</div>
                    </div>
                    <div className="glass-effect rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-warning-500">{stats.total_games}</div>
                        <div className="text-xs text-dark-500 mt-1">Toplam</div>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <Link href="/leaderboard" className="text-primary-400 hover:text-white text-sm font-semibold transition-colors">
                        🏆 Liderlik Tablosunu Gör
                    </Link>
                </div>
            </div>
        </main>
    )
}
