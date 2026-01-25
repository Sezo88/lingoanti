'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getActiveGames, getCompletedGames, acceptGameInvite, rejectGameInvite, forfeitGame } from '@/lib/games'
import { supabase } from '@/lib/supabase'
import type { Game } from '@/lib/supabase'

export default function ActiveGamesPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [games, setGames] = useState<Game[]>([])
    const [completedGames, setCompletedGames] = useState<Game[]>([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        loadGames()

        // Realtime subscription for game updates
        if (!user) return

        // Need two separate subscriptions because Supabase doesn't support OR in filters
        const channel1 = supabase
            .channel(`user_games_p1_${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: `player1_id=eq.${user.id}`
            }, (payload) => {
                console.log('Game update (as player1):', payload)

                // Show toast if invite was accepted
                if (payload.eventType === 'UPDATE' && payload.new.status === 'active' && payload.old.status === 'waiting') {
                    setToast('🎮 Oyun daveti kabul edildi!')
                    setTimeout(() => setToast(null), 3000)
                }

                // Reload games
                loadGames()
            })
            .subscribe()

        const channel2 = supabase
            .channel(`user_games_p2_${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: `player2_id=eq.${user.id}`
            }, (payload) => {
                console.log('Game update (as player2):', payload)

                // Show toast if invite was accepted
                if (payload.eventType === 'UPDATE' && payload.new.status === 'active' && payload.old.status === 'waiting') {
                    setToast('🎮 Oyun daveti kabul edildi!')
                    setTimeout(() => setToast(null), 3000)
                }

                // Reload games
                loadGames()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel1)
            supabase.removeChannel(channel2)
        }
    }, [user])

    const loadGames = async () => {
        if (!user) return
        const { games: activeGames } = await getActiveGames(user.id)
        const { games: finishedGames } = await getCompletedGames(user.id)
        setGames(activeGames)
        setCompletedGames(finishedGames)
        setLoading(false)
    }

    const handleAcceptInvite = async (gameId: string) => {
        const { success } = await acceptGameInvite(gameId)
        if (success) {
            router.push(`/game/play?id=${gameId}`)
        }
    }

    const handleRejectInvite = async (gameId: string) => {
        if (!confirm('Oyun davetini reddetmek istediğinize emin misiniz?')) return
        const { success } = await rejectGameInvite(gameId)
        if (success) {
            loadGames()
        }
    }

    const handleSurrender = async (gameId: string) => {
        if (!user) return
        if (!confirm('Oyundan pes etmek istediğinizden emin misiniz? Rakibiniz kazanacak.')) return

        setLoading(true)
        await forfeitGame(gameId, user.id)
        loadGames()
    }

    const handleCancelInvite = async (gameId: string) => {
        if (!user) return
        if (!confirm('Gönderilen daveti iptal etmek istediğinize emin misiniz?')) return

        const { cancelGameInvite } = await import('@/lib/games')
        const { success } = await cancelGameInvite(gameId, user.id)
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
            const allGames = [...games, ...completedGames]

            // Collect unique opponent IDs
            const opponentIds = new Set<string>()
            allGames.forEach(game => opponentIds.add(getOpponentId(game)))

            if (opponentIds.size === 0) return

            const { data } = await supabase
                .from('users')
                .select('id, display_name')
                .in('id', Array.from(opponentIds))

            if (data) {
                data.forEach(u => {
                    names[u.id] = u.display_name
                })
            }
            setOpponentNames(names)
        }

        if (games.length > 0 || completedGames.length > 0) {
            fetchOpponentNames()
        }
    }, [games, completedGames])

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
        <div className="min-h-screen">
            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top">
                    <div className="bg-success-600 text-white px-6 py-3 rounded-xl shadow-lg font-semibold border border-success-500">
                        {toast}
                    </div>
                </div>
            )}

            <header className="glass-effect border-b border-dark-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/')}
                        className="text-white/70 hover:text-white transition-colors"
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
                                            <p className="text-sm text-white/70">
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
                                            <button
                                                onClick={() => handleCancelInvite(game.id)}
                                                className="w-full py-2 rounded-lg bg-danger-500/20 text-danger-400 font-semibold hover:bg-danger-500/30 transition-colors border border-danger-500/30"
                                            >
                                                İptal Et
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Active Games */}
                {activeOngoingGames.length > 0 && (
                    <div className="mb-8">
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
                                        className="glass-effect rounded-xl p-4 hover:bg-white/10 transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="text-white font-semibold">
                                                    vs {opponentNames[opponentId] || 'Yükleniyor...'}
                                                </p>
                                                <p className="text-xs text-white/70">
                                                    {game.mixed_mode ? '🎲 Karışık' : `${game.word_length} harf`} • Best of {game.best_of} • El {game.current_round}
                                                </p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${isMyTurn ? 'bg-success-600' : 'bg-dark-300'
                                                }`}>
                                                {isMyTurn ? 'Senin Sıran' : 'Rakip Oynuyor'}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => router.push(`/game/play?id=${game.id}`)}
                                                className="flex-1 py-2 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
                                            >
                                                Devam Et →
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleSurrender(game.id)
                                                }}
                                                className="px-4 py-2 rounded-lg bg-danger-600 text-white font-semibold hover:bg-danger-700 transition-colors"
                                            >
                                                Pes Et
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Completed Games */}
                {completedGames.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold mb-3 text-white/80">
                            🏁 Biten Oyunlar
                        </h2>
                        <div className="space-y-2">
                            {completedGames.map((game) => {
                                const opponentId = getOpponentId(game)
                                const isWinner = game.winner_id === user?.id
                                const isForfeit = !!game.forfeited_by

                                return (
                                    <div key={game.id} className="glass-effect rounded-xl p-4 opacity-75 hover:opacity-100 transition-all">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-white font-semibold">
                                                    vs {opponentNames[opponentId] || 'Yükleniyor...'}
                                                </p>
                                                <p className="text-xs text-white/70">
                                                    {new Date(game.finished_at || '').toLocaleDateString('tr-TR')}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-bold ${isWinner ? 'text-success-500' : 'text-danger-500'}`}>
                                                    {isWinner ? 'KAZANDIN' : 'KAYBETTİN'}
                                                </div>
                                                {isForfeit && (
                                                    <div className="text-xs text-white/70">
                                                        (Pes Edildi)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {games.length === 0 && completedGames.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-white/70 mb-4">Henüz bir oyun bulunmuyor.</p>
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
