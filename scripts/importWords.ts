import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'

// .env.local dosyasını yükle
config({ path: path.join(process.cwd(), '.env.local') })

// .env.local dosyasından değerleri oku
const envPath = path.join(process.cwd(), '.env.local')
if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local dosyası bulunamadı!')
    process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase credentials eksik!')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function importWords() {
    console.log('📖 Kelime listesi okunuyor...')

    const wordsPath = path.join(process.cwd(), 'kelime_listesi.txt')
    if (!fs.existsSync(wordsPath)) {
        console.error('❌ kelime_listesi.txt bulunamadı!')
        process.exit(1)
    }

    const fileContent = fs.readFileSync(wordsPath, 'utf-8')
    const allWords = fileContent.split('\n').map(w => w.trim()).filter(w => w.length > 0)

    console.log(`✅ ${allWords.length.toLocaleString('tr-TR')} kelime bulundu`)

    // Kelimeleri unique yap
    const uniqueWords = Array.from(new Set(allWords.map(w => w.toLowerCase())))

    // Sadece 4-10 harf arası kelimeleri hazırla
    const validLengths = [4, 5, 6, 7, 8, 9, 10]
    const wordsToInsert: Array<{ word: string; length: number }> = []

    uniqueWords.forEach(word => {
        if (validLengths.includes(word.length)) {
            wordsToInsert.push({ word: word, length: word.length })
        }
    })

    console.log(`\n📝 ${wordsToInsert.length.toLocaleString('tr-TR')} kelime veritabanına aktarılacak...`)

    const batchSize = 1000
    let inserted = 0

    for (let i = 0; i < wordsToInsert.length; i += batchSize) {
        const batch = wordsToInsert.slice(i, i + batchSize)
        const { error } = await supabase
            .from('words')
            .upsert(batch, { onConflict: 'word,length', ignoreDuplicates: true })

        if (error) {
            console.error(`❌ Hata:`, error.message)
        } else {
            inserted += batch.length
            console.log(`✓ ${inserted.toLocaleString('tr-TR')} kelime işlendi`)
        }
    }

    console.log('\n✅ İşlem tamamlandı!')
}

importWords().catch(console.error);
