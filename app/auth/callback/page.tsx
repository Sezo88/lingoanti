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
            console.log('Mobile callback handler initiated - ' + new Date().toISOString());
            // --- IMPLICIT FLOW (token direkt URL hash'te) ---
            // URL'deki tokenleri alıp native şemaya (lingoanti://) fırlatır.
            if (typeof window !== 'undefined') {
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                // source=mobile parametresi veya User-Agent ile mobil kontrolü
                const sourceParam = searchParams.get('source');
                const isMobile = sourceParam === 'mobile' || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

                console.log('Hash check - hasTokens:', !!accessToken, 'source:', sourceParam, 'isMobile:', isMobile);

                // Hash'te token varsa (implicit flow) mobil uygulamaya yönlendir
                if (accessToken && refreshToken && isMobile) {
                    setStatus('Uygulamaya yönlendiriliyorsunuz...')
                    window.location.href = `lingoanti://auth/callback#access_token=${accessToken}&refresh_token=${refreshToken}`;
                    return;
                }

                // Token var ama web'den geldiyse, session oluştur ve anasayfaya git
                if (accessToken && refreshToken && !isMobile) {
                    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                    router.push('/');
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

                        // URL'deki source parametresi ile mobil mi kontrol et (User-Agent'a ek)
                        const sourceParam = searchParams.get('source')
                        const isMobile = sourceParam === 'mobile' || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

                        console.log('OAuth callback - source:', sourceParam, 'isMobile:', isMobile)

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

// Mobile OAuth PKCE flow support - v2
