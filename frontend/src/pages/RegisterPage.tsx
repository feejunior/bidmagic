import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { Role } from '../api/types'
import { useAuth } from '../auth/useAuth'
import styles from './AuthForm.module.css'

const ROLES: { value: Role; title: string; description: string }[] = [
  { value: 'bidder', title: 'Licitante', description: 'Quero dar lances' },
  { value: 'auctioneer', title: 'Leiloeiro', description: 'Quero leiloar cartas' },
]

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('bidder')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await register({ name, email, password, role })
      navigate(user.role === 'auctioneer' ? '/painel' : '/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a conta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Criar conta</h1>
        <p className={styles.subtitle}>O tipo de conta não pode ser alterado depois.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className="error-box">{error}</div>}

          <div className={styles.roles} role="radiogroup" aria-label="Tipo de conta">
            {ROLES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={role === option.value}
                className={`${styles.role} ${role === option.value ? styles.roleSelected : ''}`}
                onClick={() => setRole(option.value)}
              >
                <strong>{option.title}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="name">Nome</label>
            <input
              id="name"
              className="input"
              autoComplete="name"
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <span className="muted" style={{ fontSize: 12 }}>
              Mínimo de 8 caracteres.
            </span>
          </div>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar conta'}
          </button>
        </form>

        <p className={styles.footer}>
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
