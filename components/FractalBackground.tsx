import styles from './FractalBackground.module.css'

export default function FractalBackground() {
    // 9 columns * 8 rows = 72 cells
    const cells = Array.from({ length: 72 })

    // 2x2 nested grid for each cell
    const nestedCells = Array.from({ length: 4 })

    return (
        <div className={styles.bg}>
            <div className={styles.container}>
                {/* Fractal Grid */}
                <div className={styles.fractal}>
                    {cells.map((_, i) => (
                        <div key={i} className={styles.cell}>
                            <div className={styles.nestedGrid}>
                                {nestedCells.map((_, j) => (
                                    <div key={j} className={styles.miniCell}></div>
                                ))}
                            </div>
                        </div>
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
