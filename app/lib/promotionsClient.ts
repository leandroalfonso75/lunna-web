import type { PromotionActionLog, PromotionActionResult, PromotionItemDetail, PromotionSettingsInput, PromotionsFilters, PromotionsResponse, PromotionTarget } from '../types/promotions'

type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

/** Parâmetros de `GET /api/promotions` a partir dos filtros da tela (só envia o que foi escolhido). */
export function buildPromotionsQuery(accountId: string, f: PromotionsFilters): Record<string, string> {
  const query: Record<string, string> = { account_id: accountId, sort: f.sort, dir: f.dir, page: String(f.page), per_page: String(f.perPage) }
  if (f.status) query.status = f.status
  if (f.promotionId) query.promotion_id = f.promotionId
  if (f.q.trim()) query.q = f.q.trim()
  return query
}

/** Campo de número do formulário: o `v-model` de `<input type="number">` entrega número, não texto. */
const field = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v).trim())

/** Leituras e ajustes da seção Promoções (`/api/promotions`). Sem composables do Nuxt, para testar direto. */
export function createPromotionsClient(api: ApiFn) {
  return {
    list(params: Record<string, string>, options: { signal?: AbortSignal } = {}): Promise<PromotionsResponse> {
      return api('/api/promotions', { query: params, signal: options.signal })
    },
    detail(accountId: string, itemId: string): Promise<PromotionItemDetail> {
      return api(`/api/promotions/items/${itemId}`, { query: { account_id: accountId } })
    },
    /** Limites do anúncio por margem ou por valor (vazio = regra geral). Só administradores. */
    saveSettings(accountId: string, itemId: string, input: PromotionSettingsInput): Promise<PromotionItemDetail> {
      return api(`/api/promotions/items/${itemId}/settings`, {
        method: 'PATCH',
        query: { account_id: accountId },
        body: {
          limit_mode: input.limit_mode,
          min_margin_pct: field(input.min_margin_pct), max_margin_pct: field(input.max_margin_pct),
          min_price: field(input.min_price), max_price: field(input.max_price),
          apply_to_sku: input.apply_to_sku, apply_to_variations: input.apply_to_variations
        }
      })
    },
    /** CSV com todas as promoções da Central e os anúncios de cada uma (ativos e candidatos). */
    export(accountId: string): Promise<Blob> {
      return api('/api/promotions/export', { query: { account_id: accountId }, responseType: 'blob' })
    },
    /** Aplica no Mercado Livre a melhor oferta do anúncio, ou a escolhida. Só administradores. */
    apply(accountId: string, itemId: string, target?: PromotionTarget): Promise<PromotionActionResult> {
      const body = target ? { promotion_id: target.promotion_id ?? '', promotion_type: target.promotion_type, action: target.action } : {}
      return api(`/api/promotions/items/${itemId}/apply`, { method: 'POST', query: { account_id: accountId }, body })
    },
    /** Tira o anúncio da promoção de preço atual. Só administradores. */
    leave(accountId: string, itemId: string): Promise<PromotionActionResult> {
      return api(`/api/promotions/items/${itemId}/leave`, { method: 'POST', query: { account_id: accountId } })
    },
    /** Aplica a melhor oferta em vários anúncios, em fila no servidor. Só administradores. */
    applyBest(accountId: string, itemIds: string[]): Promise<{ queued: number }> {
      return api('/api/promotions/apply_best', { method: 'POST', query: { account_id: accountId }, body: { item_ids: itemIds } })
    },
    actions(accountId: string): Promise<{ actions: PromotionActionLog[] }> {
      return api('/api/promotions/actions', { query: { account_id: accountId } })
    },
    /** Lê de novo a Central de Promoções no Mercado Livre. Só administradores. */
    sync(accountId: string): Promise<{ queued: boolean }> {
      return api('/api/promotions/sync', { method: 'POST', query: { account_id: accountId } })
    }
  }
}

export type PromotionsClient = ReturnType<typeof createPromotionsClient>
