'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TournamentModeCard from '@/components/TournamentModeCard'
import CurrencyDisplay from '@/components/CurrencyDisplay'

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
            setStats(data)
        }
    }

    if (loading) return null // Loading state handled by layout/suspense mostly, or can add a spinner here if needed
    if (!user) return null

    return (
        <main className="min-h-screen relative font-display pb-28">
            {/* Matchmaking Overlay */}
            {isSearching && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="glass-card p-8 rounded-[24px] max-w-sm w-full text-center m-4">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mx-auto mb-6"></div>
                        <h2 className="text-2xl font-bold text-white mb-2">Rakip Aranıyor...</h2>
                        <p className="text-white/80 mb-8">Uygun bir rakip bekleniyor</p>
                        <button
                            onClick={cancelSearch}
                            className="w-full py-3 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            İptal Et
                        </button>
                    </div>
                </div>
            )}

            <div className="relative flex flex-col w-full max-w-md mx-auto min-h-screen">
                {/* Header */}
                <header className="flex items-center justify-between px-6 pt-8 pb-6">
                    <div className="flex items-center">
                        <div className="h-12 ml-14 relative flex items-center justify-center">
                            <img
                                src="/lingo_logo.png"
                                alt="Lingo Master"
                                className="h-full w-auto object-contain drop-shadow-md scale-[4.0]"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <CurrencyDisplay />
                        <Link
                            href="/settings"
                            className="w-10 h-10 rounded-full bg-dark-200/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-dark-300 transition-all"
                        >
                            <span className="material-symbols-outlined text-xl">settings</span>
                        </Link>
                    </div>
                </header>

                <div className="flex-1 px-4 space-y-4">
                    {/* Hızlı Oyun Card */}
                    <div className="glass-card rounded-[28px] p-5 shadow-2xl relative overflow-hidden border-white/40 border-2 transition-transform active:scale-[0.98]">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white shadow-inner">
                                        <span className="material-symbols-outlined text-3xl">casino</span>
                                    </div>
                                    <div>
                                        <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-yellow-400/90 text-yellow-900 text-[10px] font-black tracking-wide uppercase mb-1 shadow-sm">
                                            Popüler
                                        </div>
                                        <h3 className="text-xl font-extrabold leading-none text-white">Hızlı Oyun</h3>
                                        <p className="text-white/80 text-sm mt-1">Rastgele rakip bul</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={findMatch}
                                className="w-full bg-[#f86516] hover:bg-[#e05810] text-white py-3.5 rounded-full text-base font-bold shadow-[0_4px_14px_rgba(248,101,22,0.5)] flex items-center justify-center gap-2 transition-all"
                            >
                                <span className="material-symbols-outlined text-xl">play_arrow</span>
                                Hemen Oyna
                            </button>
                        </div>
                    </div>


                    {/* Pratik & Oyunlarım Section */}
                    <div className="glass-card rounded-[28px] p-5 shadow-xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4 text-white/80">
                            <span className="material-symbols-outlined text-xl">school</span>
                            <h3 className="text-sm font-bold uppercase tracking-wider">Gelişim & Kayıtlar</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Pratik Yap */}
                            <Link href="/practice" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all flex flex-col items-center text-center gap-2 group active:scale-[0.98]">
                                <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl">track_changes</span>
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-sm">Pratik Yap</h3>
                                    <p className="text-white/50 text-[10px]">Kendini geliştir</p>
                                </div>
                            </Link>

                            {/* Oyunlarım */}
                            <Link href="/games" className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all flex flex-col items-center text-center gap-2 group active:scale-[0.98]">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl">history</span>
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-sm">Oyunlarım</h3>
                                    <p className="text-white/50 text-[10px]">Geçmiş oyunlar</p>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Turnuva Modu Card */}
                    <TournamentModeCard />

                    {/* Çok Oyunculu Bölümü Card */}
                    <div className="glass-card rounded-[28px] p-5 shadow-xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4 text-white/80">
                            <span className="material-symbols-outlined text-xl">hub</span>
                            <h3 className="text-sm font-bold uppercase tracking-wider">Özel Odalar</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Oda Kur */}
                            <Link href="/rooms?action=create" className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 border border-purple-500/20 rounded-2xl p-4 transition-all flex flex-col items-center text-center gap-2 group active:scale-[0.98]">
                                <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center mb-1 shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl">add</span>
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-sm">Oda Kur</h3>
                                    <p className="text-white/50 text-[10px]">Arkadaşlarını çağır</p>
                                </div>
                            </Link>

                            {/* Odaya Katıl */}
                            <Link href="/rooms" className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 border border-cyan-500/20 rounded-2xl p-4 transition-all flex flex-col items-center text-center gap-2 group active:scale-[0.98]">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500 text-white flex items-center justify-center mb-1 shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl">login</span>
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-sm">Katıl</h3>
                                    <p className="text-white/50 text-[10px]">Kod ile giriş yap</p>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Arkadaşlarınla Oyna (Full Width) */}
                    <Link href="/friends" className="block glass-card rounded-[24px] p-5 shadow-xl transition-transform active:scale-[0.98] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex items-center justify-between gap-4 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg">
                                    <span className="material-symbols-outlined text-2xl">group</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Arkadaşlar</h3>
                                    <p className="text-sm text-white/60">Listeni yönet</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 border border-white/10">
                                <span className="material-symbols-outlined text-white text-lg">arrow_forward</span>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Footer Stats */}
                <footer className="mt-6 px-4">
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="glass-card rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-lg">
                            <span className="text-[10px] text-white/70 font-semibold uppercase tracking-wide">Kazandım</span>
                            <span className="text-xl font-black text-green-400 drop-shadow-sm">{stats.wins}</span>
                        </div>
                        <div className="glass-card rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-lg">
                            <span className="text-[10px] text-white/70 font-semibold uppercase tracking-wide">Kaybettim</span>
                            <span className="text-xl font-black text-red-200 drop-shadow-sm">{stats.losses}</span>
                        </div>
                        <div className="glass-card rounded-2xl p-2.5 flex flex-col items-center justify-center text-center shadow-lg">
                            <span className="text-[10px] text-white/70 font-semibold uppercase tracking-wide">Toplam</span>
                            <span className="text-xl font-black text-yellow-300 drop-shadow-sm">{stats.total_games}</span>
                        </div>
                    </div>
                </footer>
            </div>
        </main>
    )
}
