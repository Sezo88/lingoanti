'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

export default function HomePage() {
    const { user, loading, signOut } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login')
        }
    }, [user, loading, router])

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-dark-500">Yükleniyor...</p>
                </div>
            </div>
        )
    }

    if (!user) return null

    return (
        <main className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50">
            {/* Header */}
            <header className="glass-effect border-b border-dark-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold gradient-text">Lingo Anti</h1>
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
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-white mb-2">
                        Hoş geldin! 👋
                    </h2>
                    <p className="text-dark-500">Hadi bir oyun başlatalım!</p>
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

                    <div className="glass-effect rounded-2xl p-6 opacity-60">
                        <h3 className="text-xl font-semibold mb-2">🎲 Hızlı Oyun</h3>
                        <p className="text-dark-500 text-sm mb-4">
                            Rastgele oyuncuyla eşleş (yakında)
                        </p>
                        <button className="w-full py-3 rounded-xl font-semibold bg-dark-300 text-dark-500 cursor-not-allowed">
                            Yakında
                        </button>
                    </div>

                    <div className="glass-effect rounded-2xl p-6 hover:bg-white/10 transition-all active:scale-95">
                        <h3 className="text-xl font-semibold mb-2">👥 Arkadaşlarınla Oyna</h3>
                        <p className="text-dark-500 text-sm mb-4">
                            Arkadaşlarla eşleş ve oyna
                        </p>
                        <Link
                            href="/friends"
                            className="block w-full py-3 rounded-xl font-semibold text-white gradient-bg text-center hover:opacity-90 transition-all"
                        >
                            Arkadaşlar
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-10 max-w-md mx-auto grid grid-cols-3 gap-4">
                    <div className="glass-effect rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-primary-500">0</div>
                        <div className="text-xs text-dark-500 mt-1">Kazandım</div>
                    </div>
                    <div className="glass-effect rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-danger-500">0</div>
                        <div className="text-xs text-dark-500 mt-1">Kaybettim</div>
                    </div>
                    <div className="glass-effect rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-warning-500">0</div>
                        <div className="text-xs text-dark-500 mt-1">Toplam</div>
                    </div>
                </div>
            </div>
        </main>
    )
}
