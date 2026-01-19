'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LeaderboardUser {
    id: string
    username: string
    score: number
    avatar_url?: string
}

export default function LeaderboardWidget() {
    const [users, setUsers] = useState<LeaderboardUser[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLeaderboard()
    }, [])

    const fetchLeaderboard = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, score, avatar_url')
                .order('score', { ascending: false })
                .limit(5)

            if (data) {
                setUsers(data)
            }
        } catch (error) {
            console.error('Leaderboard fetch error:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="glass-card rounded-[24px] p-5 shadow-xl animate-pulse">
                <div className="h-6 w-32 bg-white/10 rounded mb-4"></div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 bg-white/5 rounded-xl"></div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="glass-card rounded-[24px] p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-4 text-white/80">
                <span className="material-symbols-outlined text-xl text-yellow-400">leaderboard</span>
                <h3 className="text-sm font-bold uppercase tracking-wider">Liderlik Tablosu</h3>
            </div>

            <div className="space-y-3">
                {users.map((user, index) => (
                    <div key={user.id} className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
                        <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                            ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                index === 1 ? 'bg-gray-300 text-gray-800' :
                                    index === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-white'}
                        `}>
                            {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-white font-bold text-sm truncate">{user.username || 'İsimsiz'}</div>
                        </div>
                        <div className="font-mono text-yellow-400 font-bold text-sm">
                            {user.score}
                        </div>
                    </div>
                ))}

                {users.length === 0 && (
                    <div className="text-center text-white/50 text-xs py-4">
                        Henüz sıralama yok
                    </div>
                )}
            </div>
        </div>
    )
}
