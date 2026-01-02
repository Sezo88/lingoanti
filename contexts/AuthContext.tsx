'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { usePresence } from '@/hooks/usePresence'

interface AuthContextType {
    user: User | null
    loading: boolean
    onlineUsers: Set<string>
    signIn: (email: string, password: string) => Promise<{ error: any }>
    signUp: (email: string, password: string, username: string, displayName: string) => Promise<{ error: any }>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const onlineUsers = usePresence(user?.id)

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setLoading(false)
            if (session?.user) {
                syncUser(session.user)
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                syncUser(session.user)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const syncUser = async (user: User) => {
        // Kullanıcının public.users tablosunda olup olmadığını kontrol et
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single()

        // Eğer yoksa (veya hata aldıysa - örn: satır yoksa) ekle
        if (!data) {
            console.log('User not found in public table, syncing...', user.id)
            const { error: insertError } = await supabase
                .from('users')
                .upsert({
                    id: user.id,
                    email: user.email!,
                    username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
                    display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
                }, { onConflict: 'id' })

            if (insertError) {
                console.error('Error syncing user:', insertError)
            } else {
                console.log('User synced successfully')
            }
        }
    }

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
    }

    const signUp = async (email: string, password: string, username: string, displayName: string) => {
        // Sign up user (with auto confirm for development)
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: undefined,
                data: {
                    username,
                    display_name: displayName,
                }
            }
        })

        if (error || !data.user) return { error }

        // Create user profile
        // syncUser zaten onAuthStateChange ile tetiklenecek ama garanti olsun diye burada da çağırabiliriz veya bekleyebiliriz.
        // signUp'dan hemen sonra insert yapmak daha güvenli (context update beklemeden).
        const { error: profileError } = await supabase
            .from('users')
            .insert({
                id: data.user.id,
                email,
                username,
                display_name: displayName,
            })

        return { error: profileError }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{ user, loading, onlineUsers, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
