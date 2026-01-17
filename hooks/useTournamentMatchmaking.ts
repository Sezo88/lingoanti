import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrency } from './useCurrency'

type GameMode = 'arena' | 'turn_based'

type MatchmakingStatus = {
    status: 'idle' | 'searching' | 'waiting' | 'countdown' | 'matched'
    roomId?: string
    waitingRoomId?: string
    currentPlayers?: number
    minPlayers?: number
    maxPlayers?: number
    countdownStartedAt?: string
}

type LobbyInfo = {
    id: string
    lobbyCode: string
    leaderId: string
    gameMode: GameMode
    status: string
    members: Array<{ id: string; userId: string; username: string }>
}

export function useTournamentMatchmaking() {
    const { user } = useAuth()
    const router = useRouter()
    const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus>({ status: 'idle' })
    const [currentLobby, setCurrentLobby] = useState<LobbyInfo | null>(null)
    const [error, setError] = useState<string | null>(null)
    const { spendHeart } = useCurrency()

    const subscriptionRef = useRef<any>(null)
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
    const cancelledRef = useRef(false)

    // Join tournament as solo player
    const joinTournament = async (gameMode: GameMode) => {
        if (!user) {
            setError('Giriş yapmalısınız')
            return
        }

        try {
            // Spend Lbilet
            const success = await spendHeart()
            if (!success) {
                alert('Yetersiz Lbilet! Turnuvaya katılmak için 1 Lbilet gerekli.')
                return
            }

            setError(null)
            cancelledRef.current = false // Reset cancelled flag
            setMatchmakingStatus({ status: 'searching' })

            // Call RPC function
            const { data, error: rpcError } = await supabase.rpc('find_tournament_match', {
                p_user_id: user.id,
                p_lobby_id: null,
                p_game_mode: gameMode
            })

            if (rpcError) {
                console.error('Tournament matchmaking error:', rpcError)
                setError(rpcError.message)
                setMatchmakingStatus({ status: 'idle' })
                return
            }

            handleMatchmakingResponse(data)
        } catch (err: any) {
            console.error('Join tournament error:', err)
            setError(err.message)
            setMatchmakingStatus({ status: 'idle' })
        }
    }

    // Create lobby for team play
    const createLobby = async (gameMode: GameMode) => {
        if (!user) {
            setError('Giriş yapmalısınız')
            return null
        }

        try {
            setError(null)

            const { data: lobbyId, error: rpcError } = await supabase.rpc('create_tournament_lobby', {
                p_leader_id: user.id,
                p_game_mode: gameMode
            })

            if (rpcError) {
                console.error('Create lobby error:', rpcError)
                setError(rpcError.message)
                return null
            }

            // Fetch lobby details
            await fetchLobbyDetails(lobbyId)
            return lobbyId
        } catch (err: any) {
            console.error('Create lobby error:', err)
            setError(err.message)
            return null
        }
    }

    // Join existing lobby
    const joinLobby = async (lobbyCode: string) => {
        if (!user) {
            setError('Giriş yapmalısınız')
            return null
        }

        try {
            setError(null)

            const { data: lobbyId, error: rpcError } = await supabase.rpc('join_tournament_lobby', {
                p_user_id: user.id,
                p_lobby_code: lobbyCode.toUpperCase()
            })

            if (rpcError) {
                console.error('Join lobby error:', rpcError)
                setError(rpcError.message)
                return null
            }

            await fetchLobbyDetails(lobbyId)
            return lobbyId
        } catch (err: any) {
            console.error('Join lobby error:', err)
            setError(err.message)
            return null
        }
    }

    // Start lobby search
    const startLobbySearch = async () => {
        if (!currentLobby) {
            setError('Lobby bulunamadı')
            return
        }

        try {
            // Spend Lbilet (Only leader pays to start?) - For now yes
            const success = await spendHeart()
            if (!success) {
                alert('Yetersiz Lbilet! Aramayı başlatmak için Lbilet gerekli.')
                return
            }

            setError(null)
            cancelledRef.current = false // Reset cancelled flag
            setMatchmakingStatus({ status: 'searching' })

            const { data, error: rpcError } = await supabase.rpc('find_tournament_match', {
                p_user_id: null,
                p_lobby_id: currentLobby.id,
                p_game_mode: currentLobby.gameMode
            })

            if (rpcError) {
                console.error('Lobby search error:', rpcError)
                setError(rpcError.message)
                setMatchmakingStatus({ status: 'idle' })
                return
            }

            if (!data) {
                setError('Eşleşme bulunamadı')
                setMatchmakingStatus({ status: 'idle' })
                return
            }

            handleMatchmakingResponse(data)
        } catch (err: any) {
            console.error('Start lobby search error:', err)
            setError(err.message)
            setMatchmakingStatus({ status: 'idle' })
        }
    }

    // Cancel search
    const cancelSearch = async () => {
        if (!user) return

        console.log('🔴 cancelSearch called, current status:', matchmakingStatus)

        try {
            // Set cancelled flag FIRST
            cancelledRef.current = true
            console.log('🚫 Cancelled flag set to true')

            await supabase.rpc('cancel_tournament_search', {
                p_user_id: currentLobby ? null : user.id,
                p_lobby_id: currentLobby?.id || null
            })

            console.log('✅ RPC cancel_tournament_search completed')

            // Clean up ALL subscriptions
            if (subscriptionRef.current) {
                await supabase.removeChannel(subscriptionRef.current)
                subscriptionRef.current = null
                console.log('✅ subscriptionRef cleaned up')
            }

            if (countdownTimerRef.current) {
                clearTimeout(countdownTimerRef.current)
                countdownTimerRef.current = null
                console.log('✅ Countdown timer cleared')
            }

            console.log('🔄 Setting matchmaking status to idle')
            setMatchmakingStatus({ status: 'idle' })
            console.log('✅ Matchmaking status set to idle')
        } catch (err: any) {
            console.error('❌ Cancel search error:', err)
        }
    }

    // Leave lobby
    const leaveLobby = async () => {
        if (!currentLobby || !user) return

        try {
            // Remove from lobby members
            await supabase
                .from('tournament_lobby_members')
                .delete()
                .eq('lobby_id', currentLobby.id)
                .eq('user_id', user.id)

            // If leader, delete lobby
            if (currentLobby.leaderId === user.id) {
                await supabase
                    .from('tournament_lobbies')
                    .delete()
                    .eq('id', currentLobby.id)
            }

            setCurrentLobby(null)
        } catch (err: any) {
            console.error('Leave lobby error:', err)
            setError(err.message)
        }
    }

    // Helper: Handle matchmaking response
    const handleMatchmakingResponse = (data: any) => {
        console.log('Matchmaking response:', data)

        if (data.status === 'matched') {
            setMatchmakingStatus({ status: 'matched', roomId: data.room_id })
            // Navigate to room using code, not ID
            router.push(`/rooms/${data.room_code || data.room_id}`)
        } else if (data.status === 'countdown') {
            setMatchmakingStatus({
                status: 'countdown',
                roomId: data.room_id,
                waitingRoomId: data.waiting_room_id,
                currentPlayers: data.current_players,
                minPlayers: data.min_players,
                maxPlayers: data.max_players,
                countdownStartedAt: data.countdown_started_at
            })
            setupCountdownTimer(data.waiting_room_id, data.countdown_started_at)
            subscribeToWaitingRoom(data.waiting_room_id)
        } else {
            setMatchmakingStatus({
                status: 'waiting',
                roomId: data.room_id,
                waitingRoomId: data.waiting_room_id,
                currentPlayers: data.current_players,
                minPlayers: data.min_players,
                maxPlayers: data.max_players
            })
            subscribeToWaitingRoom(data.waiting_room_id)
        }
    }

    // Helper: Fetch lobby details
    const fetchLobbyDetails = async (lobbyId: string) => {
        const { data: lobby, error: lobbyError } = await supabase
            .from('tournament_lobbies')
            .select('*')
            .eq('id', lobbyId)
            .single()

        if (lobbyError) {
            console.error('Fetch lobby error:', lobbyError)
            return
        }

        const { data: members, error: membersError } = await supabase
            .from('tournament_lobby_members')
            .select(`
                id,
                user_id,
                users:user_id (username)
            `)
            .eq('lobby_id', lobbyId)

        if (membersError) {
            console.error('Fetch members error:', membersError)
            return
        }

        setCurrentLobby({
            id: lobby.id,
            lobbyCode: lobby.lobby_code,
            leaderId: lobby.leader_id,
            gameMode: lobby.game_mode,
            status: lobby.status,
            members: members.map((m: any) => ({
                id: m.id,
                userId: m.user_id,
                username: m.users?.username || 'Unknown'
            }))
        })
    }

    // Helper: Subscribe to waiting room updates
    const subscribeToWaitingRoom = (waitingRoomId: string) => {
        // Clean up existing subscription first
        if (subscriptionRef.current) {
            supabase.removeChannel(subscriptionRef.current)
        }

        subscriptionRef.current = supabase
            .channel(`waiting_room:${waitingRoomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tournament_waiting_rooms',
                    filter: `id=eq.${waitingRoomId}`
                },
                (payload: any) => {
                    // Don't update if cancelled OR if status is already idle
                    if (cancelledRef.current) {
                        console.log('⚠️ Ignoring waiting room update - search cancelled (flag)')
                        return
                    }

                    const updated = payload.new
                    console.log('Waiting room update:', updated)

                    // Double check - if we're somehow idle, don't process
                    setMatchmakingStatus(prev => {
                        if (prev.status === 'idle') {
                            console.log('⚠️ Ignoring waiting room update - status is idle')
                            return prev
                        }

                        if (updated.status === 'started') {
                            // Get room code from rooms table
                            supabase.from('rooms').select('code').eq('id', updated.room_id).single()
                                .then(({ data: room }) => {
                                    if (room) {
                                        router.push(`/rooms/${room.code}`)
                                    }
                                })
                            return { status: 'matched', roomId: updated.room_id }
                        } else if (updated.status === 'countdown' && updated.countdown_started_at) {
                            setupCountdownTimer(waitingRoomId, updated.countdown_started_at)
                            return {
                                ...prev,
                                status: 'countdown',
                                countdownStartedAt: updated.countdown_started_at,
                                currentPlayers: updated.current_players
                            }
                        }

                        return {
                            ...prev,
                            currentPlayers: updated.current_players
                        }
                    })
                }
            )
            .subscribe()
    }

    // Helper: Setup countdown timer
    const setupCountdownTimer = (waitingRoomId: string, countdownStartedAt: string) => {
        console.log('Setting up countdown timer for waiting room:', waitingRoomId)
        console.log('Countdown started at:', countdownStartedAt)

        if (countdownTimerRef.current) {
            clearTimeout(countdownTimerRef.current)
        }

        const startTime = new Date(countdownStartedAt).getTime()
        const endTime = startTime + 15000 // 15 seconds
        const now = Date.now()
        const remaining = endTime - now

        console.log('Countdown remaining time:', remaining, 'ms')

        if (remaining > 0) {
            countdownTimerRef.current = setTimeout(async () => {
                console.log('Countdown finished! Starting tournament game...')
                // Trigger game start
                const { error } = await supabase.rpc('start_tournament_game', {
                    p_waiting_room_id: waitingRoomId
                })
                if (error) {
                    console.error('Failed to start tournament game:', error)
                }
            }, remaining)
        } else {
            console.warn('Countdown already expired! Not setting timer.')
        }
    }

    // Cleanup
    useEffect(() => {
        return () => {
            if (subscriptionRef.current) {
                supabase.removeChannel(subscriptionRef.current)
            }
            if (countdownTimerRef.current) {
                clearTimeout(countdownTimerRef.current)
            }
        }
    }, [])

    return {
        matchmakingStatus,
        currentLobby,
        error,
        joinTournament,
        createLobby,
        joinLobby,
        startLobbySearch,
        cancelSearch,
        leaveLobby,
        fetchLobbyDetails
    }
}
