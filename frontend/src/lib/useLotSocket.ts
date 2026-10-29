import { useEffect, useRef, useState } from 'react'
import type { LotEvent } from '../api/types'

const RECONNECT_DELAY_MS = 2500

export function useLotSocket(lotId: number | null, onEvent: (event: LotEvent) => void, onReconnect: () => void) {
  const [connected, setConnected] = useState(false)
  const handlers = useRef({ onEvent, onReconnect })

  useEffect(() => {
    handlers.current = { onEvent, onReconnect }
  })

  useEffect(() => {
    if (lotId === null) return
    let socket: WebSocket | null = null
    let retry: number | undefined
    let stopped = false
    let opened = false

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${protocol}://${window.location.host}/ws/lots/${lotId}`)

      socket.onopen = () => {
        setConnected(true)
        if (opened) handlers.current.onReconnect()
        opened = true
      }
      socket.onmessage = (message) => {
        try {
          handlers.current.onEvent(JSON.parse(message.data) as LotEvent)
        } catch {
          return
        }
      }
      socket.onclose = () => {
        setConnected(false)
        if (!stopped) {
          retry = window.setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }
    }

    connect()
    return () => {
      stopped = true
      window.clearTimeout(retry)
      socket?.close()
    }
  }, [lotId])

  return connected
}
