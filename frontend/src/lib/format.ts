const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatBRL(cents: number) {
  return brl.format(cents / 100)
}

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso))
}

export function parseBRL(value: string) {
  const normalized = value.replace(/[^\d,]/g, '').replace(',', '.')
  if (!normalized) {
    return null
  }
  const cents = Math.round(Number(normalized) * 100)
  return Number.isFinite(cents) ? cents : null
}
