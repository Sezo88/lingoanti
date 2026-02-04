'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import SettingsToggle from '@/components/SettingsToggle'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
    const router = useRouter()
    const { user, signOut } = useAuth()
    const {
        soundEnabled,
        musicEnabled,
        vibrationEnabled,
        notificationsEnabled,
        toggleSound,
        toggleMusic,
        toggleVibration,
        toggleNotifications,
    } = useSettings()

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        if (!user) return

        async function checkRole() {
            const { data } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single()

            if (data?.role === 'super_admin' || data?.role === 'admin') {
                setIsAdmin(true)
            }
        }

        checkRole()
    }, [user])

    const handleLogout = async () => {
        await signOut()
        router.push('/auth/login')
    }

    const handleDeleteAccount = async () => {
        // TODO: Implement account deletion
        alert('Hesap silme özelliği yakında eklenecek')
        setShowDeleteConfirm(false)
    }

    return (
        <div className="min-h-screen bg-dark-50 flex flex-col">
            {/* Header */}
            <header className="glass-effect border-b border-dark-200 sticky top-0 z-40">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="text-white/70 hover:text-white transition-colors"
                    >
                        ← Geri
                    </button>
                    <h1 className="text-xl font-bold gradient-text">Ayarlar</h1>
                    <div className="w-16" /> {/* Spacer for centering */}
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto p-4 pb-20">
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* Profile Section */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6 rounded-2xl"
                    >
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span>👤</span>
                            Profil Bilgileri
                        </h2>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-dark-200/50 rounded-lg">
                                <span className="text-white/60 text-sm">Kullanıcı Adı</span>
                                <span className="text-white font-semibold">{user?.user_metadata?.display_name || 'Anonim'}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-dark-200/50 rounded-lg">
                                <span className="text-white/60 text-sm">Email</span>
                                <span className="text-white font-semibold text-sm">{user?.email || 'N/A'}</span>
                            </div>
                        </div>
                    </motion.section>

                    {/* Game Settings */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-6 rounded-2xl"
                    >
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span>🎮</span>
                            Oyun Ayarları
                        </h2>
                        <div className="space-y-3">
                            <SettingsToggle
                                label="Ses Efektleri"
                                description="Oyun içi ses efektlerini aç/kapat"
                                icon="🔊"
                                enabled={soundEnabled}
                                onToggle={toggleSound}
                            />
                            <SettingsToggle
                                label="Müzik"
                                description="Arka plan müziğini aç/kapat"
                                icon="🎵"
                                enabled={musicEnabled}
                                onToggle={toggleMusic}
                            />
                            <SettingsToggle
                                label="Titreşim"
                                description="Dokunmatik geri bildirimi aç/kapat"
                                icon="📳"
                                enabled={vibrationEnabled}
                                onToggle={toggleVibration}
                            />
                            <SettingsToggle
                                label="Bildirimler"
                                description="Push bildirimleri aç/kapat"
                                icon="🔔"
                                enabled={notificationsEnabled}
                                onToggle={toggleNotifications}
                            />
                        </div>
                    </motion.section>

                    {/* Account Actions */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-6 rounded-2xl"
                    >
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span>⚙️</span>
                            Hesap İşlemleri
                        </h2>
                        <div className="space-y-3">
                            <button
                                onClick={handleLogout}
                                className="w-full p-4 bg-dark-200/50 hover:bg-dark-300 rounded-xl border border-white/10 hover:border-primary-500/50 transition-all text-white font-semibold flex items-center justify-center gap-2"
                            >
                                <span>🚪</span>
                                Çıkış Yap
                            </button>

                            {isAdmin && (
                                <button
                                    onClick={() => router.push('/admin')}
                                    className="w-full p-4 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl border border-purple-500/50 hover:border-purple-500 transition-all text-purple-200 hover:text-white font-bold flex items-center justify-center gap-2"
                                >
                                    <span>👑</span>
                                    Süper Admin Paneli
                                </button>
                            )}

                            {!showDeleteConfirm ? (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="w-full p-4 bg-dark-200/50 hover:bg-danger-500/20 rounded-xl border border-white/10 hover:border-danger-500/50 transition-all text-white/70 hover:text-danger-400 font-semibold flex items-center justify-center gap-2"
                                >
                                    <span>🗑️</span>
                                    Hesabı Sil
                                </button>
                            ) : (
                                <div className="p-4 bg-danger-500/10 rounded-xl border border-danger-500/30">
                                    <p className="text-danger-400 text-sm mb-3 text-center">
                                        Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowDeleteConfirm(false)}
                                            className="flex-1 py-2 bg-dark-300 hover:bg-dark-400 rounded-lg text-white text-sm font-semibold transition-colors"
                                        >
                                            İptal
                                        </button>
                                        <button
                                            onClick={handleDeleteAccount}
                                            className="flex-1 py-2 bg-danger-500 hover:bg-danger-600 rounded-lg text-white text-sm font-semibold transition-colors"
                                        >
                                            Evet, Sil
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.section>

                    {/* App Info */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card p-6 rounded-2xl"
                    >
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span>ℹ️</span>
                            Uygulama Bilgileri
                        </h2>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-dark-200/50 rounded-lg">
                                <span className="text-white/60 text-sm">Versiyon</span>
                                <span className="text-white font-semibold">1.0.0</span>
                            </div>
                            <a
                                href="/privacy"
                                className="block p-3 bg-dark-200/50 hover:bg-dark-300 rounded-lg text-white/70 hover:text-white transition-colors text-sm"
                            >
                                Gizlilik Politikası →
                            </a>
                            <a
                                href="/terms"
                                className="block p-3 bg-dark-200/50 hover:bg-dark-300 rounded-lg text-white/70 hover:text-white transition-colors text-sm"
                            >
                                Kullanım Koşulları →
                            </a>
                        </div>
                    </motion.section>
                </div>
            </main>
        </div>
    )
}
