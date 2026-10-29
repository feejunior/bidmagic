import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { BidPlaced, LotDetail, LotEvent, Wallet } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { HoloCard } from '../components/HoloCard'
import { StatusBadge } from '../components/StatusBadge'
import { formatBRL, formatDateTime, parseBRL } from '../lib/format'
import { currentStatus, formatRemaining, RARITY_LABELS } from '../lib/lots'
import { useLotSocket } from '../lib/useLotSocket'
import { useServerClock } from '../lib/useServerClock'
import styles from './LotPage.module.css'

const URGENT_MS = 2 * 60 * 1000

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function LotPage() {
  const lotId = Number(useParams().id)
  const { user } = useAuth()
  const { now, sync } = useServerClock(250)

  const [lot, setLot] = useState<LotDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [available, setAvailable] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [bidError, setBidError] = useState('')
  const [bidSuccess, setBidSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isBidder = user?.role === 'bidder'

  const loadLot = useCallback(() => {
    api<LotDetail>(`/lots/${lotId}`)
      .then((data) => {
        setLot(data)
        sync(data.server_now)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
      })
  }, [lotId, sync])

  const loadWallet = useCallback(() => {
    if (!isBidder) return
    api<Wallet>('/wallet')
      .then((wallet) => setAvailable(wallet.available))
      .catch(() => setAvailable(null))
  }, [isBidder])

  useEffect(() => {
    loadLot()
  }, [loadLot])

  useEffect(() => {
    loadWallet()
  }, [loadWallet])

  const applyBid = useCallback(
    (event: BidPlaced) => {
      sync(event.server_now)
      setLot((current) => {
        if (!current || event.bid_count <= current.bid_count) return current
        return {
          ...current,
          current_bid: event.amount,
          leader_alias: event.bidder_alias,
          bid_count: event.bid_count,
          minimum_bid: event.minimum_bid,
          ends_at: event.ends_at,
          recent_bids: [
            { bidder_alias: event.bidder_alias, amount: event.amount, created_at: event.created_at },
            ...current.recent_bids,
          ].slice(0, 20),
        }
      })
    },
    [sync],
  )

  const handleEvent = useCallback(
    (event: LotEvent) => {
      if (event.type === 'bid_placed') {
        applyBid(event)
        loadWallet()
      } else {
        sync(event.server_now)
        setLot((current) => (current ? { ...current, status: 'closed' } : current))
        loadWallet()
      }
    },
    [applyBid, loadWallet, sync],
  )

  const connected = useLotSocket(lotId, handleEvent, loadLot)

  const minimum = lot?.minimum_bid ?? 0
  useEffect(() => {
    if (!minimum) return
    setAmount((current) => {
      const typed = parseBRL(current)
      return typed !== null && typed >= minimum ? current : centsToInput(minimum)
    })
  }, [minimum])

  async function handleBid(event: FormEvent) {
    event.preventDefault()
    setBidError('')
    setBidSuccess('')
    const cents = parseBRL(amount)
    if (cents === null || cents <= 0) {
      setBidError('Digite um valor válido.')
      return
    }
    setSubmitting(true)
    try {
      const result = await api<BidPlaced>(`/lots/${lotId}/bids`, { method: 'POST', body: { amount: cents } })
      applyBid(result)
      setBidSuccess(`Lance de ${formatBRL(result.amount)} registrado!`)
      loadWallet()
    } catch (err) {
      setBidError(err instanceof ApiError ? err.message : 'Não foi possível registrar o lance.')
      loadLot()
    } finally {
      setSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <div className={styles.center}>
        <h1>Lote não encontrado</h1>
        <Link to="/" className="button">
          Voltar para a vitrine
        </Link>
      </div>
    )
  }
  if (!lot) {
    return <p className="muted">Carregando lote...</p>
  }

  const status = currentStatus(lot.status, lot.starts_at, lot.ends_at, now)
  const remaining = Date.parse(lot.ends_at) - now
  const untilStart = Date.parse(lot.starts_at) - now
  const extended = Date.parse(lot.ends_at) !== Date.parse(lot.original_ends_at)
  const isLeader = !!user && lot.leader_alias === user.alias
  const wasOutbid = !!user && !isLeader && lot.recent_bids.some((bid) => bid.bidder_alias === user.alias)
  const settled = lot.status === 'closed'

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Vitrine
      </Link>

      <div className={styles.layout}>
        <div className={styles.imageCol}>
          <HoloCard src={lot.card.image_url} alt={lot.card.name} rarity={lot.card.rarity} />
        </div>

        <div className={styles.infoCol}>
          <div className={styles.header}>
            <StatusBadge status={status} />
            <span className={`${styles.socket} ${connected ? styles.socketOn : ''}`}>
              {connected ? 'Tempo real conectado' : 'Reconectando...'}
            </span>
          </div>

          <h1 className={styles.title}>{lot.card.name}</h1>
          <p className="muted">
            {lot.card.set_name} · {RARITY_LABELS[lot.card.rarity] ?? lot.card.rarity}
            {lot.card.artist && ` · Arte de ${lot.card.artist}`}
          </p>
          {lot.description && <p className={styles.description}>{lot.description}</p>}

          <div className={styles.panel}>
            <div className={styles.priceRow}>
              <div>
                <span className={styles.label}>
                  {status === 'closed' ? 'Valor final' : lot.current_bid ? 'Lance atual' : 'Lance inicial'}
                </span>
                <strong className={styles.price}>{formatBRL(lot.current_bid ?? lot.starting_bid)}</strong>
                <span className={styles.small}>
                  {lot.leader_alias ? `Líder: ${lot.leader_alias}` : 'Nenhum lance ainda'}
                </span>
              </div>

              <div className={styles.timer}>
                {status === 'live' && (
                  <>
                    <span className={styles.label}>Termina em</span>
                    <strong className={`${styles.clock} ${remaining <= URGENT_MS ? styles.urgent : ''}`}>
                      {formatRemaining(remaining)}
                    </strong>
                  </>
                )}
                {status === 'scheduled' && (
                  <>
                    <span className={styles.label}>Começa em</span>
                    <strong className={styles.clock}>{formatRemaining(untilStart)}</strong>
                  </>
                )}
                {status === 'closed' && (
                  <>
                    <span className={styles.label}>{settled ? 'Encerrado' : 'Encerrando...'}</span>
                    <strong className={styles.clock}>00:00</strong>
                  </>
                )}
                {status === 'cancelled' && <span className={styles.label}>Lote cancelado</span>}
              </div>
            </div>

            {extended && status === 'live' && (
              <p className={styles.notice}>
                Prorrogado por lance nos últimos 2 minutos (fim original: {formatDateTime(lot.original_ends_at)}).
              </p>
            )}

            {isBidder && isLeader && status !== 'cancelled' && (
              <p className={`${styles.youStatus} ${styles.winning}`}>
                {status === 'closed' ? 'Você venceu este leilão!' : 'Você está ganhando!'}
              </p>
            )}
            {isBidder && wasOutbid && (
              <p className={`${styles.youStatus} ${styles.outbid}`}>
                {status === 'closed' ? 'Você não venceu este leilão.' : 'Você foi superado. Dê um novo lance!'}
              </p>
            )}

            {status === 'closed' && settled && lot.leader_alias && (
              <p className={styles.small}>
                Arrematado por {lot.leader_alias} por {formatBRL(lot.current_bid ?? 0)}.
              </p>
            )}

            {status === 'live' && isBidder && (
              <form className={styles.bidForm} onSubmit={handleBid}>
                <label htmlFor="amount" className={styles.label}>
                  Seu lance (mínimo {formatBRL(lot.minimum_bid)})
                </label>
                <div className={styles.bidRow}>
                  <div className={styles.money}>
                    <span>R$</span>
                    <input
                      id="amount"
                      className="input"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                  <button className="button" type="submit" disabled={submitting || isLeader}>
                    {submitting ? 'Enviando...' : 'Dar lance'}
                  </button>
                </div>
                <div className={styles.quick}>
                  {[0, 1, 5].map((steps) => {
                    const value = lot.minimum_bid + steps * lot.min_increment
                    return (
                      <button
                        key={steps}
                        type="button"
                        className={styles.quickButton}
                        onClick={() => setAmount(centsToInput(value))}
                      >
                        {formatBRL(value)}
                      </button>
                    )
                  })}
                </div>
                {available !== null && (
                  <span className={styles.small}>Saldo disponível: {formatBRL(available)}</span>
                )}
                {bidError && <div className="error-box">{bidError}</div>}
                {bidSuccess && <div className={styles.success}>{bidSuccess}</div>}
              </form>
            )}

            {status === 'live' && !user && (
              <p className={styles.small}>
                <Link to="/entrar" state={{ from: `/lotes/${lot.id}` }}>
                  Entre como licitante
                </Link>{' '}
                para dar lances.
              </p>
            )}
            {status === 'live' && user?.role === 'auctioneer' && (
              <p className={styles.small}>Leiloeiros acompanham, mas não dão lances.</p>
            )}
          </div>

          <dl className={styles.facts}>
            <div>
              <dt>Leiloeiro</dt>
              <dd>{lot.auctioneer_alias}</dd>
            </div>
            <div>
              <dt>Incremento mínimo</dt>
              <dd>{formatBRL(lot.min_increment)}</dd>
            </div>
            <div>
              <dt>Início</dt>
              <dd>{formatDateTime(lot.starts_at)}</dd>
            </div>
            <div>
              <dt>Fim</dt>
              <dd>{formatDateTime(lot.ends_at)}</dd>
            </div>
          </dl>

          <div className={styles.history}>
            <h2>Lances ({lot.bid_count})</h2>
            {lot.recent_bids.length === 0 ? (
              <p className="muted">Ainda não há lances.</p>
            ) : (
              <ol className={styles.bids}>
                {lot.recent_bids.map((bid, index) => (
                  <li key={`${bid.created_at}-${bid.amount}`} className={index === 0 ? styles.topBid : ''}>
                    <span className={styles.bidder}>
                      {bid.bidder_alias}
                      {user?.alias === bid.bidder_alias && <em> (você)</em>}
                    </span>
                    <strong>{formatBRL(bid.amount)}</strong>
                    <span className={styles.bidTime}>{formatDateTime(bid.created_at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
