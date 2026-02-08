'use client'

import { useEffect, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

function AuthCallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClientComponentClient()
    const [status, setStatus] = useState('Giriş yapılıyor...')

    useEffect(() => {
        const handleAuth = async () => {
            // --- MOBILE FALLBACK LOGIC ---
            // URL'deki tokenleri alıp native şemaya (lingoanti://) fırlatır.
            if (typeof window !== 'undefined') {
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                // Hash'te token varsa (implicit flow) direkt mobil uygulamaya yönlendir
                if (accessToken && refreshToken) {
                    setStatus('Uygulamaya yönlendiriliyorsunuz...')
                    window.location.href = `lingoanti://auth/callback#access_token=${accessToken}&refresh_token=${refreshToken}`;
                    return;
                }
            }

            // --- PKCE FLOW (code exchange) ---
            const code = searchParams.get('code')

            if (code) {
                try {
                    setStatus('Oturum doğrulanıyor...')
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

                    if (error) {
                        console.error('Code exchange error:', error)
                        setStatus('Giriş hatası: ' + error.message)
                        return
                    }

                    // Session başarılı - token'ları al ve mobil uygulamaya gönder
                    if (data.session) {
                        const { access_token, refresh_token } = data.session

                        // User-Agent kontrolü ile mobil mi web mi belirle
                        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

                        if (isMobile && access_token && refresh_token) {
                            // Mobil: Deep link ile uygulamaya gönder
                            setStatus('Uygulamaya yönlendiriliyorsunuz...')
                            window.location.href = `lingoanti://auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`
                            return
                        }
                    }

                    // Web: Anasayfaya git
                    router.push('/')
                    return
                } catch (error) {
                    console.error('Auth callback error:', error)
                    setStatus('Beklenmeyen hata oluştu')
                }
            }

            // Hiçbir şey yoksa anasayfaya
            router.push('/')
        }

        handleAuth()
    }, [searchParams, router, supabase])

    return (
        <div className="min-h-screen bg-dark-100 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="text-white">{status}</p>
            </div>
        </div>
    )
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-dark-100"></div>}>
            <AuthCallbackContent />
        </Suspense>
    )
}

