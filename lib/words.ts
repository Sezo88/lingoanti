import { supabase } from './supabase'

/**
 * Rastgele kelime seç (uzunluğa göre)
 */
export async function getRandomWord(length: number): Promise<string | null> {
    const { data, error } = await supabase
        .from('words')
        .select('word')
        .eq('length', length)
        .limit(100) // 100 kelime çek, sonra random seç

    if (error || !data || data.length === 0) {
        console.error('Kelime seçilemedi:', error)
        return null
    }

    // Random bir kelime seç
    const randomIndex = Math.floor(Math.random() * data.length)
    return data[randomIndex].word.toLocaleUpperCase('tr-TR')
}

/**
 * Kelimenin veritabanında olup olmadığını kontrol et
 */
export async function isValidWord(word: string): Promise<boolean> {
    // Türkçe karakterler için doğru lowercase dönüşümü
    const normalizedWord = word.toLocaleLowerCase('tr-TR')

    const { data, error } = await supabase
        .from('words')
        .select('word')
        .eq('word', normalizedWord)
        .maybeSingle()

    return !error && !!data
}

/**
 * Belirli uzunluktaki kelime sayısını getir
 */
export async function getWordCount(length: number): Promise<number> {
    const { count, error } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true })
        .eq('length', length)

    if (error) {
        console.error('Kelime sayısı alınamadı:', error)
        return 0
    }

    return count || 0
}
