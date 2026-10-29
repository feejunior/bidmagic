import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { LotList, LotSummary } from '../api/types'
import { formatBRL } from '../lib/format'
import { STATUS_LABELS } from '../lib/lots'
import styles from './SearchBox.module.css'

const SUGGESTION_LIMIT = 6
const DEBOUNCE_MS = 200

type Props = {
  value: string
  onChange: (value: string) => void
}

export function SearchBox({ value, onChange }: Props) {
  const navigate = useNavigate()
  const listId = useId()
  const [suggestions, setSuggestions] = useState<LotSummary[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const term = value.trim()

  useEffect(() => {
    if (term.length < 2) {
      setSuggestions([])
      return
    }
    let active = true
    const id = window.setTimeout(() => {
      const params = new URLSearchParams({ q: term, limit: String(SUGGESTION_LIMIT) })
      api<LotList>(`/lots?${params}`)
        .then((data) => {
          if (active) {
            setSuggestions(data.items)
            setHighlighted(-1)
          }
        })
        .catch(() => {
          if (active) setSuggestions([])
        })
    }, DEBOUNCE_MS)
    return () => {
      active = false
      window.clearTimeout(id)
    }
  }, [term])

  function goTo(lot: LotSummary) {
    setOpen(false)
    navigate(`/lotes/${lot.id}`)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlighted((index) => Math.min(index + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => Math.max(index - 1, -1))
    } else if (event.key === 'Enter' && highlighted >= 0 && suggestions[highlighted]) {
      event.preventDefault()
      goTo(suggestions[highlighted])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && term.length >= 2

  return (
    <div className={styles.box}>
      <span className={styles.icon} aria-hidden="true">
        ⌕
      </span>
      <input
        className={`input ${styles.input}`}
        type="search"
        placeholder="Buscar carta pelo nome"
        aria-label="Buscar carta pelo nome"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        maxLength={100}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />

      {showList && (
        <ul id={listId} role="listbox" className={styles.list}>
          {suggestions.length === 0 ? (
            <li className={styles.empty}>Nenhuma carta encontrada para “{term}”.</li>
          ) : (
            suggestions.map((lot, index) => (
              <li
                key={lot.id}
                role="option"
                aria-selected={index === highlighted}
                className={`${styles.item} ${index === highlighted ? styles.highlighted : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => goTo(lot)}
              >
                <img src={lot.card.image_url} alt="" className={styles.thumb} />
                <div className={styles.text}>
                  <strong>{lot.card.name}</strong>
                  <span>
                    {lot.card.set_name} · {STATUS_LABELS[lot.status]}
                  </span>
                </div>
                <span className={styles.price}>{formatBRL(lot.current_bid ?? lot.starting_bid)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
