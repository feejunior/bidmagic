import { useCallback, useEffect, useRef, useState } from 'react'

export function useServerClock(tickMs = 1000) {
  const offset = useRef(0)
  const [now, setNow] = useState(() => Date.now())

  const sync = useCallback((serverNow: string) => {
    offset.current = Date.parse(serverNow) - Date.now()
    setNow(Date.now() + offset.current)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset.current), tickMs)
    return () => window.clearInterval(id)
  }, [tickMs])

  return { now, sync }
}
