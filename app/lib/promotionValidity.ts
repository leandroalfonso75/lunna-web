import { dateShort, dateTimeShort } from './format'

/** Dias do desconto próprio (PRICE_DISCOUNT) que o Lunna cria ao aplicar (igual à API). */
export const PRICE_DISCOUNT_DAYS = 30

/** Relâmpago e oferta do dia: o ML só marca o horário depois que o anúncio entra. */
const FLASH_TYPES = ['LIGHTNING', 'SMART_LIGHTNING', 'DOD']

interface Dated {
  type: string
  action?: string
  start_date?: string | null
  finish_date: string | null
}

/**
 * Período de validade de uma oferta, em texto: "28/10 00:00 até 30/11 23:59" (ou só as datas, `short`).
 * Desconto próprio ainda não criado vale 30 dias a partir de quando for aplicado.
 */
export function promotionValidity(o: Dated | null | undefined, short = false): string {
  if (!o) return ''
  if (o.type === 'PRICE_DISCOUNT' && o.action === 'aderir') return `${PRICE_DISCOUNT_DAYS} dias a partir de quando aplicar`
  if (FLASH_TYPES.includes(o.type) && !o.start_date && !o.finish_date) return 'horário definido pelo ML ao entrar'
  const fmt = short ? dateShort : dateTimeShort
  const start = o.start_date ? fmt(o.start_date) : ''
  const finish = o.finish_date ? fmt(o.finish_date) : ''
  if (start && finish) return `${start} até ${finish}`
  if (finish) return `até ${finish}`
  if (start) return `desde ${start}, sem data de término`
  return 'sem data de término'
}
