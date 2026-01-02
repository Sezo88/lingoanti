import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function useMatchmaking() {
    const { user } = useAuth()
    const router = useRouter()
    const [isSearching, setIsSearching] = useState(false)
    const subscriptionRef = useRef<any>(null)

    const findMatch = async () => {
        if (!user) {
            console.error('findMatch called but user is not logged in')
            return
        }

        console.log('Starting matchmaking search for user:', user.id)

        try {
            setIsSearching(true)
            // 1. Önce RPC yöntemini dene (Atomic eşleşme)
            const { data: gameId, error } = await supabase.rpc('find_match', { p_user_id: user.id })

            console.log('find_match RPC result:', { data: gameId, error })

            if (error) {
                console.error('Eşleşme hatası:', error)
                setIsSearching(false)
                return
            }

            if (gameId) {
                // Eşleşme bulundu!
                console.log('Eşleşme bulundu, yönlendiriliyor:', gameId)
                router.push(`/game/${gameId}`)
                return
            }

            // 2. Eşleşme bulunamadı, kuyruğa girdik. Şimdi bekleyelim.
            console.log('Kuyruğa girildi, rakip bekleniyor...')

            // Realtime ile oyun oluşmasını dinle
            // Filtreleme yapmadan dinleyip, callback içinde kontrol edeceğiz (Daha garanti)
            subscriptionRef.current = supabase
                .channel(`matchmaking:${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'games'
                    },
                    (payload: any) => {
                        const newGame = payload.new
                        if (newGame.player1_id === user.id || newGame.player2_id === user.id) {
                            console.log('Oyun oluşturuldu!', newGame.id)
                            router.push(`/game/${newGame.id}`)
                        }
                    }
                )
                .subscribe()

        } catch (err) {
            console.error('Matchmaking error:', err)
            setIsSearching(false)
        }
    }

    const cancelSearch = async () => {
        if (!user) return

        // Kuyruktan çık
        await supabase.from('matchmaking_queue').delete().eq('user_id', user.id)

        // Aboneliği iptal et
        if (subscriptionRef.current) {
            supabase.removeChannel(subscriptionRef.current)
            subscriptionRef.current = null
        }

        setIsSearching(false)
    }

    // Cleanup
    useEffect(() => {
        return () => {
            if (subscriptionRef.current) {
                supabase.removeChannel(subscriptionRef.current)
            }
        }
    }, [])

    return { isSearching, findMatch, cancelSearch }
}
