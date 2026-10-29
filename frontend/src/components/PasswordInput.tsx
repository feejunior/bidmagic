import { useState, type InputHTMLAttributes } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'
import styles from './PasswordInput.module.css'

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={styles.wrap}>
      <input {...props} type={visible ? 'text' : 'password'} className={`input ${styles.input}`} />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}
