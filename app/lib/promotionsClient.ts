import type {
  PromotionActionLog, PromotionActionResult, PromotionAutomation, PromotionItemDetail, PromotionRunDetail, PromotionRunsResponse, PromotionSettingsInput,
  PromotionSpread, PromotionsFilters, PromotionsResponse, PromotionTarget
} from '../types/promotions'

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
          apply_to_sku: input.apply_to_sku, apply_to_variations: input.apply_to_variations,
          rules_note: input.rules_note.trim()
        }
      })
    },
    /** "Não automatizar promoções neste anúncio" (enabled = false) ou volta a automatizar; leva ao SKU e às variações se pedido. */
    setAutomation(accountId: string, itemId: string, enabled: boolean, spread: { sku: boolean; variations: boolean }): Promise<PromotionItemDetail & { updated: number }> {
      return api(`/api/promotions/items/${itemId}/automation`, {
        method: 'PATCH',
        query: { account_id: accountId },
        body: { enabled, apply_to_sku: spread.sku, apply_to_variations: spread.variations }
      })
    },
    /** CSV com todas as promoções da Central e os anúncios de cada uma (ativos e candidatos). */
    export(accountId: string): Promise<Blob> {
      return api('/api/promotions/export', { query: { account_id: accountId }, responseType: 'blob' })
    },
    /** Aplica no Mercado Livre a melhor oferta do anúncio, ou a escolhida. Só administradores. */
    apply(accountId: string, itemId: string, target?: PromotionTarget, spread?: PromotionSpread): Promise<PromotionActionResult> {
      const body: Record<string, unknown> = target ? { promotion_id: target.promotion_id ?? '', promotion_type: target.promotion_type, action: target.action } : {}
      if (target?.price !== undefined) body.price = target.price
      if (target?.force) body.force = true
      if (spread?.alsoSku) body.also_sku = true
      if (spread?.alsoVariations) body.also_variations = true
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
    /** Rotina das 03:00: se está ligada, em que modo, e as execuções. */
    runs(accountId: string): Promise<PromotionRunsResponse> {
      return api('/api/promotions/runs', { query: { account_id: accountId } })
    },
    run(accountId: string, id: number): Promise<PromotionRunDetail> {
      return api(`/api/promotions/runs/${id}`, { query: { account_id: accountId } })
    },
    runExport(accountId: string, id: number): Promise<Blob> {
      return api(`/api/promotions/runs/${id}/export`, { query: { account_id: accountId }, responseType: 'blob' })
    },
    /** "Simular agora": roda a rotina em simulação (nada muda no ML). Só administradores. */
    simulate(accountId: string): Promise<{ queued: boolean }> {
      return api('/api/promotions/runs', { method: 'POST', query: { account_id: accountId } })
    },
    /** Regras da automação (empresa): reduzir margem com tolerância e incluir catálogo. Só administradores. */
    saveAutomation(patch: Partial<PromotionAutomation>): Promise<unknown> {
      const body: Record<string, unknown> = {}
      if (patch.allow_margin_drop !== undefined) body.promo_allow_margin_drop = patch.allow_margin_drop
      if (patch.margin_drop_tolerance !== undefined) body.promo_margin_drop_tolerance = patch.margin_drop_tolerance
      if (patch.include_catalog !== undefined) body.promo_include_catalog = patch.include_catalog
      return api('/api/company', { method: 'PATCH', body })
    },
    /** Aviso de catálogo para análise manual: marcar como visto. Só administradores. */
    dismissCatalogAlert(accountId: string, id: number): Promise<unknown> {
      return api(`/api/promotions/catalog_checks/${id}/dismiss`, { method: 'POST', query: { account_id: accountId } })
    },
    /** Lê de novo a Central de Promoções no Mercado Livre. Só administradores. */
    sync(accountId: string): Promise<{ queued: boolean }> {
      return api('/api/promotions/sync', { method: 'POST', query: { account_id: accountId } })
    }
  }
}

export type PromotionsClient = ReturnType<typeof createPromotionsClient>
