import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Audit } from '../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { formatBRL, formatDateTime } from '../lib/format'
import styles from './AuditPage.module.css'

function short(hash: string | null) {
  return hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : '—'
}

export function AuditPage() {
  const lotId = Number(useParams().id)
  const [audit, setAudit] = useState<Audit | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Audit>(`/audit/lots/${lotId}`)
      .then(setAudit)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar a auditoria.'))
  }, [lotId])

  if (error) {
    return <div className="error-box">{error}</div>
  }
  if (!audit) {
    return <p className="muted">Verificando histórico...</p>
  }

  return (
    <section className={styles.page}>
      <Link to={`/lotes/${audit.lot_id}`} className={styles.back}>
        ← Voltar ao lote
      </Link>

      <div>
        <h1 className={styles.title}>Auditoria do lote #{audit.lot_id}</h1>
        <p className="muted">
          {audit.card_name} · <StatusBadge status={audit.status} />
        </p>
      </div>

      <div className={`${styles.verdict} ${audit.valid ? styles.ok : styles.fail}`}>
        <span className={styles.verdictIcon}>{audit.valid ? '✓' : '✕'}</span>
        <div>
          <strong>{audit.valid ? 'Histórico íntegro' : 'Histórico adulterado'}</strong>
          <p>
            {audit.valid
              ? 'Todos os lances conferem com a corrente de hashes e com o selo do lote.'
              : 'Algum lance foi alterado, removido ou inserido fora do sistema.'}
          </p>
        </div>
      </div>

      <div className={styles.checks}>
        <div className={styles.check}>
          <span>{audit.bids.every((bid) => bid.valid) ? '✓' : '✕'}</span>
          <div>
            <strong>Corrente de lances</strong>
            <p>Cada lance carrega o hash do anterior. Mexer em um quebra o seguinte.</p>
          </div>
        </div>
        <div className={styles.check}>
          <span>{audit.seal_valid ? '✓' : '✕'}</span>
          <div>
            <strong>Selo do lote</strong>
            <p>Cobre a quantidade de lances e o último hash. Detecta remoção do último lance.</p>
          </div>
        </div>
        <div className={styles.check}>
          <span>{audit.receipt_hash_valid === null ? '—' : audit.receipt_hash_valid ? '✓' : '✕'}</span>
          <div>
            <strong>Âncora do comprovante</strong>
            <p>
              {audit.receipt_hash_valid === null
                ? 'Ainda não há comprovante para este lote.'
                : 'O hash guardado no comprovante bate com o último lance.'}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Licitante</th>
              <th>Valor</th>
              <th>Data (UTC)</th>
              <th>Hash anterior</th>
              <th>Hash</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.genesis}>
              <td>0</td>
              <td colSpan={3}>Início da corrente (gênesis)</td>
              <td>—</td>
              <td title={audit.genesis_hash}>
                <code>{short(audit.genesis_hash)}</code>
              </td>
              <td />
            </tr>
            {audit.bids.map((bid, index) => (
              <tr key={bid.id} className={bid.valid ? '' : styles.broken}>
                <td>{index + 1}</td>
                <td>{bid.bidder_alias}</td>
                <td>{formatBRL(bid.amount)}</td>
                <td title={bid.created_at}>{formatDateTime(bid.created_at)}</td>
                <td title={bid.prev_hash}>
                  <code>{short(bid.prev_hash)}</code>
                </td>
                <td title={bid.hash}>
                  <code>{short(bid.hash)}</code>
                </td>
                <td>{bid.valid ? '✓ ok' : '✕ inválido'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>
        Os hashes são HMAC-SHA256 com uma chave secreta do servidor, então só o servidor consegue recalcular. Passe o
        mouse sobre um hash para ver o valor completo.
      </p>
    </section>
  )
}
