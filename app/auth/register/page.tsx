'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [verifyEmail, setVerifyEmail] = useState(true) // Default checked
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        if (password.length < 6) {
            setError('Şifre en az 6 karakter olmalıdır')
            setLoading(false)
            return
        }

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        display_name: displayName,
                    }
                }
            })

            if (signUpError) throw signUpError

            if (data.user) {
                // Insert user profile
                const { error: profileError } = await supabase
                    .from('users')
                    .upsert({
                        id: data.user.id,
                        email,
                        username,
                        display_name: displayName
                    })

                if (profileError) {
                    console.error('Profile creation error:', profileError)
                    // Continue anyway, AuthContext will try to sync
                }

                router.push('/')
            }
        } catch (err: any) {
            setError(err.message || 'Kayıt başarısız.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold gradient-text mb-2">Lingo Master</h1>
                    <p className="text-white/70">Aramıza Katıl!</p>
                </div>

                <div className="glass-effect rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-semibold mb-6 text-center">Kayıt Ol</h2>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-white/70">Adın</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 outline-none text-white"
                                    placeholder="Ahmet"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-white/70">Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 outline-none text-white"
                                    placeholder="ahmet123"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2 text-white/70">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 outline-none text-white"
                                placeholder="ornek@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2 text-white/70">Şifre</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-4 py-3 rounded-xl bg-dark-100 border border-dark-200 focus:border-primary-500 outline-none text-white"
                                placeholder="••••••••"
                            />
                        </div>

                        {/* Verification Note (Soft Verification) */}
                        <div className="flex items-start gap-3 p-3 bg-primary-500/10 rounded-xl border border-primary-500/20">
                            <input
                                type="checkbox"
                                checked={verifyEmail}
                                onChange={(e) => setVerifyEmail(e.target.checked)}
                                className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div className="text-sm text-white/80">
                                <span className="font-semibold text-primary-400">Önemli:</span> Şifrenizi unutursanız sıfırlamak için gerçek bir e-posta adresi gereklidir.
                            </div>
                        </div>

                        {error && (
                            <div className="bg-danger-500/10 border border-danger-500 text-danger-500 px-4 py-3 rounded-xl text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-50 mt-4"
                        >
                            {loading ? 'Kaydediliyor...' : 'Hesap Oluştur'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-white/70">
                            Zaten hesabın var mı?{' '}
                            <Link href="/auth/login" className="text-primary-500 font-semibold hover:underline">
                                Giriş Yap
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
