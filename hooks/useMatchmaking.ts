import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrency } from './useCurrency'
import { useAlert } from '@/contexts/AlertContext'

export function useMatchmaking() {
    const { user } = useAuth()
    const router = useRouter()
    const [isSearching, setIsSearching] = useState(false)
    const subscriptionRef = useRef<any>(null)
    const { spendHeart, rewardAd } = useCurrency()
    const { showAlert } = useAlert()

    const findMatch = async () => {
        if (!user) {
            console.error('findMatch called but user is not logged in')
            return
        }

        console.log('Starting matchmaking search for user:', user.id)

        try {
            // Spend Lbilet (Heart) check
            const success = await spendHeart()

            if (!success) {
                showAlert({
                    title: 'Biletin Bitti! 😱',
                    message: 'Oyun oynamak için 1 Lbilet gerekli.',
                    type: 'warning',
                    actions: [
                        {
                            label: 'Reklam İzle (+1 ❤️)',
                            onClick: async () => {
                                const ok = await rewardAd('hearts')
                                if (ok) showAlert({ message: '1 Lbilet Kazandın!', type: 'success' })
                            },
                            variant: 'primary'
                        },
                        {
                            label: 'Kapat',
                            onClick: () => { },
                            variant: 'outline'
                        }
                    ]
                })
                return
            }

            setIsSearching(true)
            // 1. Önce RPC yöntemini dene (Atomic eşleşme)
            const { data: gameId, error } = await supabase.rpc('find_match', { p_user_id: user.id })

            console.log('find_match RPC result:', { data: gameId, error })

            if (error) {
                console.error('Eşleşme hatası:', error)
                showAlert({ message: `Eşleşme Hatası: ${error.message || error.details || 'Bilinmeyen hata'}`, type: 'error' })
                setIsSearching(false)
                return
            }

            if (gameId) {
                // Eşleşme bulundu!
                console.log('Eşleşme bulundu, yönlendiriliyor:', gameId)
                router.push(`/game/play?id=${gameId}`)
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
                            router.push(`/game/play?id=${newGame.id}`)
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
