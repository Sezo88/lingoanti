import { supabase } from './supabase'
import type { Friendship, User } from './supabase'

/**
 * Kullanıcı ara (username veya display_name ile)
 */
export async function searchUsers(query: string, currentUserId: string): Promise<User[]> {
    if (!query || query.length < 2) return []

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', currentUserId) // Kendini hariç tut
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10)

    if (error) {
        console.error('User search error:', error)
        return []
    }

    return data || []
}

/**
 * Arkadaşlık isteği gönder
 */
export async function sendFriendRequest(
    userId: string,
    friendId: string
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('friendships')
        .insert({
            user_id: userId,
            friend_id: friendId,
            status: 'pending'
        })

    return { success: !error, error }
}

/**
 * Arkadaşlık isteğini kabul et
 */
export async function acceptFriendRequest(
    friendshipId: string
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)

    return { success: !error, error }
}

/**
 * Arkadaşlığı reddet/sil
 */
export async function removeFriendship(
    friendshipId: string
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

    return { success: !error, error }
}

/**
 * Arkadaş listesini getir (her iki yönden)
 */
export async function getFriends(userId: string): Promise<any[]> {
    // İki sorgu: hem gönderdiğim hem aldığım arkadaşlıklar
    const { data: sentFriends, error: sentError } = await supabase
        .from('friendships')
        .select(`
      id,
      status,
      created_at,
      friend:users!friendships_friend_id_fkey(id, username, display_name, avatar_url)
    `)
        .eq('user_id', userId)
        .eq('status', 'accepted')

    const { data: receivedFriends, error: receivedError } = await supabase
        .from('friendships')
        .select(`
      id,
      status,
      created_at,
      user:users!friendships_user_id_fkey(id, username, display_name, avatar_url)
    `)
        .eq('friend_id', userId)
        .eq('status', 'accepted')

    if (sentError || receivedError) {
        console.error('Get friends error:', sentError || receivedError)
        return []
    }

    // Normalize: her ikisinde de friend field'i olsun
    const normalizedSent = (sentFriends || []).map(f => ({
        ...f,
        friend: f.friend
    }))

    const normalizedReceived = (receivedFriends || []).map(f => ({
        ...f,
        friend: f.user // user'ı friend olarak göster
    }))

    return [...normalizedSent, ...normalizedReceived]
}

/**
 * Bekleyen arkadaşlık isteklerini getir
 */
export async function getPendingRequests(userId: string): Promise<any[]> {
    const { data, error } = await supabase
        .from('friendships')
        .select(`
      id,
      status,
      created_at,
      user:users!friendships_user_id_fkey(id, username, display_name, avatar_url)
    `)
        .eq('friend_id', userId)
        .eq('status', 'pending')

    if (error) {
        console.error('Get pending requests error:', error)
        return []
    }

    return data || []
}

/**
 * İki kullanıcı arkadaş mı kontrol et
 */
export async function areFriends(userId: string, friendId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .eq('status', 'accepted')
        .single()

    return !error && !!data
}
