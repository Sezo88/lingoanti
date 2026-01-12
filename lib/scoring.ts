export function calculateTimeMultiplier(seconds: number): number {
    if (seconds <= 30) return 2.0
    if (seconds <= 60) return 1.5
    if (seconds <= 90) return 1.2
    return 1.0
}

export function calculateAttemptBonus(attemptNumber: number): number {
    // İlk denemelerde daha fazla bonus
    if (attemptNumber === 1) return 2.0  // 1. denemede 2x bonus
    if (attemptNumber === 2) return 1.5  // 2. denemede 1.5x bonus
    if (attemptNumber === 3) return 1.2  // 3. denemede 1.2x bonus
    return 1.0  // 4+ denemede bonus yok
}

export function calculateWordScore(seconds: number, attemptNumber: number = 1): number {
    const baseScore = 100
    const timeMultiplier = calculateTimeMultiplier(seconds)
    const attemptBonus = calculateAttemptBonus(attemptNumber)

    return Math.round(baseScore * timeMultiplier * attemptBonus)
}
