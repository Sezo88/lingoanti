'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ArenaBoard from '@/components/ArenaBoard'
import TurnBasedBoard from '@/components/TurnBasedBoard'

interface Participant {
    id: string
    user_id: string
    status: string
    score: number
    display_name: string
    current_word_index?: number
}

export default function RoomLobbyPage() {
    const { code } = useParams()
    const { user } = useAuth()
    const router = useRouter()

    const [room, setRoom] = useState<any>(null)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [loading, setLoading] = useState(true)
    const [isHost, setIsHost] = useState(false)

    // Oyun Durumu (Hooklar en üstte)
    const [gameWords, setGameWords] = useState<string[]>([])
    const [fetchingGame, setFetchingGame] = useState(false)

    // Oyun başladığında kelimeleri çek
    useEffect(() => {
        if (room?.status === 'playing' && gameWords.length === 0 && !fetchingGame) {
            // Kelimeler artık rooms.game_words kolonunda
            if (room.game_words && Array.isArray(room.game_words)) {
                setGameWords(room.game_words)
            }
        }
    }, [room?.status, room?.game_words, gameWords.length, fetchingGame])

    // Veri çekme fonksiyonu
    const fetchRoomData = async () => {
        if (!user) return

        try {
            // 1. Odayı bul
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', code)
                .single()

            if (roomError || !roomData) {
                console.error('Oda bulunamadı:', roomError)
                router.push('/rooms')
                return
            }

            setRoom(roomData)
            setIsHost(roomData.host_id === user.id)

            // 2. Katılımcıları bul
            const { data: parts, error: partsError } = await supabase
                .from('room_participants')
                .select('id, user_id, status, score, current_word_index')
                .eq('room_id', roomData.id)

            if (partsError) throw partsError

            if (parts) {
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
            setLoading(false)
        }
    }

    // İlk yükleme
    useEffect(() => {
        if (!code || !user) return
        fetchRoomData()
    }, [code, user])

    // REALTIME ABONELİĞİ (Sadece room.id gelince başlar)
    useEffect(() => {
        if (!room?.id) return

        console.log('Realtime aboneliği başlatılıyor, Room ID:', room.id)

        const channel = supabase
            .channel(`room_${room.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'room_participants',
                filter: `room_id=eq.${room.id}`
            }, () => {
                console.log('Değişiklik algılandı, veriler güncelleniyor...')
                fetchRoomData()
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'rooms',
                filter: `id=eq.${room.id}`
            }, (payload) => {
                if (payload.new.status === 'playing') {
                    console.log('Oyun başladı!')
                    setRoom(payload.new)
                }
            })
            .subscribe((status) => {
                console.log('Abonelik durumu:', status)
            })

        return () => {
            console.log('Abonelik sonlandırılıyor')
            supabase.removeChannel(channel)
        }
    }, [room?.id]) // Sadece ID değişince çalışır

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

    // İlerleme Güncelleme
    const handleProgress = async (wordIndex: number, isFinished: boolean) => {
        if (!user || !room) return

        await supabase
            .from('room_participants')
            .update({
                current_word_index: wordIndex,
                status: isFinished ? 'finished' : 'playing'
            })
            .eq('room_id', room.id)
            .eq('user_id', user.id)

        if (isFinished) {
            alert('Tebrikler bitirdiniz!')
        }
    }

    // Puan Kaydetme
    const handleWordCompleted = async (wordIndex: number, timeSeconds: number, score: number) => {
        if (!user || !room) return

        const currentParticipant = participants.find(p => p.user_id === user.id)
        const currentScore = currentParticipant?.score || 0
        // @ts-ignore - word_times tipi tanımlı değilse
        const currentWordTimes = currentParticipant?.word_times || []

        await supabase
            .from('room_participants')
            .update({
                score: currentScore + score,
                word_times: [...currentWordTimes, { wordIndex, timeSeconds, score }]
            })
            .eq('room_id', room.id)
            .eq('user_id', user.id)
    }

    if (loading || fetchingGame) return <div className="text-center p-10 text-white font-mono animate-pulse">Yükleniyor...</div>

    // --- GAME ARENA MODU (Kelime Yarışı) ---
    if (room?.status === 'playing' && room?.game_mode === 'arena' && gameWords.length > 0) {
        return (
            <div className="min-h-screen text-white flex flex-col md:flex-row">
                <div className="flex-1 p-4 border-r border-white/5 bg-black/30">
                    <ArenaBoard
                        targetWords={gameWords}
                        onProgress={handleProgress}
                        onWordCompleted={handleWordCompleted}
                    />
                </div>

                <div className="w-full md:w-80 p-6 bg-dark-100 border-l border-white/5 overflow-y-auto">
                    <h3 className="text-xl font-bold mb-6 text-warning-400 flex items-center gap-2">
                        <span>🏁</span> YARIŞ DURUMU
                    </h3>

                    <div className="space-y-4">
                        {participants
                            .sort((a, b) => (b.score || 0) - (a.score || 0))
                            .map((p) => {
                                const isFinished = p.status === 'finished'
                                const isSelf = p.user_id === user?.id

                                return (
                                    <div key={p.id} className={`p-4 rounded-xl border transition-all ${isFinished ? 'bg-success-500/10 border-success-500/50' :
                                        isSelf ? 'bg-primary-500/10 border-primary-500/30' : 'bg-dark-200 border-white/5'
                                        }`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex flex-col">
                                                <span className={`font-bold ${isSelf ? 'text-primary-400' : 'text-white'}`}>
                                                    {p.display_name}
                                                </span>
                                                <span className="text-xs text-yellow-500 font-bold">
                                                    {p.score || 0} Puan
                                                </span>
                                            </div>
                                            {isFinished && <span className="text-xl">🏆</span>}
                                        </div>

                                        <div className="w-full bg-dark-300 rounded-full h-2 mb-1 overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${isFinished ? 'bg-success-500' : 'bg-warning-500'}`}
                                                style={{ width: isFinished ? '100%' : `${((p.current_word_index || 0) / (gameWords.length || 5)) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-xs text-right text-white/80">
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

    // --- GAME TURN-BASED MODU (Sıra Sende) ---
    if (room?.status === 'playing' && room?.game_mode === 'turn_based' && gameWords.length > 0) {
        const config = room.config || {}
        const gameState = room.game_state || { guesses: [], results: [], currentWordIndex: 0 }
        const turnOrder = config.turnOrder || []
        const currentTurn = config.currentTurn || 0

        const currentPlayerId = turnOrder[currentTurn % turnOrder.length]
        const isMyTurn = currentPlayerId === user?.id
        const currentPlayer = participants.find(p => p.user_id === currentPlayerId)
        const currentWordIndex = gameState.currentWordIndex || 0
        const currentWord = gameWords[currentWordIndex] || ''

        // Ortak tahta state'i
        const sharedGuesses = gameState.guesses || []
        const sharedResults = gameState.results || []

        // Tahmin yapıldığında
        const handleGuessSubmit = async (guess: string, result: any[]) => {
            if (!room || !isMyTurn) {
                console.log('Tahmin reddedildi:', { room: !!room, isMyTurn })
                return
            }

            console.log('Tahmin gönderiliyor:', { guess, result })

            const newGuesses = [...sharedGuesses, guess]
            const newResults = [...sharedResults, result]

            // Doğru mu kontrol et
            const isCorrect = result.every((r: any) => r.status === 'correct')

            try {
                if (isCorrect) {
                    // Doğru buldu - Puan ver ve yeni kelimeye geç
                    const attemptCount = newGuesses.length
                    const baseScore = 100
                    const attemptBonus = Math.max(0, (6 - attemptCount) * 10)
                    const wordScore = baseScore + attemptBonus

                    const currentParticipant = participants.find(p => p.user_id === user?.id)

                    await supabase
                        .from('room_participants')
                        .update({
                            score: (currentParticipant?.score || 0) + wordScore
                        })
                        .eq('room_id', room.id)
                        .eq('user_id', user!.id)

                    // Yeni kelimeye geç
                    const nextWordIndex = currentWordIndex + 1
                    const nextRound = Math.floor(nextWordIndex / 1)

                    const { error } = await supabase
                        .from('rooms')
                        .update({
                            game_state: {
                                guesses: [],
                                results: [],
                                currentWordIndex: nextWordIndex
                            },
                            config: {
                                ...config,
                                currentTurn: nextWordIndex,
                                currentRound: nextRound
                            }
                        })
                        .eq('id', room.id)

                    if (error) {
                        console.error('Kelime geçiş hatası:', error)
                    } else {
                        console.log('Yeni kelimeye geçildi')
                    }
                } else {
                    // Yanlış - Sadece sırayı değiştir
                    const { error } = await supabase
                        .from('rooms')
                        .update({
                            game_state: {
                                guesses: newGuesses,
                                results: newResults,
                                currentWordIndex
                            },
                            config: {
                                ...config,
                                currentTurn: currentTurn + 1
                            }
                        })
                        .eq('id', room.id)

                    if (error) {
                        console.error('Sıra değiştirme hatası:', error)
                    } else {
                        console.log('Sıra değiştirildi, yeni turn:', currentTurn + 1)
                    }
                }
            } catch (e) {
                console.error('Tahmin gönderme hatası:', e)
            }
        }

        return (
            <div className="min-h-screen text-white flex flex-col md:flex-row">
                <div className="flex-1 p-4 border-r border-white/5 bg-black/30">
                    <TurnBasedBoard
                        targetWord={currentWord}
                        isMyTurn={isMyTurn}
                        currentPlayerName={currentPlayer?.display_name || 'Oyuncu'}
                        sharedGuesses={sharedGuesses}
                        sharedResults={sharedResults}
                        onGuessSubmit={handleGuessSubmit}
                    />
                </div>

                <div className="w-full md:w-80 p-6 bg-dark-100 border-l border-white/5 overflow-y-auto">
                    <h3 className="text-xl font-bold mb-6 text-primary-400 flex items-center gap-2">
                        <span>🎯</span> SIRA DURUMU
                    </h3>

                    <div className="mb-6 p-4 bg-black/20 rounded-xl border border-white/10">
                        <div className="text-sm text-white/70 mb-1">Şu Anki Sıra:</div>
                        <div className="text-xl font-bold text-white">{currentPlayer?.display_name}</div>
                        <div className="text-xs text-white/50 mt-2">Kelime {currentWordIndex + 1} / {gameWords.length}</div>
                        <div className="text-xs text-white/50">Deneme: {sharedGuesses.length + 1}</div>
                    </div>

                    <div className="space-y-3">
                        {participants
                            .sort((a, b) => (b.score || 0) - (a.score || 0))
                            .map((p) => {
                                const isCurrent = p.user_id === currentPlayerId
                                const isSelf = p.user_id === user?.id

                                return (
                                    <div key={p.id} className={`p-3 rounded-xl border transition-all ${isCurrent ? 'bg-primary-500/20 border-primary-500/50 shadow-lg' :
                                        isSelf ? 'bg-white/5 border-white/10' : 'bg-dark-200 border-white/5'
                                        }`}>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                {isCurrent && <span className="text-lg">▶️</span>}
                                                <span className={`font-semibold ${isSelf ? 'text-primary-400' : 'text-white'}`}>
                                                    {p.display_name}
                                                </span>
                                            </div>
                                            <span className="text-sm text-yellow-500 font-bold">
                                                {p.score || 0}P
                                            </span>
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
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto pt-10">
                <div className="flex justify-between items-center mb-8">
                    <Link href="/rooms" className="text-dark-400 hover:text-white transition-colors">
                        ← Odadan Çık
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="bg-dark-200 px-4 py-2 rounded-lg border border-white/5">
                            <span className="text-dark-400 text-sm mr-2">ODA KODU:</span>
                            <span className="font-mono font-bold text-xl tracking-widest text-primary-500">{room?.code}</span>
                        </div>
                        <button onClick={copyCode} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            📋
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                                            {p.user_id === room?.host_id && ' (Kurucu)'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

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
