'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getActiveGames, acceptGameInvite, rejectGameInvite } from '@/lib/games'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/supabase'

export default function ActiveGamesPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [games, setGames] = useState<Game[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadGames()
    }, [user])

    const loadGames = async () => {
        if (!user) return
        const { games: activeGames } = await getActiveGames(user.id)
        setGames(activeGames)
        setLoading(false)
    }

    const handleAcceptInvite = async (gameId: string) => {
        const { success } = await acceptGameInvite(gameId)
        if (success) {
            router.push(`/game/${gameId}`)
        }
    }

    const handleRejectInvite = async (gameId: string) => {
        if (!confirm('Oyun davetini reddetmek istediğinize emin misiniz?')) return
        const { success } = await rejectGameInvite(gameId)
        if (success) {
            loadGames()
        }
    }

    const getOpponentId = (game: Game) => {
        return game.player1_id === user?.id ? game.player2_id : game.player1_id
    }

    const [opponentNames, setOpponentNames] = useState<Record<string, string>>({})

    useEffect(() => {
        const fetchOpponentNames = async () => {
            const names: Record<string, string> = {}
            for (const game of games) {
                const opponentId = getOpponentId(game)
                const { data } = await supabase
                    .from('users')
                    .select('display_name')
                    .eq('id', opponentId)
                    .single()
                if (data) {
                    names[opponentId] = data.display_name
                }
            }
            setOpponentNames(names)
        }
        if (games.length > 0) {
            fetchOpponentNames()
        }
    }, [games])

    const waitingGames = games.filter(g => g.status === 'waiting')
    const activeOngoingGames = games.filter(g => g.status === 'active')

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50">
            <header className="glass-effect border-b border-dark-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/')}
                        className="text-dark-500 hover:text-white transition-colors"
                    >
                        ← Geri
                    </button>
                    <h1 className="text-xl font-bold gradient-text">Oyunlarım</h1>
                    <div className="w-16"></div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6 max-w-md">
                {/* Pending Invites */}
                {waitingGames.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-3 text-white">
                            📬 Oyun Davetleri ({waitingGames.length})
                        </h2>
                        <div className="space-y-2">
                            {waitingGames.map((game) => {
                                const isInviter = game.player1_id === user?.id
                                const opponentId = getOpponentId(game)

                                return (
                                    <div key={game.id} className="glass-effect rounded-xl p-4">
                                        <div className="mb-3">
                                            <p className="text-white font-semibold">
                                                {isInviter ? '📤 Gönderilen Davet' : '📥 Gelen Davet'}
                                            </p>
                                            <p className="text-sm text-dark-500">
                                                {opponentNames[opponentId] || 'Yükleniyor...'}
                                            </p>
                                            <p className="text-xs text-dark-600 mt-1">
                                                {game.mixed_mode ? '🎲 Karışık (Her el farklı)' : `${game.word_length} harfli`} • Best of {game.best_of}
                                            </p>
                                        </div>

                                        {!isInviter && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleAcceptInvite(game.id)}
                                                    className="flex-1 py-2 rounded-lg bg-success-600 text-white font-semibold hover:bg-success-700 transition-colors"
                                                >
                                                    Kabul Et
                                                </button>
                                                <button
                                                    onClick={() => handleRejectInvite(game.id)}
                                                    className="flex-1 py-2 rounded-lg bg-dark-300 text-white font-semibold hover:bg-dark-400 transition-colors"
                                                >
                                                    Reddet
                                                </button>
                                            </div>
                                        )}

                                        {isInviter && (
                                            <p className="text-center text-warning-500 text-sm">
                                                ⏳ Rakip kabul etmesini bekliyor...
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Active Games */}
                {activeOngoingGames.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold mb-3 text-white">
                            🎮 Devam Eden Oyunlar ({activeOngoingGames.length})
                        </h2>
                        <div className="space-y-2">
                            {activeOngoingGames.map((game) => {
                                const isMyTurn = game.current_turn === user?.id
                                const opponentId = getOpponentId(game)

                                return (
                                    <div
                                        key={game.id}
                                        onClick={() => router.push(`/game/${game.id}`)}
                                        className="glass-effect rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-all active:scale-95"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="text-white font-semibold">
                                                    vs {opponentNames[opponentId] || 'Yükleniyor...'}
                                                </p>
                                                <p className="text-xs text-dark-500">
                                                    {game.mixed_mode ? '🎲 Karışık' : `${game.word_length} harf`} • Best of {game.best_of} • El {game.current_round}
                                                </p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${isMyTurn ? 'bg-success-600' : 'bg-dark-300'
                                                }`}>
                                                {isMyTurn ? 'Senin Sıran' : 'Rakip Oynuyor'}
                                            </div>
                                        </div>
                                        <button className="w-full py-2 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors">
                                            Devam Et →
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {games.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-dark-500 mb-4">Aktif oyun yok</p>
                        <button
                            onClick={() => router.push('/friends')}
                            className="px-6 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
                        >
                            Arkadaşlarla Oyna
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
