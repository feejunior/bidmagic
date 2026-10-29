import { useEffect } from 'react'

export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · BidMagic` : 'BidMagic · Leilões de cartas Magic'
  }, [title])
}
