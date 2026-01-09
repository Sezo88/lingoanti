'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMultiplayer } from '@/hooks/useMultiplayer'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function RoomsPage() {
    const { user } = useAuth()
    const { createRoom, joinRoom, loading, error } = useMultiplayer()
    const [roomCode, setRoomCode] = useState('')
    const [duration, setDuration] = useState(60)
    const [gameMode, setGameMode] = useState<'arena' | 'turn_based'>('arena')
    const [wordLength, setWordLength] = useState(5)

    useEffect(() => {
        // Sayfaya girildiğinde eski odaları temizle (Maintenance)
        supabase.rpc('cleanup_stale_rooms')
    }, [])


    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-white/80 mb-4">Devam etmek için giriş yapmalısınız</p>
                    <Link href="/auth/login" className="text-primary-500 hover:text-primary-400 font-semibold">
                        Giriş Yap
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-4 pb-24">
            <div className="max-w-md mx-auto pt-10">
                <Link href="/" className="inline-flex items-center px-3 py-2 rounded-lg bg-black/20 hover:bg-black/30 text-white/80 hover:text-white mb-8 transition-colors backdrop-blur-sm border border-white/10">
                    ← Ana Sayfa
                </Link>

                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold mb-2 text-white drop-shadow-lg">Çok Oyunculu Mod</h1>
                    <p className="text-white/80 text-shadow-strong">Arkadaşlarınla yarış veya turnuvaya katıl</p>
                </div>

                {error && (
                    <div className="bg-danger-500/10 border border-danger-500/20 text-danger-500 p-4 rounded-xl mb-6">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Oda Oluştur */}
                    <div className="glass-effect p-6 rounded-2xl">
                        <h2 className="text-xl font-semibold mb-4 text-white">Yeni Oda Kur</h2>
                        <p className="text-sm text-white/80 mb-6">
                            Kendi odanı oluştur ve arkadaşlarını davet et.
                        </p>

                        {/* Mod Seçimi */}
                        <div className="mb-6">
                            <label className="block text-sm text-white/80 mb-2">Oyun Modu</label>
                            <div className="grid grid-cols-2 gap-2 bg-black/20 rounded-xl p-1">
                                <button
                                    onClick={() => setGameMode('arena')}
                                    className={`py-3 rounded-lg text-sm font-semibold transition-all ${gameMode === 'arena' ? 'bg-primary-600 text-white shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                                >
                                    Kelime Yarışı
                                </button>
                                <button
                                    onClick={() => setGameMode('turn_based')}
                                    className={`py-3 rounded-lg text-sm font-semibold transition-all ${gameMode === 'turn_based' ? 'bg-primary-600 text-white shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                                >
                                    Sıra Sende
                                </button>
                            </div>
                        </div>

                        {/* Kelime Uzunluğu (Sadece Sıra Sende için) */}
                        {gameMode === 'turn_based' && (
                            <div className="mb-6">
                                <label className="block text-sm text-white/80 mb-2">Kelime Uzunluğu</label>
                                <div className="grid grid-cols-5 bg-black/20 rounded-xl p-1 gap-1">
                                    {[4, 5, 6, 7, 0].map(len => (
                                        <button
                                            key={len}
                                            onClick={() => setWordLength(len)}
                                            className={`py-2 rounded-lg text-sm font-semibold transition-all ${wordLength === len ? 'bg-primary-600 text-white shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                                        >
                                            {len === 0 ? '🎲' : len}
                                        </button>
                                    ))}
                                </div>
                                {wordLength === 0 && (
                                    <p className="text-xs text-white/60 mt-2 text-center">Karışık: Her el farklı uzunluk (4-7)</p>
                                )}
                            </div>
                        )}

                        {/* Süre Seçimi */}
                        <div className="mb-6">
                            <label className="block text-sm text-white/80 mb-2">Süre (Saniye)</label>
                            <div className="flex bg-black/20 rounded-xl p-1 gap-1">
                                {[20, 30, 40, 60].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDuration(d)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${duration === d ? 'bg-primary-600 text-white shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => createRoom(false, duration, gameMode, wordLength)}
                            disabled={loading}
                            className="w-full py-3 rounded-xl font-semibold bg-primary-600 hover:bg-primary-500 text-white transition-all disabled:opacity-50"
                        >
                            {loading ? 'Oluşturuluyor...' : 'Oda Oluştur'}
                        </button>
                    </div>

                    <div className="relative flex items-center justify-center">
                        <div className="h-px bg-white/10 w-full absolute"></div>
                        <span className="bg-dark-100 px-4 text-white/70 relative text-sm">VEYA</span>
                    </div>

                    {/* Odaya Katıl */}
                    <div className="glass-effect p-6 rounded-2xl">
                        <h2 className="text-xl font-semibold mb-4 text-white">Odaya Katıl</h2>
                        <p className="text-sm text-white/80 mb-6">
                            Arkadaşının oda kodunu gir ve katıl.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Oda Kodu"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                className="flex-1 px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:border-primary-500 transition-colors max-w-[140px]"
                                maxLength={6}
                            />
                            <button
                                onClick={() => joinRoom(roomCode)}
                                disabled={loading || !roomCode}
                                className="flex-1 py-3 rounded-xl font-semibold bg-success-600 hover:bg-success-500 text-white transition-all disabled:opacity-50"
                            >
                                {loading ? 'Katılıyor...' : 'Katıl'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
