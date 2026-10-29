import { Link } from 'react-router-dom'
import type { LotSummary } from '../api/types'
import { formatBRL } from '../lib/format'
import { currentStatus, formatRemaining, RARITY_LABELS } from '../lib/lots'
import styles from './LotCard.module.css'
import { StatusBadge } from './StatusBadge'

export function LotCard({ lot, now }: { lot: LotSummary; now: number }) {
  const status = currentStatus(lot.status, lot.starts_at, lot.ends_at, now)
  const hasBids = lot.current_bid !== null

  let timeLabel = ''
  if (status === 'live') {
    timeLabel = `Termina em ${formatRemaining(Date.parse(lot.ends_at) - now)}`
  } else if (status === 'scheduled') {
    timeLabel = `Começa em ${formatRemaining(Date.parse(lot.starts_at) - now)}`
  }

  return (
    <Link to={`/lotes/${lot.id}`} className={styles.card}>
      <div className={styles.imageWrap}>
        <img src={lot.card.image_url} alt={lot.card.name} loading="lazy" className={styles.image} />
      </div>

      <div className={styles.body}>
        <div className={styles.tags}>
          <StatusBadge status={status} />
          <span className={styles.rarity} data-rarity={lot.card.rarity}>
            {RARITY_LABELS[lot.card.rarity] ?? lot.card.rarity}
          </span>
        </div>
        <h3 className={styles.name}>{lot.card.name}</h3>
        <p className={styles.meta}>{lot.card.set_name}</p>

        <div className={styles.price}>
          <span className={styles.priceLabel}>
            {status === 'closed' ? (hasBids ? 'Arrematado por' : 'Sem lances') : hasBids ? 'Lance atual' : 'Lance inicial'}
          </span>
          <strong className={styles.priceValue}>{formatBRL(lot.current_bid ?? lot.starting_bid)}</strong>
        </div>

        <div className={styles.footer}>
          <span>
            {lot.bid_count} {lot.bid_count === 1 ? 'lance' : 'lances'}
          </span>
          {timeLabel && <span className={status === 'live' ? styles.timeLive : ''}>{timeLabel}</span>}
        </div>
      </div>
    </Link>
  )
}
