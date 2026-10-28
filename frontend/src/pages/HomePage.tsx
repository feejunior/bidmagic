import { useAuth } from '../auth/useAuth'

export function HomePage() {
  const { user } = useAuth()

  return (
    <section>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>Vitrine</h1>
      <p className="muted">
        {user ? `Olá, ${user.name}. Você entrou como ${user.alias}.` : 'Entre para dar lances.'}
      </p>
    </section>
  )
}
