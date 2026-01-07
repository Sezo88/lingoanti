'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { usePresence } from '@/hooks/usePresence'

interface LeaderboardUser {
    id: string
    display_name: string
    username: string
    avatar_url: string | null
    score: number
    wins: number
    total_games: number
}

export default function LeaderboardPage() {
    const router = useRouter()
    const { user, onlineUsers } = useAuth()
    const [users, setUsers] = useState<LeaderboardUser[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLeaderboard()
    }, [])

    const fetchLeaderboard = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, display_name, username, avatar_url, score, wins, total_games')
                .order('score', { ascending: false })
                .order('wins', { ascending: false }) // Puan eşitse galibiyete bak
                .limit(50)

            if (error) throw error

            setUsers(data || [])
        } catch (error) {
            console.error('Liderlik tablosu hatası:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col">
            <header className="glass-effect border-b border-dark-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="text-dark-500 hover:text-white transition-colors">
                        ← Geri
                    </Link>
                    <h1 className="text-xl font-bold gradient-text">Liderlik Tablosu</h1>
                    <div className="w-8"></div> {/* Spacer */}
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
                    </div>
                ) : (
                    <div className="glass-effect rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-dark-400 text-sm">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">#</th>
                                        <th className="px-6 py-4 font-semibold">Oyuncu</th>
                                        <th className="px-6 py-4 font-semibold text-center">Galibiyet</th>
                                        <th className="px-6 py-4 font-semibold text-right">Puan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-200">
                                    {users.map((lbUser, index) => (
                                        <tr key={lbUser.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-dark-400 font-mono">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-xs uppercase">
                                                        {lbUser.avatar_url ? (
                                                            <img src={lbUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            lbUser.display_name?.substring(0, 2) || 'OY'
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-white flex items-center gap-2">
                                                            {lbUser.display_name}
                                                            {onlineUsers.has(lbUser.id) && (
                                                                <span className="w-2 h-2 bg-success-500 rounded-full animate-pulse shadow-lg shadow-success-500/50" title="Online"></span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-dark-500">
                                                            @{lbUser.username}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-dark-300">
                                                {lbUser.wins} / {lbUser.total_games}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-primary-400">
                                                {lbUser.score}
                                            </td>
                                        </tr>
                                    ))}

                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-dark-500">
                                                Henüz sıralama oluşmadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
