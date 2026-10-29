import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { LotList, LotSummary } from '../api/types'
import { LotCard } from '../components/LotCard'
import { RARITY_LABELS } from '../lib/lots'
import { useServerClock } from '../lib/useServerClock'
import styles from './HomePage.module.css'

const STATUS_TABS = [
  { value: '', label: 'Todos' },
  { value: 'live', label: 'Ao vivo' },
  { value: 'scheduled', label: 'Agendados' },
  { value: 'closed', label: 'Encerrados' },
]

const REFRESH_MS = 15000

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const rarity = params.get('rarity') ?? ''
  const query = params.get('q') ?? ''

  const [search, setSearch] = useState(query)
  const [lots, setLots] = useState<LotSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { now, sync } = useServerClock()

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (search.trim() !== query) {
        const next = new URLSearchParams(params)
        if (search.trim()) {
          next.set('q', search.trim())
        } else {
          next.delete('q')
        }
        setParams(next, { replace: true })
      }
    }, 350)
    return () => window.clearTimeout(id)
  }, [search, query, params, setParams])

  useEffect(() => {
    let active = true
    const filters = new URLSearchParams()
    if (status) filters.set('status', status)
    if (rarity) filters.set('rarity', rarity)
    if (query) filters.set('q', query)

    function load() {
      api<LotList>(`/lots?${filters}`)
        .then((data) => {
          if (!active) return
          setLots(data.items)
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
  }, [status, rarity, query, sync])

  return (
    <section>
      <div className={styles.hero}>
        <h1 className={styles.title}>Leilões de cartas Magic</h1>
        <p className="muted">Lances em tempo real, histórico auditável e comprovante de cada arremate.</p>
      </div>

      <div className={styles.filters}>
        <div className={styles.tabs} role="tablist">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              className={`${styles.tab} ${status === tab.value ? styles.tabActive : ''}`}
              onClick={() => updateParam('status', tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.searchRow}>
          <input
            className="input"
            type="search"
            placeholder="Buscar carta pelo nome"
            aria-label="Buscar carta pelo nome"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className={`input ${styles.select}`}
            aria-label="Raridade"
            value={rarity}
            onChange={(event) => updateParam('rarity', event.target.value)}
          >
            <option value="">Todas as raridades</option>
            {Object.entries(RARITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <p className="muted">Carregando lotes...</p>
      ) : lots.length === 0 ? (
        <div className={styles.empty}>
          <p>Nenhum lote encontrado.</p>
          <p className="muted">Tente outro filtro ou volte mais tarde.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {lots.map((lot) => (
            <LotCard key={lot.id} lot={lot} now={now} />
          ))}
        </div>
      )}
    </section>
  )
}
