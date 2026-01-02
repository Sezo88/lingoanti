import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePresence(userId: string | undefined) {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (!userId) return

        const channel = supabase.channel('online_users')

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState()
                const users = new Set<string>()

                // newState: { [presenceId]: [{ user_id: '...', online_at: '...' }] }
                for (const key in newState) {
                    const presences = newState[key] as any[]
                    presences.forEach(p => {
                        if (p.user_id) users.add(p.user_id)
                    })
                }
                setOnlineUsers(users)
            })
            .on('presence', { event: 'join' }, ({ newPresences }) => {
                setOnlineUsers(prev => {
                    const next = new Set(prev)
                    newPresences.forEach((p: any) => next.add(p.user_id))
                    return next
                })
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                setOnlineUsers(prev => {
                    const next = new Set(prev)
                    leftPresences.forEach((p: any) => next.delete(p.user_id))
                    return next
                })
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: userId, online_at: new Date().toISOString() })
                }
            })

        return () => {
            channel.unsubscribe()
        }
    }, [userId])

    return onlineUsers
}
