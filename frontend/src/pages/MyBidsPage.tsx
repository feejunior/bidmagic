import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { MyBids } from '../api/types'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { StatusBadge } from '../components/StatusBadge'
import { formatBRL } from '../lib/format'
import { currentStatus, formatRemaining } from '../lib/lots'
import { useServerClock } from '../lib/useServerClock'
import styles from './MyBidsPage.module.css'
import { usePageTitle } from '../lib/usePageTitle'

export function MyBidsPage() {
  usePageTitle('Meus lances')
  const [data, setData] = useState<MyBids | null>(null)
  const [error, setError] = useState('')
  const { now, sync } = useServerClock()

  const load = useCallback(() => {
    api<MyBids>('/my-bids')
      .then((result) => {
        setData(result)
        sync(result.server_now)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar seus lances.'))
  }, [sync])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 15000)
    return () => window.clearInterval(id)
  }, [load])

  if (!data) {
    return error ? <div className="error-box" role="alert">{error}</div> : <p className="muted">Carregando...</p>
  }

  return (
    <section className={styles.page}>
      <div>
        <h1 className={styles.title}>Meus lances</h1>
        <p className="muted">Lotes em que você participou e os que você venceu.</p>
      </div>

      {data.items.length === 0 ? (
        <div className={styles.empty}>
          <p>Você ainda não deu nenhum lance.</p>
          <Link to="/?status=live" className="button">
            Ver leilões ao vivo
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {data.items.map(({ lot, my_highest_bid, is_leader, receipt_code }) => {
            const status = currentStatus(lot.status, lot.starts_at, lot.ends_at, now)
            const finished = status === 'closed'
            let outcome = is_leader ? 'Você está ganhando' : 'Você foi superado'
            let tone = is_leader ? styles.good : styles.bad
            if (finished) {
              outcome = is_leader ? 'Você venceu' : 'Não venceu'
              tone = is_leader ? styles.good : styles.neutral
            }

            return (
              <li key={lot.id} className={styles.row}>
                <img src={lot.card.image_url} alt="" className={styles.thumb} />
                <div className={styles.info}>
                  <Link to={`/lotes/${lot.id}`} className={styles.name}>
                    {lot.card.name}
                  </Link>
                  <div className={styles.meta}>
                    <StatusBadge status={status} />
                    {status === 'live' && <span>Termina em {formatRemaining(Date.parse(lot.ends_at) - now)}</span>}
                  </div>
                </div>
                <div className={styles.numbers}>
                  <span>Seu maior lance</span>
                  <strong>{formatBRL(my_highest_bid)}</strong>
                  <span>Atual: {formatBRL(lot.current_bid ?? lot.starting_bid)}</span>
                </div>
                <div className={styles.outcome}>
                  <span className={`${styles.pill} ${tone}`}>{outcome}</span>
                  {receipt_code && (
                    <div className={styles.receiptActions}>
                      <Link to={`/comprovante/${receipt_code}`} className="button">
                        Comprovante
                      </Link>
                      <CopyLinkButton path={`/comprovante/${receipt_code}`} />
                    </div>
                  )}
                  {finished && is_leader && !receipt_code && <span className="muted">Gerando comprovante...</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
