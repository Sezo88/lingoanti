import styles from './FractalBackground.module.css'

export default function FractalBackground() {
    const letters = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('')

    return (
        <div className={styles.bg}>
            <div className={styles.container}>
                <div className={styles.fractal}>
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div
                            key={i}
                            className={styles.cell}
                            data-letter={letters[i % letters.length]}
                        />
                    ))}
                </div>
                {/* Central Element */}
                <div className={styles.centerElement}></div>

                {/* Corners */}
                <div className={`${styles.corner} ${styles.cornerTl}`}></div>
                <div className={`${styles.corner} ${styles.cornerTr}`}></div>
                <div className={`${styles.corner} ${styles.cornerBr}`}></div>
                <div className={`${styles.corner} ${styles.cornerBl}`}></div>
            </div>
        </div>
    )
}
