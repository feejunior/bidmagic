import { useEffect, useRef } from 'react'
import styles from './ConfirmDialog.module.css'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Voltar',
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className={styles.content}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className={styles.actions}>
          <button type="button" className="button button-ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="button button-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
