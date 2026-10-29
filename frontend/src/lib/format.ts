const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateTimeSeconds = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const dateTimeUtc = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
})

const timeOnly = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

export function formatBRL(cents: number) {
  return brl.format(cents / 100)
}

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso))
}

export function formatDateTimeSeconds(iso: string) {
  return dateTimeSeconds.format(new Date(iso))
}

export function formatDateTimeUTC(iso: string) {
  return dateTimeUtc.format(new Date(iso))
}

export function formatRelative(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 10) return 'agora'
  if (seconds < 60) return `há ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  return dayMonth.format(new Date(iso))
}

function timeZoneLabel() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (zone === 'America/Sao_Paulo') return 'horário de Brasília'
  return zone.replace('_', ' ')
}

export function formatEndsAt(iso: string, now: number) {
  const date = new Date(iso)
  const today = new Date(now)
  const tomorrow = new Date(now + 86400000)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

  let day = dayMonth.format(date)
  if (sameDay(date, today)) day = 'hoje'
  else if (sameDay(date, tomorrow)) day = 'amanhã'

  return `${day} às ${timeOnly.format(date)} (${timeZoneLabel()})`
}

export function parseBRL(value: string) {
  const normalized = value.replace(/[^\d,]/g, '').replace(',', '.')
  if (!normalized) {
    return null
  }
  const cents = Math.round(Number(normalized) * 100)
  return Number.isFinite(cents) ? cents : null
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',')
}
