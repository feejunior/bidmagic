import { useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { LotList, LotSummary } from '../api/types'
import { EndingSoon } from '../components/EndingSoon'
import { CardIcon, CloseIcon, SearchIcon } from '../components/icons'
import { LotCard } from '../components/LotCard'
import { SEARCH_INPUT_ID } from '../components/SearchBox'
import { formatBRL } from '../lib/format'
import { RARITY_LABELS } from '../lib/lots'
import { usePageTitle } from '../lib/usePageTitle'
import { useServerClock } from '../lib/useServerClock'
import styles from './HomePage.module.css'

const STATUSES = [
  { value: 'live', label: 'Ao vivo' },
  { value: 'scheduled', label: 'Agendados' },
  { value: 'closed', label: 'Encerrados' },
] as const

const SORTS = [
  { value: 'ending', label: 'termina primeiro' },
  { value: 'highest_bid', label: 'maior lance' },
  { value: 'newest', label: 'mais recentes' },
]

const PRICE_STEP = 1000
const REFRESH_MS = 15000

type Counts = LotList['counts']

export function HomePage() {
  usePageTitle(null)
  const [params, setParams] = useSearchParams()
  const statuses = params.getAll('status')
  const rarities = params.getAll('rarity')
  const query = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'ending'
  const maxPrice = params.get('max_price')

  const [lots, setLots] = useState<LotSummary[]>([])
  const [endingSoon, setEndingSoon] = useState<LotSummary[]>([])
  const [counts, setCounts] = useState<Counts>({ live: 0, scheduled: 0, closed: 0 })
  const [ceiling, setCeiling] = useState(0)
  const [priceDraft, setPriceDraft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { now, sync } = useServerClock()

  const filterKey = params.toString()

  useEffect(() => {
    let active = true
    const search = new URLSearchParams(filterKey)
    search.delete('sort')
    search.set('sort', sort)

    function load() {
      api<LotList>(`/lots?${search}`)
        .then((data) => {
          if (!active) return
          setLots(data.items)
          setCounts(data.counts)
          setCeiling(data.price_ceiling)
          sync(data.server_now)
          setError('')
        })
        .catch((err) => {
          if (active) setError(err instanceof ApiError ? err.message : 'Erro ao carregar lotes.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }

    load()
    const id = window.setInterval(load, REFRESH_MS)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [filterKey, sort, sync])

  useEffect(() => {
    let active = true
    function load() {
      api<LotList>('/lots?status=live&sort=ending&limit=3')
        .then((data) => {
          if (active) setEndingSoon(data.items)
        })
        .catch(() => undefined)
    }
    load()
    const id = window.setInterval(load, REFRESH_MS)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (priceDraft === null) return
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (priceDraft >= ceilingRounded(ceiling)) next.delete('max_price')
      else next.set('max_price', String(priceDraft))
      setParams(next, { replace: true })
      setPriceDraft(null)
    }, 300)
    return () => window.clearTimeout(id)
  }, [priceDraft, ceiling, params, setParams])

  function toggle(key: 'status' | 'rarity', value: string) {
    const current = params.getAll(key)
    const next = new URLSearchParams(params)
    next.delete(key)
    const updated = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    updated.forEach((item) => next.append(key, item))
    setParams(next, { replace: true })
  }

  function remove(key: string, value?: string) {
    const next = new URLSearchParams(params)
    if (value === undefined) {
      next.delete(key)
    } else {
      const remaining = params.getAll(key).filter((item) => item !== value)
      next.delete(key)
      remaining.forEach((item) => next.append(key, item))
    }
    setParams(next, { replace: true })
  }

  function setSort(value: string) {
    const next = new URLSearchParams(params)
    if (value === 'ending') next.delete('sort')
    else next.set('sort', value)
    setParams(next, { replace: true })
  }

  function clearAll() {
    setParams(new URLSearchParams(), { replace: true })
  }

  const priceMax = ceilingRounded(ceiling)
  const priceValue = priceDraft ?? (maxPrice ? Number(maxPrice) : priceMax)
  const hasFilters = statuses.length > 0 || rarities.length > 0 || !!query || !!maxPrice

  const headline =
    statuses.length === 1
      ? `${lots.length} ${lots.length === 1 ? 'leilão' : 'leilões'} ${
          { live: 'ao vivo', scheduled: 'agendados', closed: 'encerrados' }[statuses[0] as 'live']
        }`
      : `${lots.length} ${lots.length === 1 ? 'lote' : 'lotes'}`

  const statusLabel = (value: string) => STATUSES.find((item) => item.value === value)?.label ?? value

  const filters = (
    <>
      <fieldset className={styles.group}>
        <legend>Status</legend>
        {STATUSES.map((item) => (
          <label key={item.value} className={styles.check}>
            <input
              type="checkbox"
              checked={statuses.includes(item.value)}
              onChange={() => toggle('status', item.value)}
            />
            <span>
              {item.label} <span className="muted num">({counts[item.value]})</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Raridade</legend>
        {Object.entries(RARITY_LABELS).map(([value, label]) => (
          <label key={value} className={styles.check}>
            <input type="checkbox" checked={rarities.includes(value)} onChange={() => toggle('rarity', value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {priceMax > 0 && (
        <fieldset className={styles.group}>
          <legend>Preço</legend>
          <input
            type="range"
            className={styles.range}
            min={0}
            max={priceMax}
            step={PRICE_STEP}
            value={Math.min(priceValue, priceMax)}
            aria-label="Preço máximo"
            onChange={(event) => setPriceDraft(Number(event.target.value))}
            style={{ '--fill': `${(Math.min(priceValue, priceMax) / priceMax) * 100}%` } as CSSProperties}
          />
          <span className="muted num">
            {formatBRL(0)} – {formatBRL(Math.min(priceValue, priceMax))}
          </span>
        </fieldset>
      )}

      {hasFilters && (
        <button type="button" className={styles.clear} onClick={clearAll}>
          Limpar filtros
        </button>
      )}
    </>
  )

  return (
    <section>
      <h1 className="sr-only">Vitrine de leilões</h1>
      <EndingSoon lots={endingSoon} now={now} />

      <div className={styles.mobileFilters}>
        <div className={styles.chips} role="group" aria-label="Status">
          {STATUSES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={statuses.includes(item.value)}
              className={`${styles.chip} ${statuses.includes(item.value) ? styles.chipOn : ''}`}
              onClick={() => toggle('status', item.value)}
            >
              {item.label} <span className="num">{counts[item.value]}</span>
            </button>
          ))}
          <button
            type="button"
            aria-expanded={showFilters}
            className={`${styles.chip} ${showFilters ? styles.chipOn : ''}`}
            onClick={() => setShowFilters((open) => !open)}
          >
            Mais filtros
          </button>
        </div>
        {showFilters && <div className={styles.mobilePanel}>{filters}</div>}
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Filtros">
          {filters}
        </aside>

        <div className={styles.content}>
          <div className={styles.toolbar}>
            <div className={styles.summary}>
              <span aria-live="polite">{loading ? 'Carregando...' : headline}</span>
              {statuses.map((value) => (
                <button key={value} type="button" className={styles.tag} onClick={() => remove('status', value)}>
                  {statusLabel(value)} <CloseIcon size={12} />
                  <span className="sr-only">remover filtro</span>
                </button>
              ))}
              {rarities.map((value) => (
                <button key={value} type="button" className={styles.tag} onClick={() => remove('rarity', value)}>
                  {RARITY_LABELS[value] ?? value} <CloseIcon size={12} />
                  <span className="sr-only">remover filtro</span>
                </button>
              ))}
              {query && (
                <button type="button" className={styles.tag} onClick={() => remove('q')}>
                  “{query}” <CloseIcon size={12} />
                  <span className="sr-only">remover busca</span>
                </button>
              )}
              {maxPrice && (
                <button type="button" className={styles.tag} onClick={() => remove('max_price')}>
                  até {formatBRL(Number(maxPrice))} <CloseIcon size={12} />
                  <span className="sr-only">remover filtro</span>
                </button>
              )}
            </div>
            <label className={styles.sort}>
              <span>Ordenar:</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                {SORTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="error-box">{error}</div>}

          {!loading && lots.length === 0 ? (
            <div className={styles.empty}>
              <CardIcon size={28} />
              <p>Nenhum lote encontrado{query ? ` para “${query}”` : ''}.</p>
              {hasFilters && (
                <button type="button" className="button button-ghost" onClick={clearAll}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {lots.map((lot, index) => (
                <LotCard key={lot.id} lot={lot} now={now} priority={index < 4} />
              ))}
              {!loading && (
                <button
                  type="button"
                  className={styles.prompt}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                    document.getElementById(SEARCH_INPUT_ID)?.focus()
                  }}
                >
                  <SearchIcon size={22} />
                  <strong>Procurando uma carta?</strong>
                  <span>Busque pelo nome</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ceilingRounded(ceiling: number) {
  return Math.max(PRICE_STEP, Math.ceil(ceiling / PRICE_STEP) * PRICE_STEP)
}
