'use client'

import { useEffect, useState } from 'react'
import { useTournamentMatchmaking } from '@/hooks/useTournamentMatchmaking'
import { supabase } from '@/lib/supabase'

export default function TournamentMatchmaking() {
    const { matchmakingStatus, cancelSearch } = useTournamentMatchmaking()
    const [countdown, setCountdown] = useState<number | null>(null)
    const [participants, setParticipants] = useState<any[]>([])

    // Fetch participants when in waiting/countdown
    useEffect(() => {
        if (matchmakingStatus.roomId && (matchmakingStatus.status === 'waiting' || matchmakingStatus.status === 'countdown')) {
            const fetchParticipants = async () => {
                const { data } = await supabase
                    .from('room_participants')
                    .select(`
                        *,
                        users (username, avatar_url)
                    `)
                    .eq('room_id', matchmakingStatus.roomId)

                if (data) {
                    setParticipants(data)
                }
            }

            fetchParticipants()

            // Subscribe to participant changes
            const channel = supabase
                .channel(`room_participants:${matchmakingStatus.roomId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'room_participants',
                    filter: `room_id=eq.${matchmakingStatus.roomId}`
                }, () => {
                    fetchParticipants()
                })
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [matchmakingStatus.roomId, matchmakingStatus.status])

    // Calculate countdown
    useEffect(() => {
        if (matchmakingStatus.status === 'countdown' && matchmakingStatus.countdownStartedAt) {
            const startTime = new Date(matchmakingStatus.countdownStartedAt).getTime()
            const endTime = startTime + 15000 // 15 seconds

            const updateCountdown = () => {
                const now = Date.now()
                const remaining = Math.max(0, Math.ceil((endTime - now) / 1000))
                setCountdown(remaining)

                if (remaining > 0) {
                    setTimeout(updateCountdown, 100)
                }
            }

            updateCountdown()
        } else {
            setCountdown(null)
        }
    }, [matchmakingStatus.status, matchmakingStatus.countdownStartedAt])

    const getStatusText = () => {
        switch (matchmakingStatus.status) {
            case 'searching':
                return 'Oyuncular aranıyor...'
            case 'waiting':
                return 'Oyuncular bekleniyor...'
            case 'countdown':
                return 'Oyun başlıyor!'
            case 'matched':
                return 'Eşleşme bulundu!'
            default:
                return 'Bekliyor...'
        }
    }

    const getStatusIcon = () => {
        switch (matchmakingStatus.status) {
            case 'countdown':
                return '⏱️'
            case 'matched':
                return '✅'
            default:
                return '🔍'
        }
    }

    const handleCancel = async () => {
        console.log('Cancel button clicked')
        await cancelSearch()
    }

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card p-8 rounded-[24px] max-w-md w-full text-center">
                {/* Icon/Animation */}
                <div className="text-6xl mb-4 animate-bounce">
                    {getStatusIcon()}
                </div>

                {/* Status Text */}
                <h2 className="text-2xl font-bold text-white mb-2">{getStatusText()}</h2>

                {/* Player Count */}
                {matchmakingStatus.currentPlayers !== undefined && (
                    <div className="mb-4">
                        <div className="inline-block bg-white/10 rounded-full px-4 py-2 border border-white/20">
                            <span className="text-white/80 text-sm">Oyuncular: </span>
                            <span className="text-white font-bold text-lg">
                                {matchmakingStatus.currentPlayers}/{matchmakingStatus.maxPlayers}
                            </span>
                        </div>
                    </div>
                )}

                {/* Participants List */}
                {participants.length > 0 && (
                    <div className="mb-6 max-h-48 overflow-y-auto">
                        <p className="text-white/60 text-xs mb-2">Katılımcılar:</p>
                        <div className="space-y-2">
                            {participants.map((p) => (
                                <div key={p.id} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                        {p.users?.username?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <span className="text-white text-sm">{p.users?.username || 'Oyuncu'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Countdown Timer */}
                {countdown !== null && countdown > 0 && (
                    <div className="mb-6">
                        <div className="text-5xl font-black text-yellow-400 animate-pulse">
                            {countdown}
                        </div>
                        <p className="text-white/60 text-sm mt-2">saniye sonra başlıyor</p>
                    </div>
                )}

                {/* Progress Bar */}
                {matchmakingStatus.status === 'waiting' && matchmakingStatus.minPlayers && (
                    <div className="mb-6">
                        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-500"
                                style={{
                                    width: `${Math.min(
                                        100,
                                        ((matchmakingStatus.currentPlayers || 0) / matchmakingStatus.minPlayers) * 100
                                    )}%`
                                }}
                            />
                        </div>
                        <p className="text-white/60 text-xs mt-2">
                            Minimum {matchmakingStatus.minPlayers} oyuncu gerekli
                        </p>
                    </div>
                )}

                {/* Info Text */}
                <p className="text-white/80 mb-8 text-sm">
                    {matchmakingStatus.status === 'countdown'
                        ? 'Daha fazla oyuncu katılabilir'
                        : 'Uygun oyuncular bekleniyor'}
                </p>

                {/* Cancel Button */}
                {matchmakingStatus.status !== 'matched' && (
                    <button
                        onClick={handleCancel}
                        className="w-full py-3 rounded-xl font-semibold bg-danger-500/20 hover:bg-danger-500/30 text-danger-400 hover:text-danger-300 transition-colors border border-danger-500/20"
                    >
                        İptal Et
                    </button>
                )}
            </div>
        </div>
    )
}
