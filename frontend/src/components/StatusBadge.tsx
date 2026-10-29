import type { LotStatus } from '../api/types'
import { STATUS_LABELS } from '../lib/lots'
import styles from './StatusBadge.module.css'

export function StatusBadge({ status }: { status: LotStatus }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {status === 'live' && <span className={styles.dot} />}
      {STATUS_LABELS[status]}
    </span>
  )
}
