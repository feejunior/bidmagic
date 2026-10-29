import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Wallet } from '../api/types'
import { formatBRL, formatDateTime, parseBRL } from '../lib/format'
import styles from './WalletPage.module.css'

const QUICK_AMOUNTS = [5000, 10000, 50000, 100000]
const MAX_DEPOSIT = 10_000_000

const ENTRY_LABELS = {
  deposit: 'Depósito',
  purchase: 'Arremate',
  sale: 'Venda',
}

export function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    api<Wallet>('/wallet')
      .then(setWallet)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar a carteira.'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleDeposit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    const cents = parseBRL(amount)
    if (!cents || cents <= 0) {
      setError('Digite um valor válido.')
      return
    }
    if (cents > MAX_DEPOSIT) {
      setError(`O depósito máximo por operação é ${formatBRL(MAX_DEPOSIT)}.`)
      return
    }
    setSubmitting(true)
    try {
      const updated = await api<Wallet>('/wallet/deposits', { method: 'POST', body: { amount: cents } })
      setWallet(updated)
      setAmount('')
      setSuccess(`Depósito de ${formatBRL(cents)} realizado.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível depositar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!wallet) {
    return error ? <div className="error-box">{error}</div> : <p className="muted">Carregando...</p>
  }

  return (
    <section className={styles.page}>
      <div>
        <h1 className={styles.title}>Carteira</h1>
        <p className="muted">Saldo simulado para dar lances. Nenhum dinheiro real é movimentado.</p>
      </div>

      <div className={styles.balances}>
        <div className={`${styles.balance} ${styles.main}`}>
          <span>Disponível para lances</span>
          <strong>{formatBRL(wallet.available)}</strong>
        </div>
        <div className={styles.balance}>
          <span>Comprometido</span>
          <strong>{formatBRL(wallet.committed)}</strong>
          <small>Em lotes que você está liderando</small>
        </div>
        <div className={styles.balance}>
          <span>Saldo total</span>
          <strong>{formatBRL(wallet.total)}</strong>
        </div>
      </div>

      <form className={styles.deposit} onSubmit={handleDeposit}>
        <h2>Depositar</h2>
        <div className={styles.quick}>
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              className={styles.chip}
              onClick={() => setAmount((value / 100).toFixed(2).replace('.', ','))}
            >
              {formatBRL(value)}
            </button>
          ))}
        </div>
        <div className={styles.row}>
          <div className={styles.money}>
            <span>R$</span>
            <input
              className="input"
              inputMode="decimal"
              placeholder="0,00"
              aria-label="Valor do depósito"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Depositando...' : 'Depositar'}
          </button>
        </div>
        <small className="muted">Máximo de {formatBRL(MAX_DEPOSIT)} por depósito.</small>
        {error && <div className="error-box">{error}</div>}
        {success && <div className={styles.success}>{success}</div>}
      </form>

      <div>
        <h2 className={styles.subtitle}>Extrato</h2>
        {wallet.entries.length === 0 ? (
          <p className="muted">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className={styles.entries}>
            {wallet.entries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{ENTRY_LABELS[entry.type]}</strong>
                  {entry.lot_id && entry.card_name && (
                    <Link to={`/lotes/${entry.lot_id}`} className={styles.lotLink}>
                      {entry.card_name}
                    </Link>
                  )}
                </div>
                <span className={styles.date}>{formatDateTime(entry.created_at)}</span>
                <strong className={entry.amount > 0 ? styles.positive : styles.negative}>
                  {entry.amount > 0 ? '+' : '−'} {formatBRL(Math.abs(entry.amount))}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
