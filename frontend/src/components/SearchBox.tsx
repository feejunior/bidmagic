import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { LotList, LotSummary } from '../api/types'
import { formatBRL } from '../lib/format'
import { STATUS_LABELS } from '../lib/lots'
import { SearchIcon } from './icons'
import styles from './SearchBox.module.css'

const SUGGESTION_LIMIT = 6
const DEBOUNCE_MS = 200

export const SEARCH_INPUT_ID = 'site-search'

export function SearchBox({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<LotSummary[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const term = value.trim()

  useEffect(() => {
    if (location.pathname === '/') {
      setValue(new URLSearchParams(location.search).get('q') ?? '')
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (event.key === '/' && !typing) {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

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

  function finish() {
    setOpen(false)
    input.current?.blur()
    onDone?.()
  }

  function goToLot(lot: LotSummary) {
    finish()
    navigate(`/lotes/${lot.id}`)
  }

  function searchShowcase() {
    const params = new URLSearchParams(location.pathname === '/' ? location.search : '')
    if (term) params.set('q', term)
    else params.delete('q')
    finish()
    navigate({ pathname: '/', search: params.toString() })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlighted((index) => Math.min(index + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((index) => Math.max(index - 1, -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (highlighted >= 0 && suggestions[highlighted]) goToLot(suggestions[highlighted])
      else searchShowcase()
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && term.length >= 2

  return (
    <div className={styles.box}>
      <SearchIcon className={styles.icon} />
      <input
        ref={input}
        id={onDone ? undefined : SEARCH_INPUT_ID}
        autoFocus={!!onDone}
        className={styles.input}
        type="search"
        placeholder="Está buscando uma carta ou coleção?"
        aria-label="Está buscando uma carta ou coleção?"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        maxLength={100}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />
      <kbd className={styles.kbd} aria-hidden="true">
        /
      </kbd>

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
                onClick={() => goToLot(lot)}
              >
                <img src={lot.card.image_url} alt="" className={styles.thumb} />
                <div className={styles.text}>
                  <strong>{lot.card.name}</strong>
                  <span>
                    {lot.card.set_name} · {STATUS_LABELS[lot.status]}
                  </span>
                </div>
                <span className={`${styles.price} num`}>{formatBRL(lot.current_bid ?? lot.starting_bid)}</span>
              </li>
            ))
          )}
          <li
            className={styles.all}
            onMouseDown={(event) => event.preventDefault()}
            onClick={searchShowcase}
          >
            Ver todos os resultados para “{term}” <kbd>Enter</kbd>
          </li>
        </ul>
      )}
    </div>
  )
}
