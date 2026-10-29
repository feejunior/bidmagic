import type { Theme } from '../lib/theme'
import styles from './ThemeSwitch.module.css'

export function ThemeSwitch({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Modo escuro"
      title={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      className={`${styles.track} ${dark ? styles.dark : ''}`}
      onClick={() => onChange(dark ? 'light' : 'dark')}
    >
      <span className={styles.icon} aria-hidden="true">
        ☀
      </span>
      <span className={styles.icon} aria-hidden="true">
        ☾
      </span>
      <span className={styles.thumb} />
    </button>
  )
}
