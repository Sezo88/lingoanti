# Lingo Anti - Kurulum Rehberi

## ⚠️ Önemli: PowerShell Execution Policy Sorunu

PowerShell'de script çalıştırmak için execution policy'yi ayarlamanız gerekiyor.

### Çözüm (İki Seçenek):

#### Seçenek 1: PowerShell'i Yönetici Olarak Aç (Önerilen)
1. Windows'ta "PowerShell" arayın
2. Sağ tıklayıp **"Yönetici olarak çalıştır"** seçin
3. Şu komutu girin:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
4. "Y" yazıp Enter'a basın
5. Bu PowerShell penceresinde devam edin

#### Seçenek 2: Git Bash veya CMD Kullan
- **Git Bash** kuruluysa, Git Bash'te komutları çalıştırın
- Veya **CMD** (Command Prompt) kullanabilirsiniz

---

## 📦 Adım 1: Paketleri Yükleyin

Execution policy sorununu çözdükten sonra:

```bash
npm install
```

## 🗄️ Adım 2: Supabase Kurulumu

Detaylı talimatlar için `SUPABASE_SETUP.md` dosyasına bakın.

Kısa özet:
1. https://supabase.com'da hesap oluşturun
2. Yeni proje oluşturun
3. API anahtarlarını kopyalayın
4. `.env.local` dosyası oluşturun ve anahtarları yapıştırın
5. SQL Editor'da `supabase/schema.sql` dosyasını çalıştırın

## 📚 Adım 3: Kelimeleri Yükleyin

Supabase kurulumu tamamlandıktan sonra:

```bash
npm run import-words
```

Bu komut 65,494 kelimeyi veritabanına yükleyecek.

## 🚀 Adım 4: Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Tarayıcıda `http://localhost:3000` adresine gidin.

---

## 📁 Proje Yapısı

```
lingoanti/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global stiller
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Ana sayfa
├── lib/                   # Utility fonksiyonlar
│   └── supabase.ts       # Supabase client
├── scripts/              # Yardımcı scriptler
│   └── importWords.ts    # Kelime yükleme
├── supabase/            # Supabase SQL
│   └── schema.sql       # Veritabanı şeması
├── kelime_listesi.txt   # Türkçe kelimeler
└── .env.local           # Environment variables (oluşturulacak)
```

## 🆘 Yardım

Herhangi bir sorun yaşarsanız:
1. `SUPABASE_SETUP.md` dosyasını kontrol edin
2. `.env.local` dosyasının doğru oluşturulduğundan emin olun
3. Supabase dashboard'da SQL scriptinin başarıyla çalıştığını doğrulayın
