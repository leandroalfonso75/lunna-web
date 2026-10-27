import type { PromotionItemDetail, PromotionSettingsInput, PromotionsFilters, PromotionsResponse } from '../types/promotions'

type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

/** Parâmetros de `GET /api/promotions` a partir dos filtros da tela (só envia o que foi escolhido). */
export function buildPromotionsQuery(accountId: string, f: PromotionsFilters): Record<string, string> {
  const query: Record<string, string> = { account_id: accountId, sort: f.sort, dir: f.dir, page: String(f.page), per_page: String(f.perPage) }
  if (f.status) query.status = f.status
  if (f.promotionId) query.promotion_id = f.promotionId
  if (f.q.trim()) query.q = f.q.trim()
  return query
}

/** Leituras e ajustes da seção Promoções (`/api/promotions`). Sem composables do Nuxt, para testar direto. */
export function createPromotionsClient(api: ApiFn) {
  return {
    list(params: Record<string, string>, options: { signal?: AbortSignal } = {}): Promise<PromotionsResponse> {
      return api('/api/promotions', { query: params, signal: options.signal })
    },
    detail(accountId: string, itemId: string): Promise<PromotionItemDetail> {
      return api(`/api/promotions/items/${itemId}`, { query: { account_id: accountId } })
    },
    /** Margem mínima/máxima do anúncio (vazio = regra geral). Só administradores. */
    saveSettings(accountId: string, itemId: string, input: PromotionSettingsInput): Promise<PromotionItemDetail> {
      return api(`/api/promotions/items/${itemId}/settings`, {
        method: 'PATCH',
        query: { account_id: accountId },
        body: { min_margin_pct: input.min_margin_pct.trim(), max_margin_pct: input.max_margin_pct.trim(), apply_to_sku: input.apply_to_sku }
      })
    },
    /** CSV com todas as promoções da Central e os anúncios de cada uma (ativos e candidatos). */
    export(accountId: string): Promise<Blob> {
      return api('/api/promotions/export', { query: { account_id: accountId }, responseType: 'blob' })
    },
    /** Lê de novo a Central de Promoções no Mercado Livre. Só administradores. */
    sync(accountId: string): Promise<{ queued: boolean }> {
      return api('/api/promotions/sync', { method: 'POST', query: { account_id: accountId } })
    }
  }
}

export type PromotionsClient = ReturnType<typeof createPromotionsClient>
