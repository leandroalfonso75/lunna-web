import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, MinusCircleIcon, NoSymbolIcon, TagIcon } from '@heroicons/vue/24/solid'
import type { Component } from 'vue'

/**
 * Selo de situação de um anúncio em Promoções (layout novo): cor + ícone + o texto que a API manda. A cor nunca é o
 * único sinal. Situações novas da API caem no tom que ela informa.
 */
const BY_KEY: Record<string, { cls: string; icon: Component }> = {
  trocar: { cls: 'badge-success', icon: ArrowTrendingUpIcon },
  baixar_alvo: { cls: 'badge-info', icon: ArrowTrendingDownIcon },
  ok: { cls: 'badge-success', icon: CheckCircleIcon },
  sem_promocao: { cls: 'badge-warning', icon: TagIcon },
  acima_maxima: { cls: 'badge-warning', icon: ArrowTrendingUpIcon },
  abaixo_minima: { cls: 'badge-danger', icon: ExclamationTriangleIcon },
  para_revisar: { cls: 'badge-danger', icon: ExclamationTriangleIcon },
  programado: { cls: 'badge-accent', icon: ClockIcon },
  minima_inalcancavel: { cls: 'badge-warning', icon: NoSymbolIcon },
  sem_custo: { cls: 'badge-neutral', icon: MinusCircleIcon }
}
const BY_TONE: Record<string, string> = { ok: 'badge-success', warn: 'badge-warning', bad: 'badge-danger', neutral: 'badge-neutral' }

export function statusBadge(status: { key: string; tone: string }): { cls: string; icon: Component } {
  return BY_KEY[status.key] ?? { cls: BY_TONE[status.tone] ?? 'badge-neutral', icon: TagIcon }
}

/** Selo de margem: verde dentro das regras, vermelho fora (com o texto do % junto). */
export function marginTone(valid: boolean, margin: number | null): string {
  if (margin === null) return 'text-ink-3'
  if (!valid || margin < 0) return 'text-danger'
  return 'text-success'
}

/** Ação principal de uma linha: o que resolve aquele anúncio com um clique (sempre com confirmação no painel). */
export type RowAction = 'best' | 'lower' | 'fitting' | 'review' | 'details'

interface RowLike {
  manual: boolean
  status: { key: string }
  best: { action: string } | null
  current: { valid: boolean } | null
  gain: number | null
  review: { fitting: unknown } | null
}

/**
 * Mesma condição do botão "Aplicar a melhor oferta" do painel: quando a troca melhora, a atual está fora das regras ou,
 * em "Baixar preço até o alvo", a redução cabe na tolerância configurada (com confirmação dizendo que o lucro cai).
 */
export function canApplyBest(row: RowLike): boolean {
  return !!row.best && row.best.action !== 'manter' && (!row.current || !row.current.valid || (row.gain ?? 0) > 0 || row.status.key === 'baixar_alvo')
}

export function rowAction(row: RowLike, isAdmin: boolean): RowAction {
  if (!isAdmin) return 'details'
  if (!row.manual && row.status.key === 'baixar_alvo' && canApplyBest(row)) return 'lower'
  if (!row.manual && ['trocar', 'sem_promocao', 'acima_maxima'].includes(row.status.key) && canApplyBest(row)) return 'best'
  if (row.status.key === 'para_revisar' && row.review?.fitting) return 'fitting'
  if (row.status.key === 'para_revisar' || row.status.key === 'abaixo_minima') return 'review'
  return 'details'
}
