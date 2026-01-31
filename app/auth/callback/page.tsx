'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

function AuthCallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClientComponentClient()

    useEffect(() => {
        const handleAuth = async () => {
            // --- MOBILE FALLBACK LOGIC ---
            // Android App Link çalışmazsa ve site açılırsa, burası devreye girer.
            // URL'deki tokenleri alıp native şemaya (lingoanti://) fırlatır.
            if (typeof window !== 'undefined') {
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken && refreshToken) {
                    // Native app'i zorla aç
                    window.location.href = `lingoanti://auth/callback#access_token=${accessToken}&refresh_token=${refreshToken}`;
                    return; // Web işlemine devam etme
                }
            }
            // -----------------------------

            const code = searchParams.get('code')

            if (code) {
                try {
                    await supabase.auth.exchangeCodeForSession(code)
                    router.push('/')
                    return
                } catch (error) {
                    console.error('Auth callback error:', error)
                }
            }

            // If no code or error, check if we are already logged in or just redirect
            router.push('/')
        }

        handleAuth()
    }, [searchParams, router, supabase])

    return (
        <div className="min-h-screen bg-dark-100 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="text-white">Giriş yapılıyor...</p>
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
