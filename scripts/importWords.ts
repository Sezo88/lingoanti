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
    console.log('📝 Lütfen .env.local.example dosyasını kopyalayıp .env.local olarak kaydedin')
    console.log('   ve Supabase bilgilerinizi ekleyin.')
    process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase credentials eksik!')
    console.log('📝 .env.local dosyasında NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY değerlerini ayarlayın')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function importWords() {
    console.log('📖 Kelime listesi okunuyor...')

    const wordsPath = path.join(process.cwd(), 'kelime_listesi.txt')
    const fileContent = fs.readFileSync(wordsPath, 'utf-8')
    const allWords = fileContent.split('\n').map(w => w.trim()).filter(w => w.length > 0)

    console.log(`✅ ${allWords.length.toLocaleString('tr-TR')} kelime bulundu`)

    // Kelimeleri unique yap (Set kullanarak)
    const uniqueWords = Array.from(new Set(allWords.map(w => w.toLowerCase())))
    console.log(`✅ ${uniqueWords.length.toLocaleString('tr-TR')} benzersiz kelime bulundu (Toplam: ${allWords.length.toLocaleString('tr-TR')})`)

    // Kelimeleri uzunluğa göre grupla
    const wordsByLength: { [key: number]: string[] } = {}

    uniqueWords.forEach(word => {
        const len = word.length
        if (!wordsByLength[len]) {
            wordsByLength[len] = []
        }
        wordsByLength[len].push(word)
    })

    console.log('\n📊 Kelime dağılımı:')
    Object.keys(wordsByLength)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(len => {
            console.log(`   ${len} harf: ${wordsByLength[parseInt(len)].length.toLocaleString('tr-TR')} kelime`)
        })

    // Sadece 4-10 harf arası kelimeleri veritabanına ekle
    const validLengths = [4, 5, 6, 7, 8, 9, 10]
    const wordsToInsert: Array<{ word: string; length: number }> = []

    validLengths.forEach(len => {
        if (wordsByLength[len]) {
            wordsByLength[len].forEach(word => {
                wordsToInsert.push({ word: word.toLowerCase(), length: len })
            })
        }
    })

    console.log(`\n📝 ${wordsToInsert.length.toLocaleString('tr-TR')} kelime veritabanına eklenecek...`)

    // Batch insert (1000'er 1000'er)
    const batchSize = 1000
    let inserted = 0

    for (let i = 0; i < wordsToInsert.length; i += batchSize) {
        const batch = wordsToInsert.slice(i, i + batchSize)

        const { error } = await supabase
            .from('words')
            .upsert(batch, { onConflict: 'word,length', ignoreDuplicates: true })

        if (error) {
            console.error(`❌ Hata (batch ${Math.floor(i / batchSize) + 1}):`, error.message)
            // Devam et, bazı kelimeler zaten var olabilir
        } else {
            inserted += batch.length
            console.log(`✓ ${inserted.toLocaleString('tr-TR')} / ${wordsToInsert.length.toLocaleString('tr-TR')} kelime eklendi`)
        }
    }

    console.log('\n✅ Kelime aktarımı tamamlandı!')

    // Veritabanındaki toplam kelime sayısını kontrol et
    const { count } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true })

    console.log(`\n📊 Veritabanında toplam ${count?.toLocaleString('tr-TR')} kelime bulunuyor`)
}

// Script'i çalıştır
importWords()
    .then(() => {
        console.log('\n🎉 İşlem başarıyla tamamlandı!')
        process.exit(0)
    })
    .catch(error => {
        console.error('\n❌ Hata:', error)
        process.exit(1)
    })
