import { useState } from 'react'

export function CopyLinkButton({ path, className = 'button button-ghost' }: { path: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copie o link:', url)
    }
  }

  return (
    <button type="button" className={className} onClick={handleCopy}>
      {copied ? 'Link copiado!' : 'Copiar link'}
    </button>
  )
}
