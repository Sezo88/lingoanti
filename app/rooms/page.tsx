'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMultiplayer } from '@/hooks/useMultiplayer'
import Link from 'next/link'

export default function RoomsPage() {
    const { user } = useAuth()
    const { createRoom, joinRoom, loading, error } = useMultiplayer()
    const [roomCode, setRoomCode] = useState('')

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-dark-400 mb-4">Devam etmek için giriş yapmalısınız</p>
                    <Link href="/auth/login" className="text-primary-500 hover:text-primary-400 font-semibold">
                        Giriş Yap
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 p-4">
            <div className="max-w-md mx-auto pt-10">
                <Link href="/" className="inline-flex items-center text-dark-400 hover:text-white mb-8 transition-colors">
                    ← Ana Sayfa
                </Link>

                <h1 className="text-3xl font-bold mb-2 gradient-text">Çok Oyunculu Mod</h1>
                <p className="text-dark-400 mb-8">Arkadaşlarınla yarış veya turnuvaya katıl</p>

                {error && (
                    <div className="bg-danger-500/10 border border-danger-500/20 text-danger-500 p-4 rounded-xl mb-6">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Oda Oluştur */}
                    <div className="glass-effect p-6 rounded-2xl">
                        <h2 className="text-xl font-semibold mb-4 text-white">Yeni Oda Kur</h2>
                        <p className="text-sm text-dark-400 mb-6">
                            Kendi odanı oluştur ve arkadaşlarını davet et.
                        </p>
                        <button
                            onClick={() => createRoom(false)}
                            disabled={loading}
                            className="w-full py-3 rounded-xl font-semibold bg-primary-600 hover:bg-primary-500 text-white transition-all disabled:opacity-50"
                        >
                            {loading ? 'Oluşturuluyor...' : 'Oda Oluştur'}
                        </button>
                    </div>

                    <div className="relative flex items-center justify-center">
                        <div className="h-px bg-white/10 w-full absolute"></div>
                        <span className="bg-dark-100 px-4 text-dark-500 relative text-sm">VEYA</span>
                    </div>

                    {/* Odaya Katıl */}
                    <div className="glass-effect p-6 rounded-2xl">
                        <h2 className="text-xl font-semibold mb-4 text-white">Odaya Katıl</h2>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Oda Kodu (Örn: A1B2)"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500/50 uppercase tracking-widest text-center font-bold"
                            />
                            <button
                                onClick={() => joinRoom(roomCode)}
                                disabled={loading || !roomCode}
                                className="px-6 py-3 rounded-xl font-semibold bg-dark-200 hover:bg-dark-300 text-white transition-all disabled:opacity-50"
                            >
                                Katıl
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
