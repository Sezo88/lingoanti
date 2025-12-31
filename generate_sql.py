# -*- coding: utf-8 -*-
# Lingo.txt dosyasındaki kelimeleri Supabase words tablosuna yüklemek için SQL oluştur

# Kelimeleri oku
with open('lingo.txt', 'r', encoding='utf-8') as f:
    words = [line.strip() for line in f if line.strip()]

# SQL dosyası oluştur
with open('supabase/update_words.sql', 'w', encoding='utf-8') as f:
    # Önce mevcut kelimeleri sil
    f.write('-- Mevcut tüm kelimeleri sil\n')
    f.write('DELETE FROM words;\n\n')
    
    # Yeni kelimeleri ekle
    f.write('-- Yeni kelimeleri ekle\n')
    for word in words:
        length = len(word)
        f.write(f"INSERT INTO words (word, length) VALUES ('{word}', {length});\n")

print(f"SQL dosyası oluşturuldu: supabase/update_words.sql")
print(f"Toplam {len(words)} kelime eklendi.")
