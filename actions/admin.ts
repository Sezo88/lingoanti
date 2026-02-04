"use server"

import { createServerActionClient } from "@supabase/auth-helpers-nextjs"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

// Helper to verify admin role
async function checkAdmin() {
    const supabase = createServerActionClient({ cookies })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    return userData?.role === 'super_admin' || userData?.role === 'admin'
}

export async function getAdminStats() {
    const isAdmin = await checkAdmin()
    if (!isAdmin) throw new Error("Unauthorized")

    const supabase = createServerActionClient({ cookies })

    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true })
    const { count: activeGames } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'waiting')

    // Recent users (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: newUsers } = await supabase.from('users').select('*', { count: 'exact', head: true }).gt('created_at', yesterday)

    return {
        totalUsers: totalUsers || 0,
        activeGames: activeGames || 0,
        newUsers: newUsers || 0
    }
}

export async function distributeTickets(amount: number) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) throw new Error("Unauthorized")

    const supabase = createServerActionClient({ cookies })

    // We use the RPC function 'distribute_tickets_all' created in migration
    const { error } = await supabase.rpc('distribute_tickets_all', { amount })

    if (error) {
        console.error("Distribution error:", error)
        return { success: false, error: error.message }
    }

    return { success: true, message: `Herkese ${amount} bilet başarıyla gönderildi!` }
}

export async function distributeCoins(amount: number) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) throw new Error("Unauthorized")

    const supabase = createServerActionClient({ cookies })

    // We use the RPC function 'distribute_coins_all' created in migration
    const { error } = await supabase.rpc('distribute_coins_all', { amount })

    if (error) {
        console.error("Distribution error:", error)
        return { success: false, error: error.message }
    }

    return { success: true, message: `Herkese ${amount} LPara başarıyla gönderildi!` }
}

export async function sendGlobalNotification(title: string, body: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) throw new Error("Unauthorized")

    const supabase = createServerActionClient({ cookies })

    const { data: users, error } = await supabase
        .from('users')
        .select('id, expo_push_token')
        .not('expo_push_token', 'is', null)

    if (error || !users) return { success: false, error: 'Failed to fetch users' }

    console.log(`Sending to ${users.length} users...`)

    const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/send-push'
    const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    let successCount = 0;

    // Simple loop for MVP - ideally should be batched via Edge Function or Queue
    for (const user of users) {
        if (!user.expo_push_token) continue;

        fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                targetUserId: user.id,
                title,
                body,
                data: { type: 'global' }
            })
        }).catch(e => console.error(`Failed to send to ${user.id}`, e));

        successCount++;
    }

    return { success: true, count: successCount, message: `${successCount} kullanıcıya bildirim gönderildi.` }
}

// User Management Actions

export async function searchUsers(query: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) throw new Error("Unauthorized")

    // Require at least 2 chars to search, otherwise return empty
    if (!query || query.length < 2) return []

    const supabase = createServerActionClient({ cookies })

    // Search by username or email
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(20) // Limit results

    if (error) {
        console.error("Search error:", error)
        return []
    }

    return users
}

export async function toggleBanUser(userId: string, status: boolean) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) throw new Error("Unauthorized")

    const supabase = createServerActionClient({ cookies })

    // Try to use the RPC function first
    let { error } = await supabase.rpc('toggle_ban_user', {
        target_user_id: userId,
        ban_status: status
    })

    if (error) {
        console.log("RPC/Migration missing, trying direct update...");
        // Fallback: direct update if column exists but RPC doesn't
        // This requires the column 'is_banned' to exist
        const { error: updateError } = await supabase
            .from('users')
            .update({ is_banned: status })
            .eq('id', userId)

        if (updateError) {
            console.error("Ban error:", updateError)
            return { success: false, error: updateError.message }
        }
    }

    revalidatePath('/admin')
    return { success: true, message: `Kullanıcı ${status ? 'yasaklandı' : 'yasağı kaldırıldı'}` }
}

export async function deleteUser(userId: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) throw new Error("Unauthorized")

    const supabase = createServerActionClient({ cookies })

    // Hard delete from public.users
    // Note: This won't delete from auth.users without Service Role Key + Admin API
    // But it will effectively remove them from the app logic
    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin')
    return { success: true, message: 'Kullanıcı silindi' }
}
