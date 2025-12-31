# Supabase Kurulum Rehberi

## 1. Adım: Supabase Hesabı Oluşturun

1. https://supabase.com adresine gidin
2. "Start your project" butonuna tıklayın
3. GitHub hesabınızla giriş yapın (veya email ile kayıt olun)
4. "New project" butonuna tıklayın

## 2. Adım: Yeni Proje Oluşturun

1. **Name**: "lingo-anti" veya istediğiniz bir isim
2. **Database Password**: Güçlü bir şifre belirleyin (kaydedin!)
3. **Region**: Europe (Frankfurt) seçin (Türkiye'ye en yakını)
4. **Pricing Plan**: Free tier seçin
5. "Create new project" butonuna tıklayın
6. Proje oluşturulurken 1-2 dakika bekleyin

## 3. Adım: API Anahtarlarını Kopyalayın

Proje hazır olduğunda:

1. Sol menüden **Settings** (⚙️) > **API** bölümüne gidin
2. Aşağıdaki değerleri kopyalayın:
   - **Project URL** (URL kısmı)
   - **anon public** anahtarı (API Keys kısmında)

## 4. Adım: .env.local Dosyası Oluşturun

1. Proje klasöründe `.env.local.example` dosyasını kopyalayın
2. Yeni dosyayı `.env.local` olarak kaydedin
3. Kopyaladığınız değerleri yapıştırın:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## 5. Adım: Veritabanı Tablolarını Oluşturun

1. Supabase dashboard'da sol menüden **SQL Editor** bölümüne gidin
2. "New query" butonuna tıklayın
3. `supabase/schema.sql` dosyasının içeriğini kopyalayıp yapıştırın
4. "Run" butonuna tıklayın (▶️)
5. Başarılı olduğunu doğrulayın

## 6. Adım: Paketleri Yükleyin

```bash
npm install
```

## 7. Adım: Kelimeleri Yükleyin

```bash
npm run import-words
```

Bu komut:
- `kelime_listesi.txt` dosyasındaki 65,494 kelimeyi okuyacak
- 4-10 harf arası kelimeleri filtreleyecek
- Supabase'e batch batch yükleyecek

## 8. Adım: Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Tarayıcıda `http://localhost:3000` adresine gidin.

---

## Sorun Giderme

### "Cannot find module '@supabase/supabase-js'"
→ `npm install` komutunu çalıştırın

### "Supabase credentials eksik!"
→ `.env.local` dosyasını kontrol edin, değerlerin doğru olduğundan emin olun

### Kelime yükleme hatası
→ SQL schema'nın başarıyla çalıştığından emin olun
→ API anahtarlarının doğru olduğunu kontrol edin
