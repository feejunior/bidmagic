import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { CardSearchResult, LotDetail } from '../api/types'
import { formatBRL, parseBRL } from '../lib/format'
import { RARITY_LABELS } from '../lib/lots'
import styles from './NewLotPage.module.css'
import { usePageTitle } from '../lib/usePageTitle'

const DURATIONS = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '1 hora', minutes: 60 },
  { label: '6 horas', minutes: 360 },
  { label: '1 dia', minutes: 1440 },
  { label: '3 dias', minutes: 4320 },
  { label: '7 dias', minutes: 10080 },
]

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function NewLotPage() {
  usePageTitle('Criar lote')
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CardSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [card, setCard] = useState<CardSearchResult | null>(null)

  const [description, setDescription] = useState('')
  const [startingBid, setStartingBid] = useState('')
  const [minIncrement, setMinIncrement] = useState('')
  const [scheduled, setScheduled] = useState(false)
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)))
  const [duration, setDuration] = useState(60)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const term = query.trim()

  useEffect(() => {
    if (term.length < 2) {
      setResults([])
      setSearchError('')
      return
    }
    let active = true
    setSearching(true)
    const id = window.setTimeout(() => {
      api<CardSearchResult[]>(`/cards/search?${new URLSearchParams({ q: term })}`)
        .then((cards) => {
          if (!active) return
          setResults(cards)
          setSearchError('')
        })
        .catch((err) => {
          if (active) setSearchError(err instanceof ApiError ? err.message : 'Erro ao buscar cartas.')
        })
        .finally(() => {
          if (active) setSearching(false)
        })
    }, 300)
    return () => {
      active = false
      window.clearTimeout(id)
    }
  }, [term])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!card) {
      setError('Escolha uma carta.')
      return
    }
    const starting = parseBRL(startingBid)
    const increment = parseBRL(minIncrement)
    if (!starting || starting <= 0 || !increment || increment <= 0) {
      setError('Informe o lance inicial e o incremento mínimo (maiores que zero).')
      return
    }

    const start = new Date(startsAt)
    if (scheduled && start.getTime() < Date.now() - 60000) {
      setError('O início não pode estar no passado.')
      return
    }

    setSubmitting(true)
    try {
      const lot = await api<LotDetail>('/lots', {
        method: 'POST',
        body: {
          scryfall_id: card.scryfall_id,
          description: description.trim() || null,
          starting_bid: starting,
          min_increment: increment,
          starts_at: scheduled ? start.toISOString() : null,
          duration_minutes: duration,
        },
      })
      navigate(`/lotes/${lot.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar o lote.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.page}>
      <Link to="/painel" className={styles.back}>
        ← Meus lotes
      </Link>
      <h1 className={styles.title}>Criar lote</h1>

      <div className={styles.step}>
        <h2>1. Escolha a carta</h2>
        {card ? (
          <div className={styles.selected}>
            <img src={card.image_url} alt={card.name} />
            <div>
              <strong>{card.name}</strong>
              <span>
                {card.set_name} · {RARITY_LABELS[card.rarity] ?? card.rarity}
              </span>
              {card.type_line && <span>{card.type_line}</span>}
              <button type="button" className="button button-ghost" onClick={() => setCard(null)}>
                Trocar carta
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              className="input"
              type="search"
              placeholder="Digite o nome da carta (em inglês), ex: Black Lotus"
              aria-label="Buscar carta no Scryfall"
              maxLength={100}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
            {searchError && <div className="error-box" role="alert">{searchError}</div>}
            {searching && results.length === 0 && (
              <div className={styles.results}>
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className={styles.skeleton} />
                ))}
              </div>
            )}
            {!searching && term.length >= 2 && results.length === 0 && !searchError && (
              <p className="muted">Nenhuma carta encontrada.</p>
            )}
            <div className={`${styles.results} ${searching ? styles.stale : ''}`}>
              {results.map((result) => (
                <button
                  key={result.scryfall_id}
                  type="button"
                  className={styles.result}
                  onClick={() => setCard(result)}
                >
                  <img src={result.image_url} alt="" loading="lazy" />
                  <strong>{result.name}</strong>
                  <span>{result.set_name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <form className={styles.step} onSubmit={handleSubmit}>
        <h2>2. Regras do leilão</h2>

        <div className={styles.grid}>
          <div className="field">
            <label htmlFor="starting">Lance inicial (R$)</label>
            <input
              id="starting"
              className="input"
              inputMode="decimal"
              placeholder="100,00"
              value={startingBid}
              onChange={(event) => setStartingBid(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="increment">Incremento mínimo (R$)</label>
            <input
              id="increment"
              className="input"
              inputMode="decimal"
              placeholder="5,00"
              value={minIncrement}
              onChange={(event) => setMinIncrement(event.target.value)}
              required
            />
          </div>
        </div>
        {parseBRL(startingBid) && parseBRL(minIncrement) ? (
          <p className={styles.hint}>
            Primeiro lance: {formatBRL(parseBRL(startingBid) ?? 0)}. Depois, cada lance precisa superar o atual em
            pelo menos {formatBRL(parseBRL(minIncrement) ?? 0)}.
          </p>
        ) : null}

        <div className="field">
          <label>Início</label>
          <div className={styles.toggle}>
            <button
              type="button"
              className={!scheduled ? styles.toggleOn : ''}
              onClick={() => setScheduled(false)}
            >
              Agora
            </button>
            <button type="button" className={scheduled ? styles.toggleOn : ''} onClick={() => setScheduled(true)}>
              Agendar
            </button>
          </div>
          {scheduled && (
            <input
              className="input"
              type="datetime-local"
              aria-label="Data e hora de início"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          )}
        </div>

        <div className="field">
          <label>Duração</label>
          <div className={styles.durations}>
            {DURATIONS.map((option) => (
              <button
                key={option.minutes}
                type="button"
                className={`${styles.chip} ${duration === option.minutes ? styles.chipOn : ''}`}
                onClick={() => setDuration(option.minutes)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="description">Descrição (opcional)</label>
          <textarea
            id="description"
            className="input"
            rows={3}
            maxLength={1000}
            placeholder="Estado da carta, idioma, observações..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <p className={styles.hint}>Depois de publicado, o lote não pode ser editado. Sem lances, ele pode ser cancelado.</p>

        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="button" type="submit" disabled={submitting || !card}>
          {submitting ? 'Publicando...' : 'Publicar lote'}
        </button>
      </form>
    </section>
  )
}
