'use client'

import { useState, useTransition } from 'react'
import { distributeTickets, distributeCoins, sendGlobalNotification, searchUsers, toggleBanUser, deleteUser } from '@/actions/admin'
import { motion } from 'framer-motion'

interface AdminStats {
    totalUsers: number
    activeGames: number
    newUsers: number
}

interface AdminDashboardProps {
    stats: AdminStats
}

export default function AdminDashboard({ stats }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview')
    const [isPending, startTransition] = useTransition()

    // User Search State
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Actions
    const handleDistributeTickets = async () => {
        if (!confirm('Tüm kullanıcılara 5 Bilet göndermek istediğine emin misin?')) return

        startTransition(async () => {
            const res = await distributeTickets(5)
            if (res.success) alert(res.message)
            else alert('Hata: ' + res.error)
        })
    }

    const handleDistributeCoins = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const amount = Number(formData.get('amount'))

        if (!confirm(`Tüm kullanıcılara ${amount} LPara göndermek istediğine emin misin?`)) return

        startTransition(async () => {
            const res = await distributeCoins(amount)
            if (res.success) alert(res.message)
            else alert('Hata: ' + res.error)
        })
    }

    const handleNotification = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const title = formData.get('title') as string
        const body = formData.get('body') as string

        if (!confirm('Bu bildirimi herkese göndermek istiyor musun?')) return

        startTransition(async () => {
            const res = await sendGlobalNotification(title, body)
            if (res.success) alert(res.message)
            else alert('Hata: ' + res.error)
        })
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (searchQuery.length < 2) return

        setIsSearching(true)
        const users = await searchUsers(searchQuery)
        setSearchResults(users)
        setIsSearching(false)
    }

    const handleBan = async (userId: string, currentStatus: boolean) => {
        if (!confirm(`Kullanıcıyı ${currentStatus ? 'yasaklamak' : 'yasağını kaldırmak'} istiyor musun?`)) return

        const res = await toggleBanUser(userId, currentStatus)
        if (res.success) {
            alert(res.message)
            // Update local state to reflect change immediately
            setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, is_banned: currentStatus } : u))
        } else {
            alert('Hata: ' + res.error)
        }
    }

    const handleDelete = async (userId: string) => {
        if (!confirm('BU KULLANICIYI SİLMEK İSTEDİĞİNE EMİN MİSİN? Bu işlem geri alınamaz!')) return

        const res = await deleteUser(userId)
        if (res.success) {
            alert(res.message)
            setSearchResults(prev => prev.filter(u => u.id !== userId))
        } else {
            alert('Hata: ' + res.error)
        }
    }

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-700 pb-4">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                    Genel Bakış & Ödüller
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                    Kullanıcı Yönetimi 👥
                </button>
            </div>

            {activeTab === 'overview' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
                            <h3 className="text-gray-400 text-sm font-medium">Toplam Kullanıcı</h3>
                            <p className="text-3xl font-bold text-white mt-2">{stats.totalUsers}</p>
                        </div>
                        <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
                            <h3 className="text-gray-400 text-sm font-medium">Aktif Oyunlar</h3>
                            <p className="text-3xl font-bold text-green-400 mt-2">{stats.activeGames}</p>
                        </div>
                        <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
                            <h3 className="text-gray-400 text-sm font-medium">Yeni Üyeler (24s)</h3>
                            <p className="text-3xl font-bold text-purple-400 mt-2">{stats.newUsers}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Rewards */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold">🎁 Ödül Dağıtımı</h2>

                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
                                <h3 className="text-lg font-medium">Toplu Bilet Dağıt</h3>
                                <p className="text-sm text-gray-400">Herkese 5 LBilet gönderir.</p>
                                <button
                                    onClick={handleDistributeTickets}
                                    disabled={isPending}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                                >
                                    {isPending ? 'İşleniyor...' : 'Herkese 5 LBilet Ver 🎟️'}
                                </button>
                            </div>

                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
                                <h3 className="text-lg font-medium">Toplu Para Dağıt</h3>
                                <form onSubmit={handleDistributeCoins} className="space-y-3">
                                    <input
                                        type="number"
                                        name="amount"
                                        placeholder="Miktar (Örn: 1000)"
                                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                                        defaultValue={100}
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={isPending}
                                        className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                                    >
                                        {isPending ? 'Gönderiliyor...' : 'Herkese LPara Gönder 💰'}
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Notifications */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold">📢 Duyuru & Bildirim</h2>
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                                <form onSubmit={handleNotification} className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Başlık</label>
                                        <input
                                            type="text"
                                            name="title"
                                            className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                                            placeholder="Örn: Turnuva Başlıyor!"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Mesaj</label>
                                        <textarea
                                            name="body"
                                            rows={4}
                                            className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                                            placeholder="Bildirim içeriği..."
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isPending}
                                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                                    >
                                        {isPending ? 'Gönderiliyor...' : 'Herkese Bildirim Gönder 🚀'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {activeTab === 'users' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">🔎 Kullanıcı Ara</h2>
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Kullanıcı adı veya email..."
                                className="flex-1 p-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                            />
                            <button
                                type="submit"
                                disabled={isSearching}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-white disabled:opacity-50"
                            >
                                {isSearching ? '...' : 'Ara'}
                            </button>
                        </form>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-900 text-gray-400">
                                    <tr>
                                        <th className="p-4">Kullanıcı</th>
                                        <th className="p-4">Email</th>
                                        <th className="p-4">Rol</th>
                                        <th className="p-4">Durum</th>
                                        <th className="p-4 text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {searchResults.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-700/50">
                                            <td className="p-4 font-medium text-white">{user.username || 'Anonim'}</td>
                                            <td className="p-4 text-gray-300">{user.email}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs ${user.role === 'super_admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-600/30 text-gray-300'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {user.is_banned ? (
                                                    <span className="text-red-400 font-bold">YASAKLI</span>
                                                ) : (
                                                    <span className="text-green-400">Aktif</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button
                                                    onClick={() => handleBan(user.id, !user.is_banned)}
                                                    className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${user.is_banned
                                                            ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                                            : 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30'
                                                        }`}
                                                >
                                                    {user.is_banned ? 'Yasağı Kaldır' : 'Yasakla'}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.id)}
                                                    className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded text-sm font-semibold transition-colors"
                                                >
                                                    Sil
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'users' && searchResults.length === 0 && !isSearching && searchQuery.length > 2 && (
                        <div className="text-center py-8 text-gray-500">Kullanıcı bulunamadı.</div>
                    )}
                </motion.div>
            )}
        </div>
    )
}
