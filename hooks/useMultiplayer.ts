import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export interface Room {
    id: string
    code: string
    host_id: string
    status: 'waiting' | 'playing' | 'finished'
    config: any
}

export interface Participant {
    id: string
    user_id: string
    status: 'ready' | 'playing' | 'finished' | 'spectating'
    score: number
    username?: string // Join ile getirilecek
    display_name?: string
}

export function useMultiplayer() {
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const createRoom = useCallback(async (isPublic = false, duration = 60, gameMode: 'arena' | 'turn_based' = 'arena', wordLength = 5) => {
        if (!user) return

        setLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase
                .from('rooms')
                .insert({
                    host_id: user.id,
                    game_mode: gameMode,
                    config: { isPublic, wordCount: 5, wordLength, duration },
                    status: 'waiting'
                })
                .select()
                .single()

            if (error) throw error

            // Odaya host olarak katıl
            const { error: joinError } = await supabase
                .from('room_participants')
                .insert({
                    room_id: data.id,
                    user_id: user.id,
                    status: 'ready'
                })

            if (joinError) throw joinError

            router.push(`/rooms/${data.code}`)
            return data
        } catch (e: any) {
            console.error('Oda oluşturma hatası:', e)
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [user, router])

    const joinRoom = useCallback(async (code: string) => {
        if (!user) return

        setLoading(true)
        setError(null)

        try {
            // 1. Odayı bul
            const { data: room, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', code.toUpperCase())
                .single()

            if (roomError || !room) throw new Error('Oda bulunamadı')

            if (room.status !== 'waiting') throw new Error('Oda şu an oyunda, katılamazsınız')

            // 2. Zaten içeride miyim?
            const { data: existing } = await supabase
                .from('room_participants')
                .select('id')
                .eq('room_id', room.id)
                .eq('user_id', user.id)
                .single()

            if (!existing) {
                // Katıl
                const { error: joinError } = await supabase
                    .from('room_participants')
                    .insert({
                        room_id: room.id,
                        user_id: user.id,
                        status: 'ready'
                    })

                if (joinError) throw joinError
            }

            router.push(`/rooms/${code}`)
        } catch (e: any) {
            console.error('Odaya katılma hatası:', e)
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [user, router])

    return {
        createRoom,
        joinRoom,
        loading,
        error
    }
}
