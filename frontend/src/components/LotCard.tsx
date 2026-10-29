import { Link } from 'react-router-dom'
import type { LotSummary } from '../api/types'
import { formatBRL } from '../lib/format'
import { currentStatus, formatRemaining, urgency } from '../lib/lots'
import styles from './LotCard.module.css'

export function LotCard({ lot, now, priority = false }: { lot: LotSummary; now: number; priority?: boolean }) {
  const status = currentStatus(lot.status, lot.starts_at, lot.ends_at, now)
  const remaining = Date.parse(lot.ends_at) - now
  const unsold = status === 'closed' && lot.bid_count === 0

  let pill = 'Encerrado'
  let tone = styles.pillMuted
  if (status === 'live') {
    pill = formatRemaining(remaining)
    tone = urgency(remaining) === 'normal' ? '' : styles.pillUrgent
  } else if (status === 'scheduled') {
    pill = `Começa em ${formatRemaining(Date.parse(lot.starts_at) - now)}`
    tone = styles.pillScheduled
  }

  return (
    <Link to={`/lotes/${lot.id}`} className={`${styles.card} ${status === 'closed' ? styles.closed : ''}`}>
      <div className={styles.imageWrap}>
        <img
          src={lot.card.image_url}
          alt={lot.card.name}
          className={styles.image}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
        <span className={`${styles.pill} ${tone} num`}>{pill}</span>
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{lot.card.name}</h3>
        <strong className={`${styles.price} ${unsold ? styles.unsold : ''} num`}>
          {formatBRL(lot.current_bid ?? lot.starting_bid)}
        </strong>
        <span className={styles.meta}>
          {lot.bid_count === 0 ? 'Sem lances' : `${lot.bid_count} ${lot.bid_count === 1 ? 'lance' : 'lances'}`}
          {status === 'closed' && (unsold ? ' · não vendido' : ' · vendido')}
        </span>
      </div>
    </Link>
  )
}
