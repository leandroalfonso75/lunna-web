/**
 * Formatação — toda a regra de negócio fica na API (ver DECISOES.md §1); o
 * front só formata o que a API já calculou. `null`/`undefined` viram "—" em
 * todo formatador aqui (valor ainda não calculado/indisponível).
 */

const TIME_ZONE = 'America/Sao_Paulo'
const DASH = '—'

type Num = number | null | undefined

export function brl(n: Num): string {
  if (n === null || n === undefined) return DASH
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

/** Inteiro com separador de milhar pt-BR. */
export function int(n: Num): string {
  if (n === null || n === undefined) return DASH
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n)
}

/** Percentual com 1 casa decimal, ex.: "12,3%". */
export function pct(n: Num): string {
  if (n === null || n === undefined) return DASH
  return `${num(n, 1)}%`
}

/** Pontos percentuais com 1 casa decimal, ex.: "3,2 p.p.". */
export function pp(n: Num): string {
  if (n === null || n === undefined) return DASH
  return `${num(n, 1)} p.p.`
}

/** Número pt-BR com o número de casas decimais pedido. */
export function num(n: Num, casas: number): string {
  if (n === null || n === undefined) return DASH
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n)
}

function formatInTimeZone(iso: string | null | undefined, options: Intl.DateTimeFormatOptions): string {
  if (!iso) return DASH
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return DASH
  return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: TIME_ZONE }).format(date)
}

/** "DD/MM HH:MM" no fuso America/Sao_Paulo. */
export function dateTimeShort(iso: string | null | undefined): string {
  const parts = formatInTimeZone(iso, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  // Intl separa data e hora com vírgula em pt-BR ("24/09, 14:05") — o
  // formato pedido é "DD/MM HH:MM", sem vírgula.
  return parts.replace(',', '')
}

/** "HH:MM" no fuso America/Sao_Paulo. */
export function timeShort(iso: string | null | undefined): string {
  return formatInTimeZone(iso, { hour: '2-digit', minute: '2-digit', hour12: false })
}
