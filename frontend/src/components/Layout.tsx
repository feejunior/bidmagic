import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { applyTheme, getInitialTheme, type Theme } from '../lib/theme'
import { CloseIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon } from './icons'
import styles from './Layout.module.css'
import { OPEN_SEARCH_EVENT, SEARCH_INPUT_ID, SearchBox } from './SearchBox'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function openSearch() {
      const input = document.getElementById(SEARCH_INPUT_ID)
      if (input?.offsetParent) input.focus()
      else setSearchOpen(true)
    }
    window.addEventListener(OPEN_SEARCH_EVENT, openSearch)
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, openSearch)
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? `${styles.navLink} ${styles.active}` : styles.navLink

  const links = (
    <>
      <NavLink to="/" end className={navClass}>
        Vitrine
      </NavLink>
      <NavLink to="/como-funciona" className={navClass}>
        Como funciona
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
    </>
  )

  const themeButton = (
    <button
      type="button"
      className={styles.iconButton}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )

  const account = user ? (
    <>
      <span className={styles.alias} title={user.name}>
        {user.alias}
      </span>
      <button type="button" className={styles.textButton} onClick={handleLogout}>
        Sair
      </button>
    </>
  ) : (
    <>
      <Link to="/entrar" className={styles.textButton}>
        Entrar
      </Link>
      <Link to="/cadastro" className={`button ${styles.cta}`}>
        Criar conta
      </Link>
    </>
  )

  return (
    <div className={styles.shell}>
      <header className={styles.header} data-no-print>
        <div className={styles.bar}>
          <Link to="/" className={styles.brand}>
            <span className={styles.brandMark}>✦</span> BidMagic
          </Link>

          <nav className={styles.nav} aria-label="Principal">
            {links}
          </nav>

          <div className={styles.search}>
            <SearchBox />
          </div>

          <div className={styles.actions}>
            {themeButton}
            {account}
          </div>

          <div className={styles.mobileActions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Buscar"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className={styles.mobileSearch}>
            <SearchBox onDone={() => setSearchOpen(false)} />
          </div>
        )}

        {menuOpen && (
          <div className={styles.drawer}>
            <nav className={styles.drawerNav} aria-label="Menu">
              {links}
            </nav>
            <div className={styles.drawerFooter}>
              {themeButton}
              <div className={styles.drawerAccount}>{account}</div>
            </div>
          </div>
        )}
      </header>

      <main className={styles.main}>
        <Suspense fallback={<p className="muted">Carregando...</p>}>
          <Outlet />
        </Suspense>
      </main>

      <footer className={styles.footer} data-no-print>
        <div className={styles.footerInner}>
          <span>
            <span className={styles.brandMark}>✦</span> BidMagic · leilões de cartas Magic
          </span>
          <nav className={styles.footerLinks} aria-label="Rodapé">
            <Link to="/como-funciona">Como funciona</Link>
            <a href="https://github.com/feejunior/bidmagic" target="_blank" rel="noreferrer">
              Código no GitHub
            </a>
          </nav>
          <span className={styles.credits}>
            Dados e imagens: Scryfall. Magic: The Gathering © Wizards of the Coast, uso conforme a Fan Content Policy.
          </span>
        </div>
      </footer>
    </div>
  )
}
