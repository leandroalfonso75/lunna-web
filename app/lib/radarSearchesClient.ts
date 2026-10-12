import type { RadarFilters } from './radar'

type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

export interface RadarSearch {
  id: string
  category_path: string
  filters: Partial<RadarFilters>
  /** Dia (aaaa-mm-dd) da base consultada. */
  data_ref: string | null
  total_items: number
  total_sold: number
  total_revenue: number | string
  median_price: number | string
  searched_by: string | null
  searched_at: string
}

export interface NewRadarSearch {
  category_path: string
  filters: RadarFilters
  data_ref: string
  total_items: number
  total_sold: number
  total_revenue: number
  median_price: number
}

/** Histórico de consultas do Radar (`/api/radar/searches`): últimas 3 meses. */
export function createRadarSearchesClient(api: ApiFn) {
  return {
    list(): Promise<{ searches: RadarSearch[] }> {
      return api('/api/radar/searches')
    },

    create(search: NewRadarSearch): Promise<{ search: RadarSearch }> {
      return api('/api/radar/searches', { method: 'POST', body: search })
    }
  }
}

export type RadarSearchesClient = ReturnType<typeof createRadarSearchesClient>

/** Filtros salvos + padrão para campos que não existiam quando a consulta foi feita. */
export function restoreFilters(saved: Partial<RadarFilters>, defaults: RadarFilters): RadarFilters {
  return { ...defaults, ...saved }
}

/** Texto curto dos filtros usados, para a listagem (só o que foge do padrão). */
export function describeFilters(f: Partial<RadarFilters>): string {
  const parts: string[] = []
  const days = f.customDays ? Number(f.customDays) : f.period
  if (days) parts.push(`${days} dias`)
  else if (days === 0) parts.push('todo o período')
  if (f.catalog === 'only') parts.push('só catálogo')
  if (f.catalog === 'excl') parts.push('sem catálogo')
  if (f.seller) parts.push(`vendedor “${f.seller}”`)
  if (f.brand) parts.push(`marca “${f.brand}”`)
  if (f.priceMin || f.priceMax) parts.push(`preço ${f.priceMin || '0'}–${f.priceMax || '∞'}`)
  if (f.revMin || f.revMax) parts.push(`receita ${f.revMin || '0'}–${f.revMax || '∞'}`)
  if (f.soldMin || f.soldMax) parts.push(`vendas ${f.soldMin || '0'}–${f.soldMax || '∞'}`)
  if (f.rating === 'none') parts.push('sem avaliação')
  else if (f.rating) parts.push(`nota ${f.rating}+`)
  return parts.join(' · ')
}
