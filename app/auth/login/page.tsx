'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) throw error
            router.push('/')
        } catch (err: any) {
            setError(err.message || 'Giriş başarısız. Bilgilerinizi kontrol edin.')
        } finally {
            setLoading(false)
        }
    }

    const handleSocialLogin = async (provider: 'google' | 'facebook') => {
        try {
            setLoading(true)
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            })
            if (error) throw error
        } catch (err: any) {
            setError(err.message || 'Sosyal giriş hatası.')
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold gradient-text mb-2">Lingo Master</h1>
                    <p className="text-white/70">Tekrar Hoşgeldin!</p>
                </div>

                <div className="glass-effect rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-semibold mb-6 text-center">Giriş Yap</h2>

                    {/* Social Login */}
                    <div className="mb-6">
                        <button
                            onClick={() => handleSocialLogin('google')}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-dark-900 font-semibold hover:bg-gray-100 transition-colors shadow-lg"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                            Google ile Giriş Yap
                        </button>
                    </div>

                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-dark-200 text-white/50">veya email ile</span>
                        </div>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-white/70">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 outline-none text-white transition-all"
                                placeholder="ornek@email.com"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-sm font-medium text-white/70">Şifre</label>
                                <Link
                                    href="/auth-new/forgot-password"
                                    className="text-xs text-primary-400 hover:text-primary-300"
                                >
                                    Şifremi Unuttum?
                                </Link>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 outline-none text-white transition-all"
                                placeholder="••••••••"
                            />
                        </div>

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
                            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-white/70">
                            Hesabın yok mu?{' '}
                            <Link href="/auth-new/register" className="text-primary-500 font-semibold hover:underline">
                                Kayıt Ol
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
