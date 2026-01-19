'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setMessage('')
        setLoading(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            })

            if (error) throw error

            setMessage('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.')
        } catch (err: any) {
            setError(err.message || 'Bir hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold gradient-text mb-2">Şifre Sıfırlama</h1>
                    <p className="text-white/70">Hesabına tekrar erişim sağla</p>
                </div>

                <div className="glass-effect rounded-3xl p-8 shadow-2xl">
                    <form onSubmit={handleReset} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-white/70">Email Adresin</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 outline-none text-white transition-all"
                                placeholder="ornek@email.com"
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
                            {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link href="/auth-new/login" className="text-white/60 hover:text-white transition-colors text-sm">
                            ← Giriş sayfasına dön
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
