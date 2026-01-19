'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import ArenaBoard from '@/components/ArenaBoard'
import TurnBasedBoard from '@/components/TurnBasedBoard'
import GameResultScreen from '@/components/GameResultScreen'
import { motion } from 'framer-motion'
import { ArrowLeft, Users, Clock, Trophy, Hash } from 'lucide-react'

// ... existing code ...

export default function RoomPage() {
    console.log('📄 SAYFA: /rooms/[code] - RoomPage AÇILDI')
    const { code } = useParams()
    const router = useRouter()
    const { user } = useAuth()
    const [room, setRoom] = useState<any>(null)
    const [participants, setParticipants] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [gameWords, setGameWords] = useState<string[]>([])

    // Kazanma efekti için state (Top Level)
    const [showWinFeedback, setShowWinFeedback] = useState<any>(null)

    // BİLDİRİM İZNİ İSTE
    useEffect(() => {
        if (Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [])

    // İlk yükleme
    useEffect(() => {
        if (!code || !user) return
        fetchRoomData()
    }, [code, user])

    // Participants Ref to access state inside Realtime callback
    const participantsRef = useRef(participants)

    useEffect(() => {
        participantsRef.current = participants
    }, [participants])

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
            }, (payload) => {
                console.log('Değişiklik algılandı (Realtime):', payload)

                // LEAVE ALERT Logic
                if (payload.eventType === 'UPDATE' && payload.new.status === 'left' && payload.old.status !== 'left') {
                    const leaverId = payload.new.user_id
                    // Ref kullanarak güncel listeyi al
                    const currentParticipants = participantsRef.current
                    const leaverName = currentParticipants.find(p => p.user_id === leaverId)?.display_name || 'Bilinmeyen Oyuncu'

                    console.log('Ayrılan bulundu:', leaverName, leaverId)

                    // Custom Toast
                    const toast = document.createElement('div')
                    toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl z-50 font-bold animate-bounce flex items-center gap-2'
                    toast.innerHTML = `<span>👋</span> <span><strong>${leaverName}</strong> oyundan ayrıldı!</span>`
                    document.body.appendChild(toast)
                    setTimeout(() => toast.remove(), 4000)
                }

                fetchRoomData()
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'rooms',
                filter: `id=eq.${room.id}`
            }, (payload) => {
                console.log('Oda güncellendi (DB), veriler yenileniyor...')
                fetchRoomData()
            })
            .subscribe((status) => {
                console.log('Abonelik durumu:', status)
            })

        return () => {
            console.log('Abonelik sonlandırılıyor')
            supabase.removeChannel(channel)
        }
    }, [room?.id]) // Sadece ID değişince çalışır

    // Win Feedback Effect (Top Level)
    useEffect(() => {
        if (!room?.game_state?.lastWin) return

        const lastWin = room.game_state.lastWin
        if (lastWin.timestamp > (Date.now() - 5000)) {
            const winner = participants.find(p => p.user_id === lastWin.userId)
            if (winner) {
                setShowWinFeedback({
                    winnerName: winner.display_name,
                    word: lastWin.word,
                    score: lastWin.score,
                    isMe: lastWin.userId === user?.id
                })

                const timer = setTimeout(() => setShowWinFeedback(null), 3000)
                return () => clearTimeout(timer)
            }
        }
    }, [room?.game_state?.lastWin, participants, user?.id])

    const fetchRoomData = async () => {
        if (!code) return

        try {
            // Odayı bul
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', code)
                .single()

            if (roomError) throw roomError

            // Eğer game_mode undefined ise varsayılan 'arena' yap (Eski odalar için)
            if (!roomData.game_mode) roomData.game_mode = 'arena'

            setRoom(roomData)

            // Katılımcıları bul
            const { data: participantsData, error: participantsError } = await supabase
                .from('room_participants')
                .select(`
                    *,
                    users (
                        username,
                        avatar_url
                    )
                `)
                .eq('room_id', roomData.id)

            if (participantsError) throw participantsError

            // User bilgilerini düzelt
            const formattedParticipants = participantsData.map(p => ({
                ...p,
                display_name: p.users?.username || 'Anonim'
            }))

            setParticipants(formattedParticipants)

            // Kelimeleri hazırla
            if (roomData.game_words) {
                setGameWords(roomData.game_words)
            } else if (roomData.status === 'playing') {
                // Eğer oyun başlamış ama kelimeler yoksa (eski veri), yeniden çekmeyi dene
                // ...
            }

            setLoading(false)
        } catch (error) {
            console.error('Veri çekme hatası:', error)
            setLoading(false)
        }
    }

    const startGame = async () => {
        if (!room) return

        try {
            const { error } = await supabase.rpc('start_room_game', {
                p_room_id: room.id,
                p_word_count: 5,
                p_word_length: room.config?.wordLength || 5
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

    // SIRA BANA GELDİ BİLDİRİMİ (Top Level)
    const currentPlayerId = room?.config?.currentPlayer || room?.config?.turnOrder?.[room?.config?.currentTurn % room?.config?.turnOrder?.length]
    const currentPlayer = participants.find(p => p.user_id === currentPlayerId)

    // Check if this is turn-based mode (either direct or tournament with turn_based config)
    const isTurnBasedMode = room?.game_mode === 'turn_based' || (room?.game_mode === 'tournament' && room?.config?.gameMode === 'turn_based')
    const isMyTurn = user?.id && currentPlayerId === user.id && room?.status === 'playing' && isTurnBasedMode

    useEffect(() => {
        if (isMyTurn && document.hidden && Notification.permission === 'granted') {
            new Notification('Sıra Sende! 🎯', {
                body: 'Lingo Master: Hamle yapma sırası sana geldi.',
                icon: '/favicon.ico'
            })
        }
    }, [isMyTurn])

    // İlerleme Güncelleme
    const handleProgress = async (wordIndex: number, isFinished: boolean) => {
        if (!user || !room) return

        await supabase
            .from('room_participants')
            .update({
                current_word_index: wordIndex,
                status: isFinished ? 'finished' : 'playing',
                finished_at: isFinished ? new Date().toISOString() : null
            })
            .eq('room_id', room.id)
            .eq('user_id', user.id)
    }

    const handleWordCompleted = async (wordIndex: number, timeSeconds: number, score: number) => {
        if (!user || !room) return

        // Mevcut skoru bul
        const currentParticipant = participants.find(p => p.user_id === user.id)
        const currentScore = currentParticipant?.score || 0
        const newScore = currentScore + score

        await supabase
            .from('room_participants')
            .update({
                score: newScore,
                words_completed: wordIndex + 1
            })
            .eq('room_id', room.id)
            .eq('user_id', user.id)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-dark-100 text-white flex items-center justify-center">
                <div className="text-2xl font-bold animate-pulse">Yükleniyor...</div>
            </div>
        )
    }

    // --- LOBİ MODU ---
    if (room?.status === 'waiting') {
        const isHost = room.host_id === user?.id

        return (
            <div className="min-h-screen bg-dark-100 text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-white/10 relative overflow-hidden">
                    {/* Arkaplan Efekti */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary-500/20 via-transparent to-transparent animate-spin-slow"></div>
                    </div>

                    <div className="relative z-10">
                        <button
                            onClick={() => router.push('/rooms')}
                            className="absolute top-0 left-0 p-2 text-white/50 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </button>

                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold mb-2 break-all">{room.code}</h1>
                            <p className="text-white/50 text-sm">Oda Kodu</p>
                            <button
                                onClick={copyCode}
                                className="mt-3 px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs font-medium transition-colors border border-white/10"
                            >
                                Kodu Kopyala
                            </button>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3 text-white/80">
                                    <Users size={18} />
                                    <span>Oyuncular</span>
                                </div>
                                <span className="font-bold">{participants.length}</span>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3 text-white/80">
                                    <Clock size={18} />
                                    <span>Süre</span>
                                </div>
                                <span className="font-bold">{room.config?.duration || 60}sn</span>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3 text-white/80">
                                    <Trophy size={18} />
                                    <span>Mod</span>
                                </div>
                                <span className="font-bold text-primary-400">
                                    {room.game_mode === 'turn_based' ? 'Sıra Sende' : 'Kelime Yarışı'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-2">Bekleyenler</h3>
                            {participants.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-xs font-bold">
                                        {p.display_name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="font-medium">{p.display_name}</span>
                                    {p.user_id === room.host_id && (
                                        <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20">
                                            KURUCU
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {isHost ? (
                            <button
                                onClick={startGame}
                                disabled={participants.length < 1} // Test için 1 kişiye düşürdüm
                                className="w-full mt-8 py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Oyunu Başlat
                            </button>
                        ) : (
                            <div className="mt-8 text-center p-4 bg-white/5 rounded-xl animate-pulse">
                                <p className="text-white/70 font-medium">Kurucunun başlatması bekleniyor...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // TURN-BASED MODE (Sıra Sende) - Also includes tournament with turn_based config
    if (room?.status === 'playing' && isTurnBasedMode && gameWords.length > 0) {
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
        const lastWin = gameState.lastWin || null

        // Hooks moved to top level

        const handleLeaveRoom = async () => {
            if (!user) return

            if (confirm('Odadan ayrılmak istiyor musunuz? Sıranız atlanacak.')) {
                try {
                    const { error } = await supabase.rpc('leave_room', {
                        p_room_id: room.id
                    })

                    if (error) throw error

                    router.push('/rooms')
                } catch (e) {
                    console.error('Ayrılma hatası:', e)
                    alert('Odadan ayrılırken hata oluştu')
                }
            }
        }

        const handleTimeout = async () => {
            if (!room || !user || !isMyTurn) return

            console.log('Süre doldu! Timeout işlemi başlatılıyor...')

            try {
                await supabase.rpc('handle_turn_timeout', {
                    p_room_id: room.id,
                    p_user_id: user.id
                })
            } catch (e) {
                console.error('Timeout hatası:', e)
            }
        }

        // Tahmin yapıldığında
        const handleGuessSubmit = async (guess: string, result: any[]) => {
            if (!room || !isMyTurn || !user) {
                console.log('Tahmin reddedildi:', { room: !!room, isMyTurn, user: !!user })
                return
            }

            console.log('Tahmin gönderiliyor (RPC):', { guess, result })

            // Doğru mu kontrol et
            const isCorrect = result.every((r: any) => r.status === 'correct')

            console.log('--- HAMLE KONTROLÜ ---')
            console.log('Hedef Kelime:', currentWord)
            console.log('Tahmin:', guess)
            console.log('Sonuç:', result)
            console.log('Doğru mu:', isCorrect)
            console.log('----------------------')

            try {
                // RPC fonksiyonunu çağır (Güvenli ve Atomic)
                const { error } = await supabase.rpc('submit_turn_guess', {
                    p_room_id: room.id,
                    p_user_id: user.id,
                    p_guess: guess,
                    p_result: result,
                    p_is_correct: isCorrect
                })

                if (error) {
                    console.error('RPC Hatası:', error)
                    alert('Hata: ' + error.message)
                } else {
                    console.log('Tahmin başarıyla işlendi, veriler tazeleniyor...')
                    // Realtime'ı beklemeden veriyi kendimiz çekiyoruz (UX için)
                    await fetchRoomData()
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
                        winFeedback={showWinFeedback}
                        participants={participants}
                        duration={room.config?.duration || 60}
                        turnStartTime={room.config?.turnStartTime}
                        onLeave={handleLeaveRoom}
                        onTimeout={handleTimeout}
                    />
                </div>

                <div className="w-full md:w-80 p-6 bg-dark-100 border-l border-white/5 flex flex-col">
                    <h3 className="text-xl font-bold mb-6 text-primary-400 flex items-center gap-2 flex-shrink-0">
                        <span>🎯</span> SIRA DURUMU
                    </h3>

                    <div className="mb-6 p-4 bg-black/20 rounded-xl border border-white/10 flex-shrink-0">
                        <div className="text-sm text-white/70 mb-1">Şu Anki Sıra:</div>
                        <div className="text-xl font-bold text-white">{currentPlayer?.display_name}</div>
                        <div className="text-xs text-white/50 mt-2">Kelime {currentWordIndex + 1} / {gameWords.length}</div>
                        <div className="text-xs text-white/50">Deneme: {sharedGuesses.length + 1}</div>
                    </div>

                    {/* Scrollable participants list */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
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

    // --- GAME ARENA MODU (Kelime Yarışı) ---
    if (room?.status === 'playing' && gameWords.length > 0) {
        const handleLeaveRoom = async () => {
            if (!user) return

            if (confirm('Odadan ayrılmak istiyor musunuz?')) {
                await supabase
                    .from('room_participants')
                    .delete()
                    .eq('room_id', room.id)
                    .eq('user_id', user.id)

                router.push('/')
            }
        }

        return (
            <div className="min-h-screen bg-dark-100 flex flex-col md:flex-row">
                {/* Sol Panel - Oyun Alanı */}
                <div className="flex-1 relative">
                    {/* Leave Button */}
                    <button
                        onClick={handleLeaveRoom}
                        className="absolute top-4 left-4 z-50 px-4 py-2 bg-danger-500/20 hover:bg-danger-500/30 text-danger-400 hover:text-danger-300 rounded-lg transition-colors backdrop-blur-sm border border-danger-500/20 font-semibold text-sm"
                    >
                        🚪 Ayrıl
                    </button>

                    <ArenaBoard
                        targetWords={gameWords}
                        duration={room.config?.duration || 60}
                        onProgress={handleProgress}
                        onWordCompleted={handleWordCompleted}
                        gameId="multiplayer"
                        participants={participants}
                        roomStatus={room?.status}
                    />
                </div>

                {/* Sağ Panel - Rakipler */}
                <div className="w-full md:w-80 bg-dark-200 border-l border-white/10 p-6 flex flex-col z-10">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white flex-shrink-0">
                        <Users size={20} className="text-primary-400" />
                        Canlı Skor
                    </h3>

                    {/* Scrollable leaderboard */}
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {participants
                            .sort((a, b) => (b.score || 0) - (a.score || 0))
                            .map((p, index) => {
                                const isSelf = p.user_id === user?.id
                                const progress = ((p.words_completed || 0) / gameWords.length) * 100

                                return (
                                    <div
                                        key={p.id}
                                        className={`p-4 rounded-xl border transition-all relative overflow-hidden ${isSelf
                                            ? 'bg-primary-500/10 border-primary-500/50 shadow-lg shadow-primary-500/10'
                                            : 'bg-black/20 border-white/5'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <div>
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    <span>#{index + 1}</span>
                                                    <span>{p.display_name}</span>
                                                    {isSelf && <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full">SEN</span>}
                                                </div>
                                                <div className="text-xs text-white/50 mt-1">
                                                    {p.status === 'finished' ? '🏁 Tamamladı' : `${p.words_completed || 0}/${gameWords.length} kelime`}
                                                </div>
                                            </div>
                                            <div className="text-xl font-black text-yellow-400">
                                                {p.score || 0}
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="h-2 bg-black/40 rounded-full overflow-hidden relative z-10">
                                            <motion.div
                                                className={`h-full ${p.status === 'finished' ? 'bg-green-500' : 'bg-primary-500'}`}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 0.5 }}
                                            />
                                        </div>

                                        {/* Arkaplan Efekti (Sadece aktif oyuncu için) */}
                                        {isSelf && (
                                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-500/5 to-transparent pointer-events-none" />
                                        )}
                                    </div>
                                )
                            })}
                    </div>
                </div>
            </div>
        )
    }

    // --- OYUN SONU EKRANI ---
    // Show if room is finished OR if all participants are finished (Client-side trigger)
    const allParticipantsFinished = participants.length > 0 && participants.every(p => p.status === 'finished')

    if (room?.status === 'finished' || (room?.status === 'playing' && room?.game_mode !== 'turn_based' && allParticipantsFinished)) {
        const lastWin = room.game_state?.lastWin || {}

        // If I am the host and status is not yet finished, update it!
        if (room?.status !== 'finished' && room.host_id === user?.id) {
            // Fire and forget update to ensure clean state for everyone eventually
            supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id).then(() => console.log('Oyun bitti olarak güncellendi'))
        }

        return (
            <GameResultScreen
                participants={participants}
                winner={participants.find(p => p.user_id === lastWin.userId) || participants.sort((a, b) => b.score - a.score)[0]}
                lastWinType={lastWin.type}
                roomCode={room.code}
            />
        )
    }

    // DEBUG: Unhandled state
    console.error('⚠️ UNHANDLED ROOM STATE:', {
        roomStatus: room?.status,
        gameMode: room?.game_mode,
        gameWordsLength: gameWords?.length,
        config: room?.config,
        participants: participants?.length
    })

    return (
        <div className="min-h-screen bg-dark-100 text-white flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-white/10">
                <h2 className="text-2xl font-bold mb-4 text-center text-red-400">Beklenmeyen Durum</h2>
                <div className="space-y-2 text-sm">
                    <p><strong>Oda Durumu:</strong> {room?.status || 'Bilinmiyor'}</p>
                    <p><strong>Oyun Modu:</strong> {room?.game_mode || 'Bilinmiyor'}</p>
                    <p><strong>Kelime Sayısı:</strong> {gameWords?.length || 0}</p>
                    <p><strong>Katılımcı:</strong> {participants?.length || 0}</p>
                </div>
                <button
                    onClick={() => router.push('/')}
                    className="w-full mt-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl font-semibold transition-colors"
                >
                    Ana Sayfaya Dön
                </button>
            </div>
        </div>
    )
}
