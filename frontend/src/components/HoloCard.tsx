import { useRef, type PointerEvent } from 'react'
import styles from './HoloCard.module.css'

const MAX_TILT_DEG = 14
const FOIL_RARITIES = new Set(['rare', 'mythic', 'special', 'bonus'])

export function HoloCard({ src, alt, rarity }: { src: string; alt: string; rarity: string }) {
  const card = useRef<HTMLDivElement>(null)
  const frame = useRef(0)

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return
    const element = card.current
    if (!element) return

    const rect = element.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      element.style.setProperty('--rx', `${(0.5 - y) * MAX_TILT_DEG * 2}deg`)
      element.style.setProperty('--ry', `${(x - 0.5) * MAX_TILT_DEG * 2}deg`)
      element.style.setProperty('--mx', `${x * 100}%`)
      element.style.setProperty('--my', `${y * 100}%`)
      element.dataset.active = 'true'
    })
  }

  function handleLeave() {
    const element = card.current
    if (!element) return
    cancelAnimationFrame(frame.current)
    element.style.setProperty('--rx', '0deg')
    element.style.setProperty('--ry', '0deg')
    delete element.dataset.active
  }

  return (
    <div className={styles.stage}>
      <div
        ref={card}
        className={`${styles.card} ${FOIL_RARITIES.has(rarity) ? styles.foil : ''}`}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
      >
        <img src={src} alt={alt} className={styles.image} draggable={false} />
        <div className={styles.shine} aria-hidden="true" />
        <div className={styles.glare} aria-hidden="true" />
      </div>
    </div>
  )
}
