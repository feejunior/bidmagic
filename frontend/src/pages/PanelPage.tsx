import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { LotSummary, MyLots } from '../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { formatBRL, formatDateTime } from '../lib/format'
import { currentStatus, formatRemaining } from '../lib/lots'
import { useServerClock } from '../lib/useServerClock'
import styles from './PanelPage.module.css'

export function PanelPage() {
  const [data, setData] = useState<MyLots | null>(null)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<number | null>(null)
  const { now, sync } = useServerClock()

  const load = useCallback(() => {
    api<MyLots>('/my-lots')
      .then((result) => {
        setData(result)
        sync(result.server_now)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar seus lotes.'))
  }, [sync])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 15000)
    return () => window.clearInterval(id)
  }, [load])

  async function handleCancel(lot: LotSummary) {
    if (!window.confirm(`Cancelar o lote de ${lot.card.name}? Essa ação não pode ser desfeita.`)) return
    setError('')
    setCancelling(lot.id)
    try {
      await api<void>(`/lots/${lot.id}/cancel`, { method: 'POST' })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar o lote.')
    } finally {
      setCancelling(null)
    }
  }

  if (!data) {
    return error ? <div className="error-box">{error}</div> : <p className="muted">Carregando...</p>
  }

  const counts = { live: 0, scheduled: 0, closed: 0, cancelled: 0 }
  for (const lot of data.lots) {
    counts[currentStatus(lot.status, lot.starts_at, lot.ends_at, now)] += 1
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Meus lotes</h1>
          <p className="muted">Acompanhe seus leilões e o quanto você já recebeu.</p>
        </div>
        <Link to="/painel/novo" className="button">
          + Criar lote
        </Link>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>Total recebido</span>
          <strong className={styles.money}>{formatBRL(data.total_received)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Ao vivo</span>
          <strong>{counts.live}</strong>
        </div>
        <div className={styles.stat}>
          <span>Agendados</span>
          <strong>{counts.scheduled}</strong>
        </div>
        <div className={styles.stat}>
          <span>Encerrados</span>
          <strong>{counts.closed}</strong>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {data.lots.length === 0 ? (
        <div className={styles.empty}>
          <p>Você ainda não criou nenhum lote.</p>
          <Link to="/painel/novo" className="button">
            Criar meu primeiro lote
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {data.lots.map((lot) => {
            const status = currentStatus(lot.status, lot.starts_at, lot.ends_at, now)
            const canCancel = (status === 'live' || status === 'scheduled') && lot.bid_count === 0
            return (
              <li key={lot.id} className={styles.row}>
                <img src={lot.card.image_url} alt="" className={styles.thumb} />
                <div className={styles.info}>
                  <Link to={`/lotes/${lot.id}`} className={styles.name}>
                    {lot.card.name}
                  </Link>
                  <div className={styles.meta}>
                    <StatusBadge status={status} />
                    <span>
                      {status === 'live' && `Termina em ${formatRemaining(Date.parse(lot.ends_at) - now)}`}
                      {status === 'scheduled' && `Começa ${formatDateTime(lot.starts_at)}`}
                      {(status === 'closed' || status === 'cancelled') && `Fim ${formatDateTime(lot.ends_at)}`}
                    </span>
                  </div>
                </div>
                <div className={styles.result}>
                  <strong>{formatBRL(lot.current_bid ?? lot.starting_bid)}</strong>
                  <span>
                    {status === 'closed'
                      ? lot.leader_alias
                        ? `Vendido para ${lot.leader_alias}`
                        : 'Sem lances'
                      : `${lot.bid_count} ${lot.bid_count === 1 ? 'lance' : 'lances'}`}
                  </span>
                </div>
                <div className={styles.actions}>
                  {canCancel && (
                    <button
                      type="button"
                      className="button button-ghost"
                      disabled={cancelling === lot.id}
                      onClick={() => handleCancel(lot)}
                    >
                      {cancelling === lot.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
