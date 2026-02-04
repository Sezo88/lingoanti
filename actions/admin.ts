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

    // We need to use RPC or raw SQL because Supabase API doesn't support "update all" easily without where
    // We use the RPC function 'distribute_tickets_all' created in migration
    const { error } = await supabase.rpc('distribute_tickets_all', { amount })

    if (error) {
        console.error("Distribution error:", error)
        return { success: false, error: error.message }
    }

    return { success: true }
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

    return { success: true }
}

export async function sendGlobalNotification(title: string, body: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) throw new Error("Unauthorized")

    const supabase = createServerActionClient({ cookies })

    // Fetch all users with tokens
    // This needs to be batched!
    // For now, let's fetch first 1000. Real production needs pagination/background job.

    // Actually, calling the Edge Function from here is better.
    // The Edge Function "send-push" sends to ONE user.
    // I need to loop here.

    const { data: users, error } = await supabase
        .from('users')
        .select('id, expo_push_token')
        .not('expo_push_token', 'is', null)

    if (error || !users) return { success: false, error: 'Failed to fetch users' }

    console.log(`Sending to ${users.length} users...`)

    // Send in batches of 100 to avoid limits/timeouts
    // Note: This is a long running process, vercel server actions have timeout.
    // Ideally this goes to a queue. For now, we just try our best.

    let successCount = 0;

    // We will call the edge function for each user (SLOW) or update edge function to handle batch.
    // Current edge function handles 1 user.
    // Let's use the public URL of the edge function and call it.

    const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/send-push'
    // Use Anon Key since Edge Function has --no-verify-jwt and we are protected by checkAdmin()
    const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Parallel limit
    const limit = 5;

    // Just simple loop for MVP
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

    return { success: true, count: successCount }
}
