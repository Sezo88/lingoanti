import { getAdminStats, distributeTickets, distributeCoins, sendGlobalNotification } from "@/actions/admin"
import { revalidatePath } from "next/cache"

export default async function AdminPage() {
    const stats = await getAdminStats()

    async function handleTickets(formData: FormData) {
        "use server"
        await distributeTickets(5)
        revalidatePath("/admin")
    }

    async function handleCoins(formData: FormData) {
        "use server"
        const amount = Number(formData.get("amount"))
        await distributeCoins(amount)
        revalidatePath("/admin")
    }

    async function handleNotification(formData: FormData) {
        "use server"
        const title = formData.get("title") as string
        const body = formData.get("body") as string
        await sendGlobalNotification(title, body)
        revalidatePath("/admin")
    }

    return (
        <div className="space-y-8">
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
                {/* Rewards Section */}
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold">🎁 Ödül Dağıtımı</h2>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
                        <h3 className="text-lg font-medium">Toplu Bilet Dağıt</h3>
                        <p className="text-sm text-gray-400">Herkese 5 LBilet gönderir.</p>
                        <form action={handleTickets}>
                            <button
                                type="submit"
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all"
                            >
                                Herkese 5 LBilet Ver 🎟️
                            </button>
                        </form>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
                        <h3 className="text-lg font-medium">Toplu Para Dağıt</h3>
                        <p className="text-sm text-gray-400">Belirlenen miktarda LPara gönderir.</p>
                        <form action={handleCoins} className="space-y-3">
                            <input
                                type="number"
                                name="amount"
                                placeholder="Miktar (Örn: 1000)"
                                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                                defaultValue={100}
                            />
                            <button
                                type="submit"
                                className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold transition-all"
                            >
                                Herkese LPara Gönder 💰
                            </button>
                        </form>
                    </div>
                </div>

                {/* Notification Section */}
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold">📢 Duyuru & Bildirim</h2>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <form action={handleNotification} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Başlık</label>
                                <input
                                    type="text"
                                    name="title"
                                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                                    placeholder="Örn: Turnuva Başlıyor!"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Mesaj</label>
                                <textarea
                                    name="body"
                                    rows={4}
                                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                                    placeholder="Bildirim içeriği..."
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all"
                            >
                                Herkese Bildirim Gönder 🚀
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
