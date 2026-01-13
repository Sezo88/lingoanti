import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'

// .env.local dosyasını yükle
config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase credentials eksik!')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function importFilteredWords() {
    const inputPath = path.join(process.cwd(), 'filtered_game_words.json')

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ ${inputPath} dosyası bulunamadı!`)
        console.log('Lütfen web arayüzünden indirdiğiniz dosyayı proje ana dizinine "filtered_game_words.json" adıyla koyun.')
        process.exit(1)
    }

    console.log('📖 Filtrelenmiş kelimeler okunuyor...')
    const fileContent = fs.readFileSync(inputPath, 'utf-8')
    const wordsToInsert = JSON.parse(fileContent)

    if (!Array.isArray(wordsToInsert) || wordsToInsert.length === 0) {
        console.error('❌ Geçersiz veya boş kelime listesi!')
        process.exit(1)
    }

    console.log(`✅ ${wordsToInsert.length} kelime yüklenecek.`)
    console.log('⚠️ Mevcut game_words tablosu temizleniyor...')

    // Mevcut kelimeleri sil
    const { error: deleteError } = await supabase
        .from('game_words')
        .delete()
        .neq('word', '') // Hepsini siler

    if (deleteError) {
        console.error('❌ Temizleme hatası:', deleteError.message)
        process.exit(1)
    }

    console.log('📝 Yeni kelimeler aktarılıyor...')

    const batchSize = 1000
    let inserted = 0

    for (let i = 0; i < wordsToInsert.length; i += batchSize) {
        const batch = wordsToInsert.slice(i, i + batchSize)
        const { error } = await supabase
            .from('game_words')
            .insert(batch)

        if (error) {
            console.error(`❌ Yükleme Hatası (Batch ${i}):`, error.message)
        } else {
            inserted += batch.length
            console.log(`✓ ${inserted} kelime yüklendi`)
        }
    }

    console.log('\n✅ İşlem başarıyla tamamlandı!')
    console.log(`${inserted} kelime game_words tablosuna eklendi.`)
}

importFilteredWords().catch(console.error);
