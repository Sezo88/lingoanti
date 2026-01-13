import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function useCurrency() {
    const { user } = useAuth()
    const [tickets, setTickets] = useState(0)
    const [hearts, setHearts] = useState(0)
    const [lastHeartRegen, setLastHeartRegen] = useState<Date | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Fetch user currency
    const fetchCurrency = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            const { data, error: rpcError } = await supabase.rpc('get_or_create_user_currency', {
                p_user_id: user.id
            })

            if (rpcError) throw rpcError

            if (data && data.length > 0) {
                const currency = data[0]
                setTickets(currency.tickets)
                setHearts(currency.hearts)
                setLastHeartRegen(currency.last_heart_regen ? new Date(currency.last_heart_regen) : null)
            }
        } catch (err: any) {
            console.error('Fetch currency error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [user])

    // Spend tickets
    const spendTickets = async (amount: number, jokerType: string, gameId?: string) => {
        if (!user) {
            setError('Giriş yapmalısınız')
            return false
        }

        try {
            const { data, error: rpcError } = await supabase.rpc('spend_tickets', {
                p_user_id: user.id,
                p_amount: amount,
                p_joker_type: jokerType,
                p_game_id: gameId || null
            })

            if (rpcError) throw rpcError

            if (data) {
                // Refetch to ensure UI is in sync
                await fetchCurrency()
                return true
            }

            setError('Yetersiz bilet')
            return false
        } catch (err: any) {
            console.error('Spend tickets error:', err)
            setError(err.message)
            return false
        }
    }

    // Spend heart
    const spendHeart = async () => {
        if (!user) {
            setError('Giriş yapmalısınız')
            return false
        }

        try {
            const { data, error: rpcError } = await supabase.rpc('spend_heart', {
                p_user_id: user.id
            })

            if (rpcError) throw rpcError

            if (data) {
                // Update local state
                setHearts(prev => prev - 1)
                setLastHeartRegen(new Date())
                return true
            }

            setError('Yetersiz kalp')
            return false
        } catch (err: any) {
            console.error('Spend heart error:', err)
            setError(err.message)
            return false
        }
    }

    // Regenerate hearts
    const regenerateHearts = async () => {
        if (!user) return

        try {
            const { data, error: rpcError } = await supabase.rpc('regenerate_hearts', {
                p_user_id: user.id
            })

            if (rpcError) throw rpcError

            if (data !== null && data !== undefined) {
                setHearts(data)
                if (data < 5) {
                    setLastHeartRegen(new Date())
                }
            }
        } catch (err: any) {
            console.error('Regenerate hearts error:', err)
        }
    }

    // Add tickets (for purchases or rewards)
    const addTickets = async (amount: number, source: string = 'purchase') => {
        if (!user) return

        try {
            const { data, error: rpcError } = await supabase.rpc('add_tickets', {
                p_user_id: user.id,
                p_amount: amount,
                p_source: source
            })

            if (rpcError) throw rpcError

            if (data !== null && data !== undefined) {
                setTickets(data)
                return data
            }
        } catch (err: any) {
            console.error('Add tickets error:', err)
            setError(err.message)
        }
    }

    // Buy hearts with tickets
    const buyHearts = async () => {
        if (!user) {
            setError('Giriş yapmalısınız')
            return false
        }

        // 50 bilet = 5 kalp
        const cost = 50
        if (tickets < cost) {
            setError('Yetersiz bilet')
            return false
        }

        try {
            // Spend tickets
            const success = await spendTickets(cost, 'buy_hearts')
            if (!success) return false

            // Add hearts
            const { error: updateError } = await supabase
                .from('user_currency')
                .update({
                    hearts: 5,
                    last_heart_regen: new Date().toISOString()
                })
                .eq('user_id', user.id)

            if (updateError) throw updateError

            setHearts(5)
            setLastHeartRegen(new Date())
            return true
        } catch (err: any) {
            console.error('Buy hearts error:', err)
            setError(err.message)
            return false
        }
    }

    // Initial fetch
    useEffect(() => {
        fetchCurrency()
    }, [fetchCurrency])

    // Auto-regenerate hearts every 30 seconds (check if 30 minutes passed)
    useEffect(() => {
        if (!user || hearts >= 5) return

        const interval = setInterval(() => {
            regenerateHearts()
        }, 30000) // Check every 30 seconds

        return () => clearInterval(interval)
    }, [user, hearts])

    // Calculate time until next heart regeneration
    const getTimeUntilNextHeart = useCallback(() => {
        if (!lastHeartRegen || hearts >= 5) return null

        const now = new Date()
        const nextRegen = new Date(lastHeartRegen.getTime() + 30 * 60 * 1000) // 30 minutes
        const diff = nextRegen.getTime() - now.getTime()

        if (diff <= 0) {
            regenerateHearts()
            return null
        }

        const minutes = Math.floor(diff / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }, [lastHeartRegen, hearts])

    return {
        tickets,
        hearts,
        lastHeartRegen,
        loading,
        error,
        spendTickets,
        spendHeart,
        regenerateHearts,
        addTickets,
        buyHearts,
        fetchCurrency,
        getTimeUntilNextHeart
    }
}
