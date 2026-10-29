import type { LotStatus } from '../api/types'

export const RARITY_LABELS: Record<string, string> = {
  mythic: 'Mítica',
  rare: 'Rara',
  uncommon: 'Incomum',
  common: 'Comum',
  special: 'Especial',
  bonus: 'Bônus',
}

export const STATUS_LABELS: Record<LotStatus, string> = {
  scheduled: 'Agendado',
  live: 'Ao vivo',
  closed: 'Encerrado',
  cancelled: 'Cancelado',
}

export const URGENT_MS = 5 * 60 * 1000
export const CRITICAL_MS = 60 * 1000

export function currentStatus(
  status: LotStatus,
  startsAt: string,
  endsAt: string,
  now: number,
): LotStatus {
  if (status === 'closed' || status === 'cancelled') {
    return status
  }
  if (now < Date.parse(startsAt)) {
    return 'scheduled'
  }
  if (now < Date.parse(endsAt)) {
    return 'live'
  }
  return 'closed'
}

export function formatRemaining(ms: number) {
  if (ms <= 0) {
    return '0s'
  }
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days >= 2) {
    return `${days} dias`
  }
  if (days === 1) {
    return hours > 0 ? `1 dia ${hours}h` : '1 dia'
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  }
  if (minutes >= 10) {
    return `${minutes}min`
  }
  if (minutes > 0) {
    return `${minutes}min ${String(seconds).padStart(2, '0')}s`
  }
  return `${seconds}s`
}

export function urgency(ms: number) {
  if (ms <= CRITICAL_MS) return 'critical'
  if (ms <= URGENT_MS) return 'urgent'
  return 'normal'
}
