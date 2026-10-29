import type { LotStatus } from '../api/types'

export const RARITY_LABELS: Record<string, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Rara',
  mythic: 'Mítica',
  special: 'Especial',
  bonus: 'Bônus',
}

export const STATUS_LABELS: Record<LotStatus, string> = {
  scheduled: 'Agendado',
  live: 'Ao vivo',
  closed: 'Encerrado',
  cancelled: 'Cancelado',
}

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
    return '00:00'
  }
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')

  if (days > 0) {
    return `${days}d ${pad(hours)}h`
  }
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}
