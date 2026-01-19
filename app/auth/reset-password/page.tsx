'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    // Şifre sıfırlama işlemi için kullanıcı oturumunun (token aracılığıyla) açılmış olması gerekir.
    // Supabase linkleri bunu otomatik yapar.

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setMessage('')
        setLoading(true)

        if (password !== confirmPassword) {
            setError('Şifreler eşleşmiyor.')
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setError('Şifre en az 6 karakter olmalı.')
            setLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            })

            if (error) throw error

            setMessage('Şifreniz başarıyla güncellendi! Anasayfaya yönlendiriliyorsunuz...')
            setTimeout(() => {
                router.push('/')
            }, 3000)
        } catch (err: any) {
            setError(err.message || 'Şifre güncellenemedi.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold gradient-text mb-2">Yeni Şifre Belirle</h1>
                    <p className="text-white/70">Hesabın için yeni bir şifre oluştur</p>
                </div>

                <div className="glass-effect rounded-3xl p-8 shadow-2xl">
                    <form onSubmit={handleUpdatePassword} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-white/70">Yeni Şifre</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 outline-none text-white transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2 text-white/70">Yeni Şifre (Tekrar)</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 outline-none text-white transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        {message && (
                            <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-xl text-sm">
                                {message}
                            </div>
                        )}

                        {error && (
                            <div className="bg-danger-500/10 border border-danger-500 text-danger-500 px-4 py-3 rounded-xl text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                        >
                            {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link href="/auth/login" className="text-primary-500 font-semibold hover:underline">
                            Giriş Yap
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
