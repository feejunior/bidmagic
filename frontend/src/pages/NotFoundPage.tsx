import { Link } from 'react-router-dom'
import { CardIcon } from '../components/icons'
import { usePageTitle } from '../lib/usePageTitle'
import styles from './NotFoundPage.module.css'

type Props = {
  title?: string
  message?: string
}

export function NotFoundPage({
  title = 'Página não encontrada',
  message = 'O endereço que você acessou não existe.',
}: Props) {
  usePageTitle(title)

  return (
    <div className={styles.page}>
      <CardIcon size={36} />
      <h1 className="page-title">{title}</h1>
      <p className="muted">{message}</p>
      <Link to="/" className="button">
        Voltar para a vitrine
      </Link>
    </div>
  )
}
