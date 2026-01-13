# Sıra Sende Modu Düzeltme - Supabase Migration Talimatları

## Yapılan Değişiklikler

### 1. Yeni Dosya: `add_turn_timeout_handler.sql`
- `handle_turn_timeout` RPC fonksiyonu eklendi
- Süre dolduğunda "-----" tahminini ekler ve sırayı ilerletir

### 2. Güncellenen Dosya: `add_turn_rpc.sql`
- `submit_turn_guess` fonksiyonunda `turnStartTime` güncellemesi eklendi
- Hem doğru hem yanlış cevaplarda sıra değiştiğinde timer sıfırlanıyor
- 6 tahmin dolduğunda yeni kelimeye geçiş düzeltildi

### 3. Güncellenen Dosya: `add_turn_based_mode.sql`
- `start_room_game` fonksiyonunda ilk `turnStartTime` ayarı eklendi
- Oyun başladığında timer doğru başlıyor

## Supabase'e Uygulama Adımları

### Seçenek 1: Supabase Dashboard (Önerilen)

1. **Supabase Dashboard'a giriş yapın**
   - https://supabase.com adresine gidin
   - Projenizi seçin

2. **SQL Editor'ü açın**
   - Sol menüden "SQL Editor" seçin

3. **Migration dosyalarını sırayla çalıştırın:**

   **a) İlk olarak:** `add_turn_based_mode.sql` dosyasını güncelleyin
   ```sql
   -- Dosyanın tüm içeriğini kopyalayıp SQL Editor'e yapıştırın
   -- "Run" butonuna tıklayın
   ```

   **b) İkinci olarak:** `add_turn_rpc.sql` dosyasını güncelleyin
   ```sql
   -- Dosyanın tüm içeriğini kopyalayıp SQL Editor'e yapıştırın
   -- "Run" butonuna tıklayın
   ```

   **c) Son olarak:** `add_turn_timeout_handler.sql` dosyasını çalıştırın
   ```sql
   -- Dosyanın tüm içeriğini kopyalayıp SQL Editor'e yapıştırın
   -- "Run" butonuna tıklayın
   ```

### Seçenek 2: Supabase CLI (İleri Seviye)

```bash
# Supabase CLI kurulu değilse:
npm install -g supabase

# Projeye bağlan
supabase link --project-ref YOUR_PROJECT_REF

# Migration'ları uygula
supabase db push
```

## Doğrulama

Migration'lar başarıyla uygulandıktan sonra:

1. **Fonksiyonları kontrol edin:**
   - SQL Editor'de şunu çalıştırın:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name IN ('handle_turn_timeout', 'submit_turn_guess', 'start_room_game')
   AND routine_schema = 'public';
   ```
   - 3 fonksiyon da listelenmeli

2. **Test edin:**
   - Yeni bir "Sıra Sende" odası oluşturun
   - 2+ oyuncu ile katılın
   - Her oyuncunun sırayla oynayabildiğini kontrol edin
   - Timeout durumunu test edin (süre dolana kadar bekleyin)

## Sorun Giderme

### Hata: "function already exists"
- Normal, fonksiyon güncelleniyor
- `CREATE OR REPLACE` kullanıldığı için sorun yok

### Hata: "column does not exist"
- `add_turn_based_mode.sql` önce çalıştırılmalı
- Sıralamaya dikkat edin

### Hata: "permission denied"
- Supabase projesinde admin yetkisi gerekli
- Proje sahibi olarak giriş yapın

## Geri Alma (Rollback)

Eğer bir sorun olursa, eski fonksiyonları geri yüklemek için:

```sql
-- Timeout handler'ı kaldır
DROP FUNCTION IF EXISTS handle_turn_timeout(UUID, UUID);

-- Eski submit_turn_guess'i geri yüklemek için
-- Git history'den eski versiyonu alıp çalıştırın
```

## Notlar

- ⚠️ Bu değişiklikler **mevcut aktif oyunları etkilemez**
- ✅ Sadece **yeni başlatılan oyunlar** düzeltilmiş mantığı kullanır
- 🔄 Aktif oyunları bitirip yeniden başlatmanız önerilir
