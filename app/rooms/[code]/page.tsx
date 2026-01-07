'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ArenaBoard from '@/components/ArenaBoard'

interface Participant {
    id: string
    user_id: string
    status: string
    score: number
    display_name: string
    current_word_index?: number // Progress bar için
}

export default function RoomLobbyPage() {
    const { code } = useParams()
    const { user } = useAuth()
    const router = useRouter()

    const [room, setRoom] = useState<any>(null)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [loading, setLoading] = useState(true)
    const [isHost, setIsHost] = useState(false)

    // Odayı ve katılımcıları yükle
    useEffect(() => {
        if (!code || !user) return

        let mounted = true

        const fetchRoomData = async () => {
            try {
                // 1. Odayı bul
                const { data: roomData, error: roomError } = await supabase
                    .from('rooms')
                    .select('*')
                    .eq('code', code)
                    .single()

                if (roomError || !roomData) {
                    console.error('Oda bulunamadı:', roomError)
                    if (mounted) router.push('/rooms')
                    return
                }

                if (mounted) {
                    setRoom(roomData)
                    setIsHost(roomData.host_id === user.id)
                }

                // 2. Katılımcıları bul
                const { data: parts, error: partsError } = await supabase
                    .from('room_participants')
                    .select('id, user_id, status, score, current_word_index')
                    .eq('room_id', roomData.id)

                if (partsError) throw partsError

                if (parts && mounted) {
                    // Kullanıcı bilgilerini ayrı çek (Join hatasını önlemek için)
                    const userIds = parts.map(p => p.user_id)
                    const { data: usersData } = await supabase
                        .from('users')
                        .select('id, display_name')
                        .in('id', userIds)

                    const userMap = new Map(usersData?.map(u => [u.id, u.display_name]) || [])

                    const formatted = parts.map((p: any) => ({
                        id: p.id,
                        user_id: p.user_id,
                        status: p.status,
                        score: p.score,
                        current_word_index: p.current_word_index,
                        display_name: userMap.get(p.user_id) || 'Bilinmeyen Oyuncu'
                    }))

                    setParticipants(formatted)
                }
            } catch (e) {
                console.error('Veri çekme hatası:', e)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        fetchRoomData()

        // REALTIME SUBSCRIPTION
        const channel = supabase
            .channel(`room_${code}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'room_participants',
                filter: `room_id=eq.${room?.id}` // room.id başta null olduğu için burada çalışmayabilir, aşağıda tekrar fetch içinde manage edilebilir.
            }, () => {
                // Basitlik için her değişiklikte yeniden fetch yapalım
                // (İleride optimize edilebilir)
                fetchRoomData()
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'rooms',
                filter: `code=eq.${code}`
            }, (payload) => {
                if (payload.new.status === 'playing') {
                    // Oyun başladı!
                    console.log('Oyun başladı!')
                    setRoom(payload.new)
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [code, user, router]) // room dependency removed to avoid loop

    const startGame = async () => {
        if (!room) return

        try {
            const { error } = await supabase.rpc('start_room_game', {
                p_room_id: room.id,
                p_word_count: 5,
                p_word_length: 5
            })

            if (error) throw error
        } catch (e) {
            console.error('Başlatma hatası:', e)
            alert('Oyun başlatılamadı')
        }
    }

    const copyCode = () => {
        navigator.clipboard.writeText(room.code)
        alert('Oda kodu kopyalandı!')
    }

    if (loading) return <div className="text-center p-10 text-white">Yükleniyor...</div>

    // Oyun Durumu
    const [gameWords, setGameWords] = useState<string[]>([])
    const [fetchingGame, setFetchingGame] = useState(false)

    // Oyun başladığında kelimeleri çek
    useEffect(() => {
        if (room?.status === 'playing' && gameWords.length === 0 && !fetchingGame) {
            const fetchGame = async () => {
                setFetchingGame(true)
                const { data } = await supabase
                    .from('room_games')
                    .select('words')
                    .eq('room_id', room.id)
                    .single()

                if (data?.words) {
                    // JSONB array, string array'e cast edilmeli
                    const wordsArray = Array.isArray(data.words) ? data.words : JSON.parse(data.words as string)
                    setGameWords(wordsArray)
                }
                setFetchingGame(false)
            }
            fetchGame()
        }
    }, [room?.status, room?.id])

    // İlerleme Güncelleme
    const handleProgress = async (wordIndex: number, isFinished: boolean) => {
        if (!user || !room) return

        // DB güncelle
        await supabase
            .from('room_participants')
            .update({
                current_word_index: wordIndex,
                status: isFinished ? 'finished' : 'playing'
            })
            .eq('room_id', room.id)
            .eq('user_id', user.id)

        if (isFinished) {
            // Konfeti patlatılabilir :)
            alert('Tebrikler bitirdiniz!')
        }
    }

    if (loading || fetchingGame) return <div className="text-center p-10 text-white font-mono animate-pulse">Yükleniyor...</div>

    // --- GAME ARENA MODU ---
    if (room?.status === 'playing' && gameWords.length > 0) {
        return (
            <div className="min-h-screen bg-dark-50 text-white flex flex-col md:flex-row">
                {/* SOL: OYUN ALANI */}
                <div className="flex-1 p-4 border-r border-white/5 bg-gradient-to-b from-dark-50 to-black/30">
                    <ArenaBoard
                        targetWords={gameWords}
                        onProgress={handleProgress}
                    />
                </div>

                {/* SAĞ: CANLI SKOR TABLOSU */}
                <div className="w-full md:w-80 p-6 bg-dark-100 border-l border-white/5 overflow-y-auto">
                    <h3 className="text-xl font-bold mb-6 text-warning-400 flex items-center gap-2">
                        <span>🏁</span> YARIŞ DURUMU
                    </h3>

                    <div className="space-y-4">
                        {participants
                            .sort((a, b) => (b.score || 0) - (a.score || 0)) // Basit sıralama
                            .map((p) => {
                                // Realtime ile güncellenen 'participants' state'inden verileri alıyoruz
                                // Ancak 'current_word_index' henüz participants state'inde yok, onu eklememiz lazım
                                // Şimdilik status üzerinden gidelim, bir sonraki adımda state'i düzelteceğiz
                                const isFinished = p.status === 'finished'
                                const isSelf = p.user_id === user?.id

                                return (
                                    <div key={p.id} className={`p-4 rounded-xl border transition-all ${isFinished ? 'bg-success-500/10 border-success-500/50' :
                                        isSelf ? 'bg-primary-500/10 border-primary-500/30' : 'bg-dark-200 border-white/5'
                                        }`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`font-bold ${isSelf ? 'text-primary-400' : 'text-white'}`}>
                                                {p.display_name}
                                            </span>
                                            {isFinished && <span className="text-xl">🏆</span>}
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full bg-dark-300 rounded-full h-2 mb-1 overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${isFinished ? 'bg-success-500' : 'bg-warning-500'}`}
                                                style={{ width: isFinished ? '100%' : `${((p.current_word_index || 0) / (gameWords.length || 5)) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-xs text-right text-dark-400">
                                            {isFinished ? 'Bitirdi' : `${p.current_word_index || 0} / ${gameWords.length || 5}`}
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </div>
            </div>
        )
    }

    // --- LOBBY MODU ---

    return (
        <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-50 p-4">
            <div className="max-w-4xl mx-auto pt-10">
                <div className="flex justify-between items-center mb-8">
                    <Link href="/rooms" className="text-dark-400 hover:text-white transition-colors">
                        ← Odadan Çık
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="bg-dark-200 px-4 py-2 rounded-lg border border-white/5">
                            <span className="text-dark-400 text-sm mr-2">ODA KODU:</span>
                            <span className="font-mono font-bold text-xl tracking-widest text-primary-500">{room.code}</span>
                        </div>
                        <button onClick={copyCode} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            📋
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* KATILIMCILAR */}
                    <div className="md:col-span-2 space-y-4">
                        <h2 className="text-2xl font-bold text-white mb-4">Katılımcılar ({participants.length})</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {participants.map((p) => (
                                <div key={p.id} className="glass-effect p-4 rounded-xl flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center font-bold text-white">
                                        {p.display_name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white">{p.display_name}</div>
                                        <div className="text-xs text-primary-400">
                                            {p.status === 'ready' ? 'Hazır' : 'Bekliyor'}
                                            {p.user_id === room.host_id && ' (Kurucu)'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AYARLAR VE BAŞLAT */}
                    <div className="glass-effect p-6 rounded-2xl h-fit">
                        <h3 className="text-xl font-semibold text-white mb-6">Oda Ayarları</h3>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between text-dark-300">
                                <span>Kelime Sayısı</span>
                                <span className="text-white">5</span>
                            </div>
                            <div className="flex justify-between text-dark-300">
                                <span>Harf Sayısı</span>
                                <span className="text-white">5</span>
                            </div>
                            <div className="flex justify-between text-dark-300">
                                <span>Mod</span>
                                <span className="text-white">Kelime Yarışı</span>
                            </div>
                        </div>

                        {isHost ? (
                            <button
                                onClick={startGame}
                                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-success-500 to-emerald-600 text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-success-500/20"
                            >
                                Oyunu Başlat 🚀
                            </button>
                        ) : (
                            <div className="text-center p-4 bg-white/5 rounded-xl animate-pulse">
                                <p className="text-dark-300">Kurucunun başlatması bekleniyor...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
