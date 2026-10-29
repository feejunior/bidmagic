import { Link } from 'react-router-dom'
import type { LotSummary } from '../api/types'
import { formatBRL } from '../lib/format'
import { formatRemaining, urgency } from '../lib/lots'
import styles from './EndingSoon.module.css'
import { FlameIcon } from './icons'

const ENDING_SOON_MS = 60 * 60 * 1000

export function EndingSoon({ lots, now }: { lots: LotSummary[]; now: number }) {
  const live = lots.filter((lot) => {
    const remaining = Date.parse(lot.ends_at) - now
    return remaining > 0 && remaining <= ENDING_SOON_MS
  })
  if (live.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="ending-soon">
      <h2 id="ending-soon" className={styles.title}>
        <FlameIcon className={styles.flame} /> Terminando agora
      </h2>
      <div className={styles.row}>
        {live.map((lot) => {
          const remaining = Date.parse(lot.ends_at) - now
          const level = urgency(remaining)
          return (
            <Link
              key={lot.id}
              to={`/lotes/${lot.id}`}
              className={`${styles.item} ${level !== 'normal' ? styles.urgent : ''}`}
            >
              <img src={lot.card.image_url} alt="" className={styles.thumb} />
              <div className={styles.info}>
                <strong>{lot.card.name}</strong>
                <span className="num">{formatBRL(lot.current_bid ?? lot.starting_bid)}</span>
              </div>
              <span
                className={`${styles.time} ${level !== 'normal' ? styles.timeUrgent : ''} ${
                  level === 'critical' ? styles.pulse : ''
                } num`}
              >
                {formatRemaining(remaining)}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
