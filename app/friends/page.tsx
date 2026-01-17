'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { searchUsers, sendFriendRequest, getFriends, getPendingRequests, acceptFriendRequest, removeFriendship } from '@/lib/friendships'
import { createGame } from '@/lib/games'
import GameSettingsModal, { type GameSettings } from '@/components/GameSettingsModal'
import { useCurrency } from '@/hooks/useCurrency'

import { usePresence } from '@/hooks/usePresence'

function FriendsPageContent() {
    const { user, onlineUsers } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { spendHeart } = useCurrency()

    // ... usePresence call removed
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [friends, setFriends] = useState<any[]>([])
    const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null)

    const toggleFriend = (id: string) => {
        setExpandedFriendId(expandedFriendId === id ? null : id)
    }
    const [pendingRequests, setPendingRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'requests'>('friends')
    const [settingsModalOpen, setSettingsModalOpen] = useState(false)
    const [selectedFriend, setSelectedFriend] = useState<{ id: string; name: string } | null>(null)

    useEffect(() => {
        if (user) {
            loadFriends()
            loadPendingRequests()
        }
    }, [user])

    // Handle rematch parameter
    useEffect(() => {
        const rematchOpponentId = searchParams.get('rematch')
        if (rematchOpponentId && friends.length > 0) {
            const opponent = friends.find(f => f.friend.id === rematchOpponentId)
            if (opponent) {
                setSelectedFriend({ id: opponent.friend.id, name: opponent.friend.display_name })
                setSettingsModalOpen(true)
            }
        }
    }, [searchParams, friends])

    const loadFriends = async () => {
        if (!user) return
        const friendsList = await getFriends(user.id)
        setFriends(friendsList)
    }

    const loadPendingRequests = async () => {
        if (!user) return
        const requests = await getPendingRequests(user.id)
        setPendingRequests(requests)
    }

    const handleSearch = async (query: string) => {
        setSearchQuery(query)
        if (query.length < 2) {
            setSearchResults([])
            return
        }

        if (!user) return
        const results = await searchUsers(query, user.id)
        setSearchResults(results)
    }

    const handleAddFriend = async (friendId: string) => {
        if (!user) return
        setLoading(true)
        const { success } = await sendFriendRequest(user.id, friendId)
        if (success) {
            alert('Arkadaşlık isteği gönderildi!')
            setSearchResults([])
            setSearchQuery('')
        }
        setLoading(false)
    }

    const handleAcceptRequest = async (friendshipId: string) => {
        setLoading(true)
        const { success } = await acceptFriendRequest(friendshipId)
        if (success) {
            await loadFriends()
            await loadPendingRequests()
        }
        setLoading(false)
    }

    const handleRemoveFriend = async (friendshipId: string) => {
        if (!confirm('Arkadaşlığı kaldırmak istediğinize emin misiniz?')) return
        setLoading(true)
        const { success } = await removeFriendship(friendshipId)
        if (success) {
            await loadFriends()
        }
        setLoading(false)
    }

    const handlePlayWithFriend = (friendId: string, friendName: string) => {
        setSelectedFriend({ id: friendId, name: friendName })
        setSettingsModalOpen(true)
    }

    const handleGameSettingsConfirm = async (settings: GameSettings) => {
        if (!user || !selectedFriend) return

        // Spend Lbilet (Inviter pays)
        const success = await spendHeart()
        if (!success) {
            alert('Yetersiz Lbilet! Oyun başlatmak için 1 Lbilet gerekli.')
            return
        }

        setLoading(true)

        const wordLength = settings.wordLength === 'mixed' ? 0 : settings.wordLength
        const { game, error } = await createGame(
            user.id,
            selectedFriend.id,
            wordLength,
            settings.bestOf,
            settings.duration
        )

        if (game) {
            alert('🎮 Oyun daveti gönderildi!')
            router.push('/')
        } else {
            alert('Oyun daveti gönderilemedi!')
        }
        setLoading(false)
        setSelectedFriend(null)
        setSettingsModalOpen(false) // Close modal after confirmation
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="glass-effect border-b border-dark-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/')}
                        className="text-white/70 hover:text-white transition-colors"
                    >
                        ← Geri
                    </button>
                    <h1 className="text-xl font-bold gradient-text">Arkadaşlar</h1>
                    <div className="w-16"></div>
                </div>
            </header>

            {/* Tabs */}
            <div className="container mx-auto px-4 pt-4">
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('friends')}
                        className={`flex-1 py-3 rounded-xl font-semibold transition-all ${activeTab === 'friends'
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-200 text-white/70'
                            }`}
                    >
                        Arkadaşlar ({friends.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`flex-1 py-3 rounded-xl font-semibold transition-all ${activeTab === 'search'
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-200 text-white/70'
                            }`}
                    >
                        Ara
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`flex-1 py-3 rounded-xl font-semibold transition-all ${activeTab === 'requests'
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-200 text-white/70'
                            }`}
                    >
                        İstekler ({pendingRequests.length})
                    </button>
                </div>

                {/* Search Tab */}
                {activeTab === 'search' && (
                    <div className="max-w-md mx-auto">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Kullanıcı adı ara..."
                            className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all text-white mb-4"
                        />

                        <div className="space-y-2">
                            {searchResults.map((user) => (
                                <div key={user.id} className="glass-effect rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-white">{user.display_name}</p>
                                        <p className="text-sm text-white/70">@{user.username}</p>
                                    </div>
                                    <button
                                        onClick={() => handleAddFriend(user.id)}
                                        disabled={loading}
                                        className="px-4 py-2 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                                    >
                                        Ekle
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Friends Tab */}
                {activeTab === 'friends' && (
                    <div className="max-w-md mx-auto space-y-2">
                        {friends.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-white/70">Henüz arkadaşın yok</p>
                                <button
                                    onClick={() => setActiveTab('search')}
                                    className="mt-4 px-6 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
                                >
                                    Arkadaş Ara
                                </button>
                            </div>
                        ) : (
                            friends.map((friendship) => {
                                const isOnline = onlineUsers.has(friendship.friend.id)
                                const isExpanded = expandedFriendId === friendship.id

                                return (
                                    <div key={friendship.id} className="glass-effect rounded-xl overflow-hidden transition-all">
                                        <button
                                            onClick={() => toggleFriend(friendship.id)}
                                            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                                        >
                                            <div>
                                                <p className="font-semibold text-white">{friendship.friend.display_name}</p>
                                                <p className="text-sm text-white/70">@{friendship.friend.username}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className={`text-xs font-semibold flex items-center gap-1 ${isOnline ? 'text-success-400' : 'text-white/80'
                                                    }`}>
                                                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success-500 animate-pulse' : 'bg-dark-400'}`}></span>
                                                    {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                                                </div>
                                                <div className={`text-white/80 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                                    ▼
                                                </div>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="p-4 pt-0 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={() => handlePlayWithFriend(friendship.friend.id, friendship.friend.display_name)}
                                                        disabled={loading}
                                                        className="flex-1 py-2 rounded-lg bg-success-600 text-white font-semibold hover:bg-success-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        <span>🎮</span> Oyun Başlat
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveFriend(friendship.id)}
                                                        className="px-4 py-2 rounded-lg bg-danger-500/10 text-danger-400 font-semibold hover:bg-danger-500/20 transition-colors border border-danger-500/20"
                                                    >
                                                        Kaldır
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}

                {/* Requests Tab */}
                {activeTab === 'requests' && (
                    <div className="max-w-md mx-auto space-y-2">
                        {pendingRequests.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-white/70">Bekleyen istek yok</p>
                            </div>
                        ) : (
                            pendingRequests.map((request) => (
                                <div key={request.id} className="glass-effect rounded-xl p-4">
                                    <div className="mb-3">
                                        <p className="font-semibold text-white">{request.user.display_name}</p>
                                        <p className="text-sm text-white/70">@{request.user.username}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAcceptRequest(request.id)}
                                            disabled={loading}
                                            className="flex-1 py-2 rounded-lg bg-success-600 text-white font-semibold hover:bg-success-700 transition-colors disabled:opacity-50"
                                        >
                                            Kabul Et
                                        </button>
                                        <button
                                            onClick={() => removeFriendship(request.id)}
                                            disabled={loading}
                                            className="flex-1 py-2 rounded-lg bg-dark-300 text-white font-semibold hover:bg-dark-400 transition-colors disabled:opacity-50"
                                        >
                                            Reddet
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Game Settings Modal */}
            {selectedFriend && (
                <GameSettingsModal
                    isOpen={settingsModalOpen}
                    onClose={() => {
                        setSettingsModalOpen(false)
                        setSelectedFriend(null)
                    }}
                    onConfirm={handleGameSettingsConfirm}
                    friendName={selectedFriend.name}
                />
            )}
        </div>
    )
}

export default function FriendsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        }>
            <FriendsPageContent />
        </Suspense>
    )
}
