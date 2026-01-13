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

async function exportWords() {
    console.log('📖 game_words tablosundan kelimeler çekiliyor...')

    let allData: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true

    while (hasMore) {
        console.log(`📡 Kelimeler çekiliyor: ${from} - ${from + limit}...`)
        const { data, error } = await supabase
            .from('game_words')
            .select('word, length')
            .range(from, from + limit - 1)
            .order('word', { ascending: true })

        if (error) {
            console.error('❌ Hata:', error.message)
            process.exit(1)
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data]
            from += limit
            if (data.length < limit) {
                hasMore = false
            }
        } else {
            hasMore = false
        }
    }

    if (allData.length === 0) {
        console.log('⚠️ Tablo boş görünüyor.')
        return
    }

    console.log(`✅ Toplam ${allData.length.toLocaleString('tr-TR')} kelime bulundu`)

    const outputPath = path.join(process.cwd(), 'public', 'words_to_filter.json')

    // Klasörün varlığından emin ol
    const publicDir = path.join(process.cwd(), 'public')
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir)
    }

    fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2))

    console.log(`\n📝 Kelimeler şuraya kaydedildi: ${outputPath}`)
    console.log('✅ İşlem tamamlandı!')
}

exportWords().catch(console.error);
