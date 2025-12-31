'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Game, GameMove } from '@/lib/supabase'

export function useRealtimeGame(gameId: string | null) {
    const [game, setGame] = useState<Game | null>(null)
    const [moves, setMoves] = useState<GameMove[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!gameId) return

        // İlk veriyi yükle
        const fetchGameData = async () => {
            const { data: gameData } = await supabase
                .from('games')
                .select('*')
                .eq('id', gameId)
                .single()

            if (gameData) {
                // Sadece mevcut round'un moves'larını al
                const { data: movesData } = await supabase
                    .from('game_moves')
                    .select('*')
                    .eq('game_id', gameId)
                    .eq('round_number', gameData.current_round)
                    .order('move_number', { ascending: true })

                setGame(gameData)
                setMoves(movesData || [])
            }
            setLoading(false)
        }

        fetchGameData()

        // Real-time dinleme: Oyun güncellemeleri
        const gameChannel = supabase
            .channel(`game:${gameId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'games',
                    filter: `id=eq.${gameId}`
                },
                async (payload) => {
                    console.log('Game updated:', payload)
                    const newGame = payload.new as Game
                    setGame(newGame)

                    // Round değiştiyse moves'u yeniden yükle
                    if (payload.old && (payload.old as any).current_round !== newGame.current_round) {
                        const { data: movesData } = await supabase
                            .from('game_moves')
                            .select('*')
                            .eq('game_id', gameId)
                            .eq('round_number', newGame.current_round)
                            .order('move_number', { ascending: true })

                        setMoves(movesData || [])
                    }
                }
            )
            .subscribe()

        // Real-time dinleme: Yeni hamleler
        const movesChannel = supabase
            .channel(`moves:${gameId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'game_moves',
                    filter: `game_id=eq.${gameId}`
                },
                (payload) => {
                    console.log('New move:', payload)
                    setMoves(prev => [...prev, payload.new as GameMove])
                }
            )
            .subscribe()

        return () => {
            gameChannel.unsubscribe()
            movesChannel.unsubscribe()
        }
    }, [gameId])

    return { game, moves, loading }
}
