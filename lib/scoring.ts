export function calculateTimeMultiplier(seconds: number): number {
    if (seconds <= 30) return 2.0
    if (seconds <= 60) return 1.5
    if (seconds <= 90) return 1.2
    return 1.0
}

export function calculateWordScore(seconds: number): number {
    const multiplier = calculateTimeMultiplier(seconds)
    return Math.round(100 * multiplier)
}
