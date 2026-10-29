import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Receipt } from '../api/types'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { formatBRL, formatDateTime } from '../lib/format'
import { RARITY_LABELS } from '../lib/lots'
import styles from './ReceiptPage.module.css'
import { usePageTitle } from '../lib/usePageTitle'

export function ReceiptPage() {
  const { code = '' } = useParams()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState('')
  usePageTitle(receipt ? `Comprovante · ${receipt.card.name}` : 'Comprovante')

  useEffect(() => {
    api<Receipt>(`/receipts/${encodeURIComponent(code)}`)
      .then(setReceipt)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar o comprovante.'))
  }, [code])

  if (error) {
    return (
      <div className={styles.center}>
        <h1>Comprovante não encontrado</h1>
        <p className="muted">{error}</p>
        <Link to="/" className="button">
          Voltar para a vitrine
        </Link>
      </div>
    )
  }
  if (!receipt) {
    return <p className="muted">Carregando...</p>
  }

  return (
    <section className={styles.page}>
      <article className={styles.receipt}>
        <header className={styles.header}>
          <div>
            <span className={styles.brand}>✦ BidMagic</span>
            <h1>Comprovante de arremate</h1>
          </div>
          <span className={styles.code}>Nº {receipt.public_code}</span>
        </header>

        <div className={styles.body}>
          <img src={receipt.card.image_url} alt={receipt.card.name} className={styles.image} />
          <dl className={styles.details}>
            <div>
              <dt>Carta</dt>
              <dd>{receipt.card.name}</dd>
            </div>
            <div>
              <dt>Coleção</dt>
              <dd>
                {receipt.card.set_name} · {RARITY_LABELS[receipt.card.rarity] ?? receipt.card.rarity}
              </dd>
            </div>
            <div>
              <dt>Valor final</dt>
              <dd className={styles.amount}>{formatBRL(receipt.final_amount)}</dd>
            </div>
            <div>
              <dt>Vencedor</dt>
              <dd>{receipt.winner_alias}</dd>
            </div>
            <div>
              <dt>Leiloeiro</dt>
              <dd>{receipt.auctioneer_alias}</dd>
            </div>
            <div>
              <dt>Emitido em</dt>
              <dd>{formatDateTime(receipt.issued_at)}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.hash}>
          <span>Hash do último lance (âncora de integridade)</span>
          <code>{receipt.last_hash}</code>
          <p>
            Guarde este comprovante. Se o histórico do lote for alterado, este hash deixa de bater com a{' '}
            <Link to={`/auditoria/${receipt.lot_id}`}>auditoria pública</Link>.
          </p>
        </div>
      </article>

      <div className={styles.actions}>
        <CopyLinkButton path={`/comprovante/${receipt.public_code}`} />
        <button type="button" className="button button-ghost" onClick={() => window.print()}>
          Imprimir
        </button>
        <Link to={`/lotes/${receipt.lot_id}`} className="button button-ghost">
          Ver lote
        </Link>
        <Link to={`/auditoria/${receipt.lot_id}`} className="button">
          Verificar auditoria
        </Link>
      </div>
    </section>
  )
}
