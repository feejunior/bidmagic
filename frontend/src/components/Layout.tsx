import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { applyTheme, getInitialTheme, type Theme } from '../lib/theme'
import styles from './Layout.module.css'
import { ThemeSwitch } from './ThemeSwitch'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? `${styles.navLink} ${styles.active}` : styles.navLink

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            <span className={styles.brandMark}>✦</span> BidMagic
          </Link>

          <nav className={styles.nav}>
            <NavLink to="/" end className={navClass}>
              Vitrine
            </NavLink>
            {user?.role === 'auctioneer' && (
              <NavLink to="/painel" className={navClass}>
                Meus lotes
              </NavLink>
            )}
            {user?.role === 'bidder' && (
              <>
                <NavLink to="/meus-lances" className={navClass}>
                  Meus lances
                </NavLink>
                <NavLink to="/carteira" className={navClass}>
                  Carteira
                </NavLink>
              </>
            )}
          </nav>

          <div className={styles.actions}>
            <ThemeSwitch theme={theme} onChange={setTheme} />
            {user ? (
              <>
                <span className={styles.alias} title={user.name}>
                  {user.alias}
                </span>
                <button type="button" className="button button-ghost" onClick={handleLogout}>
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link to="/entrar" className="button button-ghost">
                  Entrar
                </Link>
                <Link to="/cadastro" className="button">
                  Criar conta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
