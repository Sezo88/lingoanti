import type { LetterResult } from './supabase'

/**
 * Tahmini değerlendir ve her harfin durumunu hesapla
 * @param guess - Kullanıcının tahmini
 * @param target - Hedef kelime
 * @returns Her harf için durum (correct, present, absent)
 */
export function evaluateGuess(guess: string, target: string): LetterResult[] {
    const guessUpper = guess.toLocaleUpperCase('tr-TR')
    const targetUpper = target.toLocaleUpperCase('tr-TR')

    const result: LetterResult[] = []
    const targetLetters = targetUpper.split('')
    const usedIndexes: number[] = []

    // İlk geçiş: Doğru pozisyondaki harfleri bul (yeşil)
    for (let i = 0; i < guessUpper.length; i++) {
        if (guessUpper[i] === targetLetters[i]) {
            result.push({ letter: guessUpper[i], status: 'correct' })
            usedIndexes.push(i)
        } else {
            result.push({ letter: guessUpper[i], status: 'absent' }) // Geçici
        }
    }

    // İkinci geçiş: Yanlış pozisyondaki harfleri bul (sarı)
    for (let i = 0; i < guessUpper.length; i++) {
        if (result[i].status === 'correct') continue

        // Bu harf hedef kelimede var mı ve daha önce kullanılmadı mı?
        const letterIndex = targetLetters.findIndex(
            (letter, idx) => letter === guessUpper[i] && !usedIndexes.includes(idx)
        )

        if (letterIndex !== -1) {
            result[i] = { letter: guessUpper[i], status: 'present' }
            usedIndexes.push(letterIndex)
        }
    }

    return result
}

/**
 * Tahmin doğru mu kontrol et
 */
export function isCorrectGuess(guess: string, target: string): boolean {
    return guess.toLocaleUpperCase('tr-TR') === target.toLocaleUpperCase('tr-TR')
}

/**
 * Oyun bitmiş mi kontrol et
 */
export function isGameOver(
    guesses: string[],
    target: string,
    maxGuesses: number = 6
): { isOver: boolean; won: boolean } {
    // Son tahmin doğruysa kazandı
    if (guesses.length > 0 && isCorrectGuess(guesses[guesses.length - 1], target)) {
        return { isOver: true, won: true }
    }

    // Maksimum tahmin sayısına ulaşıldıysa kaybetti
    if (guesses.length >= maxGuesses) {
        return { isOver: true, won: false }
    }

    return { isOver: false, won: false }
}

/**
 * Klavye için harf durumlarını hesapla (results'tan)
 */
export function getKeyboardState(results: LetterResult[][]): Map<string, 'correct' | 'present' | 'absent'> {
    const keyState = new Map<string, 'correct' | 'present' | 'absent'>()

    if (!Array.isArray(results)) return keyState

    results.forEach(guessResult => {
        guessResult.forEach(({ letter, status }) => {
            // Geçersiz kelime durumunu atla (klavyeyi etkilemesin)
            if (status === 'invalid') return

            const currentStatus = keyState.get(letter)

            // Öncelik: correct > present > absent
            if (status === 'correct') {
                keyState.set(letter, 'correct')
            } else if (status === 'present' && currentStatus !== 'correct') {
                keyState.set(letter, 'present')
            } else if (!currentStatus && status === 'absent') {
                keyState.set(letter, status)
            }
        })
    })

    return keyState
}
