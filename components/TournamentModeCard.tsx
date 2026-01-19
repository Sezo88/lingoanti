'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTournamentMatchmaking } from '@/hooks/useTournamentMatchmaking'
import TournamentMatchmaking from './TournamentMatchmaking'

export default function TournamentModeCard() {
    const router = useRouter()
    const { joinTournament, createLobby, joinLobby, matchmakingStatus, error } = useTournamentMatchmaking()
    const [showLobbyModal, setShowLobbyModal] = useState(false)
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [selectedMode, setSelectedMode] = useState<'arena' | 'turn_based' | null>(null)
    const [lobbyCode, setLobbyCode] = useState('')

    const handleSoloJoin = async (mode: 'arena' | 'turn_based') => {
        await joinTournament(mode)
    }

    const handleTeamCreate = (mode: 'arena' | 'turn_based') => {
        setSelectedMode(mode)
        setShowLobbyModal(true)
    }

    const handleTeamJoin = (mode: 'arena' | 'turn_based') => {
        setSelectedMode(mode)
        setShowJoinModal(true)
    }

    const handleCreateLobby = async () => {
        if (!selectedMode) return
        const lobbyId = await createLobby(selectedMode)
        if (lobbyId) {
            setShowLobbyModal(false)
            router.push(`/tournament/lobby/${lobbyId}`)
        }
    }

    const handleJoinLobby = async () => {
        if (!lobbyCode.trim()) {
            alert('Lütfen lobby kodunu girin')
            return
        }
        const lobbyId = await joinLobby(lobbyCode.trim().toUpperCase())
        if (lobbyId) {
            setShowJoinModal(false)
            setLobbyCode('')
            router.push(`/tournament/lobby/${lobbyId}`)
        }
    }

    // Debug logging
    console.log('TournamentModeCard render, matchmakingStatus:', matchmakingStatus)
    console.log('Should show overlay?', matchmakingStatus.status !== 'idle')

    return (
        <>
            {/* Matchmaking Overlay - Show for all non-idle statuses */}
            {matchmakingStatus.status !== 'idle' && (
                <>
                    {console.log('✅ RENDERING TournamentMatchmaking overlay!')}
                    <TournamentMatchmaking matchmakingStatus={matchmakingStatus} />
                </>
            )}

            {/* Lobby Creation Modal */}
            {showLobbyModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-card p-6 rounded-[24px] max-w-sm w-full">
                        <h3 className="text-xl font-bold text-white mb-4">Takım Lobby'si Oluştur</h3>
                        <p className="text-white/80 text-sm mb-6">
                            Arkadaşlarınla birlikte turnuvaya katılmak için bir lobby oluştur.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowLobbyModal(false)}
                                className="flex-1 py-3 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleCreateLobby}
                                className="flex-1 py-3 rounded-xl font-semibold bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                            >
                                Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lobby Join Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-card p-6 rounded-[24px] max-w-sm w-full">
                        <h3 className="text-xl font-bold text-white mb-4">Lobby'ye Katıl</h3>
                        <p className="text-white/80 text-sm mb-4">
                            Arkadaşının lobby kodunu gir ve takıma katıl.
                        </p>
                        <input
                            type="text"
                            value={lobbyCode}
                            onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                            placeholder="LOBBY KODU"
                            maxLength={6}
                            className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-xl text-white text-center text-2xl font-mono font-bold tracking-widest mb-6 focus:outline-none focus:border-primary-500 transition-colors"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowJoinModal(false)
                                    setLobbyCode('')
                                }}
                                className="flex-1 py-3 rounded-xl font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleJoinLobby}
                                disabled={lobbyCode.length !== 6}
                                className="flex-1 py-3 rounded-xl font-semibold bg-primary-600 hover:bg-primary-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Katıl
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="bg-danger-500/90 text-white px-4 py-2 rounded-lg shadow-lg font-bold">
                        {error}
                    </div>
                </div>
            )}

            {/* Tournament Card */}
            <div className="glass-card rounded-[24px] p-5 shadow-xl transition-transform active:scale-[0.98]">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white shadow-inner">
                                <span className="material-symbols-outlined text-2xl">emoji_events</span>
                            </div>
                            <div>
                                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/90 text-white text-[10px] font-black tracking-wide uppercase mb-1 shadow-sm">
                                    Turnuva
                                </div>
                                <h3 className="text-lg font-bold leading-tight text-white">Turnuva Modu</h3>
                                <p className="text-white/80 text-sm">Rastgele oyuncularla yarış</p>
                            </div>
                        </div>
                    </div>

                    {/* Game Mode Selection */}
                    <div className="space-y-3">
                        {/* Arena Mode */}
                        <div className="bg-black/20 rounded-xl p-3 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-white font-bold text-sm">Kelime Yarışı</h4>
                                    <p className="text-white/60 text-xs">4-10 oyuncu</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSoloJoin('arena')}
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2 rounded-full text-xs font-bold shadow-md"
                                >
                                    Solo Katıl
                                </button>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleTeamCreate('arena')}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30 flex items-center gap-1"
                                        title="Lobby Oluştur"
                                    >
                                        <span className="material-symbols-outlined text-sm">group_add</span>
                                        Takım Kur
                                    </button>
                                    <button
                                        onClick={() => handleTeamJoin('arena')}
                                        className="px-3 py-2 rounded-xl text-[10px] leading-tight font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm flex flex-col items-center justify-center text-center h-full min-w-[60px]"
                                        title="Lobby'ye Katıl"
                                    >
                                        <span>Takıma</span>
                                        <span>Katıl</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Turn-Based Mode */}
                        <div className="bg-black/20 rounded-xl p-3 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-white font-bold text-sm">Sıra Sende</h4>
                                    <p className="text-white/60 text-xs">3-5 oyuncu</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSoloJoin('turn_based')}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-2 rounded-full text-xs font-bold shadow-md"
                                >
                                    Solo Katıl
                                </button>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleTeamCreate('turn_based')}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30 flex items-center gap-1"
                                        title="Lobby Oluştur"
                                    >
                                        <span className="material-symbols-outlined text-sm">group_add</span>
                                        Takım Kur
                                    </button>
                                    <button
                                        onClick={() => handleTeamJoin('turn_based')}
                                        className="px-3 py-2 rounded-xl text-[10px] leading-tight font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm flex flex-col items-center justify-center text-center h-full min-w-[60px]"
                                        title="Lobby'ye Katıl"
                                    >
                                        <span>Takıma</span>
                                        <span>Katıl</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
