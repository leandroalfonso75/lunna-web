/**
 * Converte o estado dos controles da tabela de anúncios (abas, busca,
 * selects, filtros por coluna, ordenação, página) em query params para
 * `GET /api/items` (SPEC 10.4). Sem regra de negócio: só omite valores
 * vazios e monta as chaves `f[...]`. Toda validação de expressão, filtro,
 * busca, ordenação e paginação acontece no Ruby.
 */

export const ITEMS_NUMERIC_FILTER_KEYS = [
  'price',
  'stock',
  'visits_7d',
  'units_7d',
  'conversion_7d',
  'units_delta',
  'revenue_7d',
  'coverage_days',
  'quality_score'
] as const

export type ItemsNumericFilterKey = (typeof ITEMS_NUMERIC_FILTER_KEYS)[number]

export interface ItemsControlsState {
  status: 'active' | 'paused' | 'closed' | 'all'
  alert: string | null
  q: string
  type: 'P' | 'C' | ''
  shipping: 'full' | 'non_full' | ''
  /** Quando presente, ignora todos os demais filtros (SPEC 10.4). */
  id: string | null
  titleFilter: string
  skuFilter: string
  numericFilters: Partial<Record<ItemsNumericFilterKey, string>>
  sort: string
  /** `null` = não manda `dir` (deixa a API aplicar o padrão da coluna). */
  dir: 'asc' | 'desc' | null
  page: number
  perPage: number
}

export interface EffectiveSort {
  sort: string
  dir: 'asc' | 'desc'
}

/**
 * Clique num cabeçalho de coluna (SPEC 10.4): manda só a coluna na primeira
 * vez ("a API aplica o padrão de direção"); num segundo clique na MESMA
 * coluna que a última resposta confirmou como ativa, inverte o `dir`
 * efetivo que a API devolveu. Clicar noutra coluna sempre reseta (sem dir).
 */
export function nextSort(effective: EffectiveSort | null, clicked: string): { sort: string; dir: 'asc' | 'desc' | null } {
  if (effective && effective.sort === clicked) {
    return { sort: clicked, dir: effective.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { sort: clicked, dir: null }
}

export function buildItemsQuery(accountId: string, state: ItemsControlsState): Record<string, string> {
  const params: Record<string, string> = { account_id: accountId }

  if (state.id) {
    params.id = state.id
    return params
  }

  params.status = state.status
  if (state.alert) params.alert = state.alert
  if (state.q.trim()) params.q = state.q.trim()
  if (state.type) params.type = state.type
  if (state.shipping) params.shipping = state.shipping
  if (state.titleFilter.trim()) params['f[title]'] = state.titleFilter.trim()
  if (state.skuFilter.trim()) params['f[sku]'] = state.skuFilter.trim()

  for (const key of ITEMS_NUMERIC_FILTER_KEYS) {
    const value = state.numericFilters[key]
    if (value && value.trim()) params[`f[${key}]`] = value.trim()
  }

  if (state.sort) params.sort = state.sort
  if (state.dir) params.dir = state.dir
  params.page = String(state.page)
  if (state.perPage) params.per_page = String(state.perPage)

  return params
}
