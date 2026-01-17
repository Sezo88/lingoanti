import { useState, useCallback } from 'react'
import { useCurrency } from './useCurrency'

type JokerType = 'green_letter' | 'yellow_letter' | 'extra_attempt' | 'reveal_word'

interface JokerResult {
    success: boolean
    error?: string
    data?: any
}

export function useJoker(targetWord: string, currentGuesses: string[], gameId?: string) {
    const { tickets, spendTickets } = useCurrency()
    const [loading, setLoading] = useState(false)

    // Helper: Check if a letter at position is already revealed
    const isLetterRevealed = (position: number): boolean => {
        for (const guess of currentGuesses) {
            if (guess[position] === targetWord[position]) {
                return true
            }
        }
        return false
    }

    // Helper: Check if a letter has been guessed
    const isLetterGuessed = (letter: string): boolean => {
        for (const guess of currentGuesses) {
            if (guess.includes(letter)) {
                return true
            }
        }
        return false
    }

    // 🟢 Green Letter Joker (50 tickets)
    // Reveals a random correct letter in its correct position
    const useGreenLetter = useCallback(async (): Promise<JokerResult> => {
        if (tickets < 50) {
            return { success: false, error: 'Yetersiz bilet! 50 bilet gerekli.' }
        }

        setLoading(true)
        try {
            // IMPORTANT: Only check positions up to targetWord.length (not beyond!)
            const wordLen = targetWord.length

            // Find unrevealed positions by checking if any guess has revealed this position
            const unrevealedPositions: number[] = []
            for (let i = 0; i < wordLen; i++) {
                let isRevealed = false
                // Check if this position has been correctly guessed in any previous attempt
                for (const guess of currentGuesses) {
                    if (guess[i] === targetWord[i]) {
                        isRevealed = true
                        break
                    }
                }
                if (!isRevealed) {
                    unrevealedPositions.push(i)
                }
            }

            if (unrevealedPositions.length === 0) {
                return { success: false, error: 'Tüm harfler zaten açık!' }
            }

            // Pick random unrevealed position
            const randomPos = unrevealedPositions[Math.floor(Math.random() * unrevealedPositions.length)]
            const letter = targetWord[randomPos]

            // Spend tickets
            const success = await spendTickets(50, 'green_letter')
            if (!success) {
                return { success: false, error: 'Bilet harcama başarısız!' }
            }

            return {
                success: true,
                data: { letter, position: randomPos }
            }
        } catch (err: any) {
            return { success: false, error: err.message }
        } finally {
            setLoading(false)
        }
    }, [targetWord, currentGuesses, tickets, spendTickets])

    // 🟡 Yellow Letter Joker (30 tickets)
    // Reveals a letter that exists in the word but not its position
    const useYellowLetter = useCallback(async (): Promise<JokerResult> => {
        if (tickets < 30) {
            return { success: false, error: 'Yetersiz bilet! 30 bilet gerekli.' }
        }

        setLoading(true)
        try {
            // Find unrevealed letters
            const letters = targetWord.split('')
            const unrevealedLetters = letters.filter(l => !isLetterGuessed(l))

            if (unrevealedLetters.length === 0) {
                return { success: false, error: 'Tüm harfler zaten tahmin edildi!' }
            }

            // Pick random letter
            const randomLetter = unrevealedLetters[Math.floor(Math.random() * unrevealedLetters.length)]

            // Spend tickets
            const success = await spendTickets(30, 'yellow_letter', gameId)
            if (!success) {
                return { success: false, error: 'Bilet harcama başarısız!' }
            }

            return {
                success: true,
                data: { letter: randomLetter }
            }
        } catch (err: any) {
            return { success: false, error: err.message }
        } finally {
            setLoading(false)
        }
    }, [targetWord, currentGuesses, tickets, spendTickets, gameId])

    // ➕ Extra Attempt Joker (100 tickets)
    // Adds one extra attempt
    const useExtraAttempt = useCallback(async (): Promise<JokerResult> => {
        if (tickets < 100) {
            return { success: false, error: 'Yetersiz bilet! 100 bilet gerekli.' }
        }

        setLoading(true)
        try {
            // Spend tickets
            const success = await spendTickets(100, 'extra_attempt', gameId)
            if (!success) {
                return { success: false, error: 'Bilet harcama başarısız!' }
            }

            return {
                success: true,
                data: { extraAttempt: true }
            }
        } catch (err: any) {
            return { success: false, error: err.message }
        } finally {
            setLoading(false)
        }
    }, [tickets, spendTickets, gameId])

    // 🔓 Reveal Word Joker (300 tickets)
    // Reveals the entire word (instant win)
    const useRevealWord = useCallback(async (): Promise<JokerResult> => {
        if (tickets < 300) {
            return { success: false, error: 'Yetersiz bilet! 300 bilet gerekli.' }
        }

        setLoading(true)
        try {
            // Spend tickets
            const success = await spendTickets(300, 'reveal_word', gameId)
            if (!success) {
                return { success: false, error: 'Bilet harcama başarısız!' }
            }

            return {
                success: true,
                data: { word: targetWord }
            }
        } catch (err: any) {
            return { success: false, error: err.message }
        } finally {
            setLoading(false)
        }
    }, [targetWord, tickets, spendTickets, gameId])

    return {
        loading,
        useGreenLetter,
        useYellowLetter,
        useExtraAttempt,
        useRevealWord
    }
}
