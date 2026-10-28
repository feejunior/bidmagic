import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', paddingTop: 48 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>Página não encontrada</h1>
      <p className="muted">O endereço que você acessou não existe.</p>
      <Link to="/" className="button">
        Voltar para a vitrine
      </Link>
    </div>
  )
}
