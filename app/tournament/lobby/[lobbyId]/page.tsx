'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTournamentMatchmaking } from '@/hooks/useTournamentMatchmaking'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import TournamentMatchmaking from '@/components/TournamentMatchmaking'

export default function TournamentLobbyPage() {
    const params = useParams()
    const router = useRouter()
    const { user } = useAuth()
    const { currentLobby, fetchLobbyDetails, startLobbySearch, leaveLobby, matchmakingStatus } = useTournamentMatchmaking()
    const [lobbyCode, setLobbyCode] = useState('')

    const lobbyId = params.lobbyId as string

    useEffect(() => {
        if (lobbyId) {
            fetchLobbyDetails(lobbyId)
        }
    }, [lobbyId])

    // Realtime subscription for lobby updates
    useEffect(() => {
        if (!lobbyId) return

        const channel = supabase
            .channel(`lobby:${lobbyId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tournament_lobby_members',
                filter: `lobby_id=eq.${lobbyId}`
            }, () => {
                // Refresh lobby details when members change
                fetchLobbyDetails(lobbyId)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [lobbyId])

    useEffect(() => {
        if (currentLobby) {
            setLobbyCode(currentLobby.lobbyCode)
        }
    }, [currentLobby])

    const handleStartSearch = async () => {
        await startLobbySearch()
    }

    const handleLeaveLobby = async () => {
        await leaveLobby()
        router.push('/')
    }

    const copyLobbyCode = () => {
        navigator.clipboard.writeText(lobbyCode)
        alert('Lobby kodu kopyalandı!')
    }

    const isLeader = currentLobby?.leaderId === user?.id

    if (!currentLobby) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-white">Lobby yükleniyor...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-4 pb-24">
            <div className="max-w-md mx-auto pt-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Link href="/" className="inline-flex items-center px-3 py-2 rounded-lg bg-black/20 hover:bg-black/30 text-white/80 hover:text-white transition-colors backdrop-blur-sm border border-white/10">
                        ← Ana Sayfa
                    </Link>
                    <button
                        onClick={handleLeaveLobby}
                        className="px-3 py-2 rounded-lg bg-danger-500/20 hover:bg-danger-500/30 text-danger-400 hover:text-danger-300 transition-colors backdrop-blur-sm border border-danger-500/20"
                    >
                        Ayrıl
                    </button>
                </div>

                {/* Lobby Info */}
                <div className="glass-effect p-6 rounded-2xl mb-6">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold mb-2 border border-purple-500/30">
                            {currentLobby.gameMode === 'arena' ? 'Kelime Yarışı' : 'Sıra Sende'}
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-4">Turnuva Lobby</h1>

                        {/* Lobby Code */}
                        <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                            <p className="text-white/60 text-xs mb-2">Lobby Kodu</p>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-3xl font-mono font-black text-white tracking-widest">
                                    {lobbyCode}
                                </span>
                                <button
                                    onClick={copyLobbyCode}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">content_copy</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Members List */}
                    <div className="mb-6">
                        <h3 className="text-sm text-white/70 font-semibold mb-3">
                            Üyeler ({currentLobby.members.length})
                        </h3>
                        <div className="space-y-2">
                            {currentLobby.members.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between bg-black/20 rounded-lg p-3 border border-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                                            {member.username.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-white font-medium">{member.username}</span>
                                    </div>
                                    {member.userId === currentLobby.leaderId && (
                                        <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold border border-yellow-500/30">
                                            Lider
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Start Button (Leader Only) */}
                    {isLeader && (
                        <button
                            onClick={handleStartSearch}
                            disabled={matchmakingStatus.status !== 'idle'}
                            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {matchmakingStatus.status === 'idle' ? 'Aramaya Başla' : 'Aranıyor...'}
                        </button>
                    )}

                    {!isLeader && (
                        <div className="text-center text-white/60 text-sm">
                            Lider aramayı başlatacak...
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex gap-3">
                        <span className="material-symbols-outlined text-blue-400">info</span>
                        <div className="flex-1">
                            <p className="text-blue-400 text-sm font-semibold mb-1">Nasıl Çalışır?</p>
                            <p className="text-white/70 text-xs">
                                Lider aramayı başlattığında, tüm takım üyeleri birlikte diğer oyuncularla eşleştirilecek.
                                {currentLobby.gameMode === 'arena'
                                    ? ' Minimum 4, maksimum 10 oyuncu ile oynanır.'
                                    : ' Minimum 3, maksimum 5 oyuncu ile oynanır.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Matchmaking Overlay */}
            {matchmakingStatus.status !== 'idle' && (
                <TournamentMatchmaking />
            )}
        </div>
    )
}
