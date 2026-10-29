import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { BidPlaced, LotDetail, LotEvent, MyBids, Wallet } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { HoloCard } from '../components/HoloCard'
import { ChevronIcon, ClockIcon, CrownIcon, ShieldIcon } from '../components/icons'
import { StatusBadge } from '../components/StatusBadge'
import {
  centsToInput,
  formatBRL,
  formatDateTimeSeconds,
  formatEndsAt,
  formatRelative,
  parseBRL,
} from '../lib/format'
import { currentStatus, formatRemaining, RARITY_LABELS, urgency } from '../lib/lots'
import { useLotSocket } from '../lib/useLotSocket'
import { usePageTitle } from '../lib/usePageTitle'
import { useServerClock } from '../lib/useServerClock'
import { NotFoundPage } from './NotFoundPage'
import styles from './LotPage.module.css'

const QUICK_MULTIPLIERS = [1, 2, 5]
const OFFLINE_NOTICE_MS = 2000

export function LotRoute() {
  const { id } = useParams()
  return <LotPage key={id} lotId={Number(id)} />
}

function LotPage({ lotId }: { lotId: number }) {
  const validId = Number.isInteger(lotId) && lotId > 0
  const { user } = useAuth()
  const { now, sync } = useServerClock(250)
  const bidInput = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const [lot, setLot] = useState<LotDetail | null>(null)
  const [notFound, setNotFound] = useState(!validId)
  const [loadError, setLoadError] = useState(false)
  const [available, setAvailable] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [bidError, setBidError] = useState('')
  const [bidSuccess, setBidSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receiptCode, setReceiptCode] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const isBidder = user?.role === 'bidder'
  usePageTitle(lot?.card.name)

  const loadLot = useCallback(() => {
    if (!validId) return
    api<LotDetail>(`/lots/${lotId}`)
      .then((data) => {
        setLot((current) => (current && current.bid_count > data.bid_count ? current : data))
        setLoadError(false)
        sync(data.server_now)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setLoadError(true)
      })
  }, [lotId, validId, sync])

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
          ranking: [
            { bidder_alias: event.bidder_alias, best_amount: event.amount },
            ...current.ranking.filter((entry) => entry.bidder_alias !== event.bidder_alias),
          ],
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
        setAnnouncement(`Novo lance de ${formatBRL(event.amount)} por ${event.bidder_alias}.`)
      } else {
        sync(event.server_now)
        setLot((current) => (current ? { ...current, status: 'closed' } : current))
        loadWallet()
        setAnnouncement(
          event.winner_alias && event.final_amount
            ? `Leilão encerrado. Vendido para ${event.winner_alias} por ${formatBRL(event.final_amount)}.`
            : 'Leilão encerrado sem lances.',
        )
      }
    },
    [applyBid, loadWallet, sync],
  )

  const finished = lot?.status === 'closed' || lot?.status === 'cancelled'
  const connected = useLotSocket(notFound || finished ? null : lotId, handleEvent, loadLot)
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    if (connected) return
    const id = window.setTimeout(() => setOffline(true), OFFLINE_NOTICE_MS)
    return () => {
      window.clearTimeout(id)
      setOffline(false)
    }
  }, [connected])

  const isLeader = !!user && lot?.leader_alias === user.alias
  const wasLeader = useRef(false)
  useEffect(() => {
    if (wasLeader.current && !isLeader) {
      setBidSuccess('')
      setAnnouncement('Você foi superado.')
    }
    wasLeader.current = isLeader
  }, [isLeader])

  const wonLot = isBidder && lot?.status === 'closed' && lot.leader_alias === user?.alias
  useEffect(() => {
    if (!wonLot) return
    api<MyBids>('/my-bids')
      .then((data) => setReceiptCode(data.items.find((item) => item.lot.id === lotId)?.receipt_code ?? null))
      .catch(() => setReceiptCode(null))
  }, [wonLot, lotId])

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

  function focusBid() {
    panel.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => bidInput.current?.focus(), 350)
  }

  if (notFound) {
    return <NotFoundPage title="Lote não encontrado" message="Este lote não existe ou foi removido." />
  }
  if (!lot) {
    return loadError ? (
      <div className="error-box" role="alert">
        Não foi possível carregar o lote.{' '}
        <button type="button" className="button button-ghost" onClick={loadLot}>
          Tentar de novo
        </button>
      </div>
    ) : (
      <p className="muted">Carregando lote...</p>
    )
  }

  const status = currentStatus(lot.status, lot.starts_at, lot.ends_at, now)
  const remaining = Date.parse(lot.ends_at) - now
  const untilStart = Date.parse(lot.starts_at) - now
  const level = urgency(remaining)
  const extended = Date.parse(lot.ends_at) !== Date.parse(lot.original_ends_at)
  const position = user ? lot.ranking.findIndex((entry) => entry.bidder_alias === user.alias) + 1 : 0
  const wasOutbid = !isLeader && position > 0
  const settled = lot.status === 'closed'
  const base = lot.current_bid ?? lot.starting_bid
  const rarity = RARITY_LABELS[lot.card.rarity] ?? lot.card.rarity
  const canBid = status === 'live' && isBidder && !isLeader

  let priceLabel = lot.current_bid ? 'Lance atual' : 'Lance inicial'
  if (status === 'closed') priceLabel = lot.current_bid ? 'Vendido por' : 'Sem lances'

  const timer =
    status === 'live' ? (
      <strong
        className={`${styles.clock} ${level !== 'normal' ? styles.urgent : ''} ${
          level === 'critical' ? styles.pulse : ''
        } num`}
      >
        {formatRemaining(remaining)}
      </strong>
    ) : status === 'scheduled' ? (
      <strong className={`${styles.clock} num`}>{formatRemaining(untilStart)}</strong>
    ) : (
      <strong className={styles.clock}>
        {status === 'cancelled' ? 'Cancelado' : settled ? 'Encerrado' : 'Encerrando...'}
      </strong>
    )

  return (
    <div className={styles.page}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className={styles.topbar}>
        <nav className={styles.breadcrumb} aria-label="Caminho">
          <Link to="/">Vitrine</Link>
          <ChevronIcon size={12} />
          <Link to={`/?q=${encodeURIComponent(lot.card.set_name)}`}>{lot.card.set_name}</Link>
          <ChevronIcon size={12} />
          <span aria-current="page">{lot.card.name}</span>
        </nav>
        <CopyLinkButton path={`/lotes/${lot.id}`} className={styles.share} />
      </div>

      <div className={styles.layout}>
        <div className={styles.imageCol}>
          <HoloCard src={lot.card.image_url} alt={lot.card.name} rarity={lot.card.rarity} />
          <p className={styles.caption}>* Imagem meramente ilustrativa.</p>
        </div>

        <div className={styles.infoCol}>
          <div className={styles.header}>
            <StatusBadge status={status} />
            {status === 'live' && offline && (
              <span className={styles.socketOff} role="status">
                Reconectando...
              </span>
            )}
          </div>
          <h1 className={styles.title}>{lot.card.name}</h1>
          <p className={styles.subtitle}>
            {lot.card.set_name} · {rarity}
            {lot.card.artist && ` · Arte de ${lot.card.artist}`}
          </p>
          <div className={styles.chips}>
            <span>Raridade: {rarity}</span>
            {lot.card.type_line && <span>{lot.card.type_line}</span>}
            <span>{lot.auctioneer_alias}</span>
          </div>
          {lot.description && <p className={styles.description}>{lot.description}</p>}

          <section className={styles.history} aria-labelledby="bids-title">
            <div className={styles.historyHeader}>
              <h2 id="bids-title">
                Lances <span className="muted num">({lot.bid_count})</span>
              </h2>
              <Link to={`/auditoria/${lot.id}`} className={styles.audited}>
                <ShieldIcon size={15} /> Histórico auditado
              </Link>
            </div>
            {lot.recent_bids.length === 0 ? (
              <p className={styles.noBids}>
                Ainda não há lances. O primeiro precisa ser de pelo menos {formatBRL(lot.starting_bid)}.
              </p>
            ) : (
              <ol className={styles.bids}>
                {lot.recent_bids.map((bid, index) => (
                  <li key={`${bid.created_at}-${bid.amount}`} className={index === 0 ? styles.topBid : ''}>
                    <span className={styles.bidder}>
                      {index === 0 && <CrownIcon size={14} />}
                      {bid.bidder_alias.replace(/^Licitante /, '')}
                      {index === 0 && (status === 'closed' ? ' · vencedor' : ' · líder')}
                      {user?.alias === bid.bidder_alias && <em> (você)</em>}
                    </span>
                    <strong className="num">{formatBRL(bid.amount)}</strong>
                    <time
                      className={styles.bidTime}
                      dateTime={bid.created_at}
                      title={formatDateTimeSeconds(bid.created_at)}
                    >
                      {formatRelative(bid.created_at, now)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
            {lot.bid_count > lot.recent_bids.length && (
              <Link to={`/auditoria/${lot.id}`} className={styles.allBids}>
                Ver todos os {lot.bid_count} lances
              </Link>
            )}
          </section>
        </div>

        <aside className={styles.panelCol}>
          <div ref={panel} className={styles.panel}>
            <div>
              <span className={styles.label}>{priceLabel}</span>
              <strong className={`${styles.price} num`}>{formatBRL(base)}</strong>
              {lot.leader_alias && (
                <span className={styles.small}>
                  {status === 'closed' ? 'Vencedor' : 'Líder'}: {lot.leader_alias}
                </span>
              )}
            </div>

            <div>
              <span className={styles.label}>
                {status === 'scheduled' ? 'Começa em' : status === 'live' ? 'Termina em' : 'Situação'}
              </span>
              {timer}
              {status === 'live' && <span className={styles.small}>{formatEndsAt(lot.ends_at, now)}</span>}
              {status === 'scheduled' && <span className={styles.small}>{formatEndsAt(lot.starts_at, now)}</span>}
            </div>

            {(status === 'live' || status === 'scheduled') && (
              <p className={styles.rule}>
                <ClockIcon size={15} />
                <span>
                  {extended && <strong>Prorrogado. </strong>}
                  Lance nos últimos 2 min prorroga o fim em 2 min.
                </span>
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
            {isBidder && position > 0 && (
              <p className={styles.small}>
                Sua posição: <strong className="num">{position}º</strong> de {lot.ranking.length}{' '}
                {lot.ranking.length === 1 ? 'participante' : 'participantes'}
              </p>
            )}

            {receiptCode && (
              <Link to={`/comprovante/${receiptCode}`} className="button">
                Ver comprovante
              </Link>
            )}

            {status === 'live' && (
              <form className={styles.bidForm} onSubmit={handleBid}>
                <div className={styles.quick}>
                  {QUICK_MULTIPLIERS.map((multiplier) => multiplier * lot.min_increment).map((step) => (
                    <button
                      key={step}
                      type="button"
                      className={styles.quickButton}
                      disabled={!canBid}
                      onClick={() => setAmount(centsToInput(Math.max(lot.minimum_bid, base + step)))}
                    >
                      +{(step / 100).toLocaleString('pt-BR')}
                    </button>
                  ))}
                </div>
                <label htmlFor="amount" className="sr-only">
                  Valor do lance
                </label>
                <div className={styles.money}>
                  <span>R$</span>
                  <input
                    ref={bidInput}
                    id="amount"
                    className="input num"
                    inputMode="decimal"
                    value={amount}
                    disabled={!canBid}
                    aria-describedby="minimum-hint"
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
                <span id="minimum-hint" className={styles.small}>
                  Mínimo: <span className="num">{formatBRL(lot.minimum_bid)}</span>
                  {available !== null && (
                    <>
                      {' '}
                      · Disponível: <span className="num">{formatBRL(available)}</span>
                    </>
                  )}
                </span>

                {!user ? (
                  <Link to="/entrar" state={{ from: `/lotes/${lot.id}` }} className={`button ${styles.submit}`}>
                    Entrar para dar lance
                  </Link>
                ) : user.role === 'auctioneer' ? (
                  <button type="button" className={`button ${styles.submit}`} disabled>
                    Leiloeiros não dão lances
                  </button>
                ) : (
                  <button className={`button ${styles.submit}`} type="submit" disabled={submitting || isLeader}>
                    {submitting ? 'Enviando...' : isLeader ? 'Você está liderando' : 'Dar lance'}
                  </button>
                )}
                {bidError && (
                  <div className="error-box" role="alert">
                    {bidError}
                  </div>
                )}
                {bidSuccess && (
                  <div className={styles.success} role="status">
                    {bidSuccess}
                  </div>
                )}
              </form>
            )}

            <dl className={styles.facts}>
              <div>
                <dt>Lance inicial</dt>
                <dd className="num">{formatBRL(lot.starting_bid)}</dd>
              </div>
              <div>
                <dt>Incremento</dt>
                <dd className="num">{formatBRL(lot.min_increment)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {status === 'live' && (
        <div className={styles.mobileBar}>
          {isBidder && (isLeader || wasOutbid) && (
            <p className={`${styles.barStatus} ${isLeader ? styles.winning : styles.outbid}`}>
              {isLeader ? 'Você está ganhando!' : 'Você foi superado!'}
            </p>
          )}
          <div>
            <span className={styles.label}>{lot.current_bid ? 'Lance atual' : 'Lance inicial'}</span>
            <strong className={`${styles.barPrice} num`}>{formatBRL(base)}</strong>
          </div>
          <div>
            <span className={styles.label}>Termina em</span>
            <strong className={`${styles.barTime} ${level !== 'normal' ? styles.urgent : ''} num`}>
              {formatRemaining(remaining)}
            </strong>
          </div>
          {!user ? (
            <Link to="/entrar" state={{ from: `/lotes/${lot.id}` }} className="button">
              Dar lance
            </Link>
          ) : (
            <button type="button" className="button" onClick={focusBid} disabled={!canBid}>
              {isLeader ? 'Liderando' : 'Dar lance'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
