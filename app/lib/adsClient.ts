import type { AdsAnalysis, AdsDecision, AdsDiagnosis, AdsItemsFilters, AdsItemsResponse, AdsRange, AdsResponse } from '../types/ads'

type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

/** Período no formato da API: datas quando for personalizado, senão o atalho. */
export function rangeQuery(range: AdsRange): Record<string, string> {
  return range.period === 'custom' && range.from && range.to ? { from: range.from, to: range.to } : { period: range.period === 'custom' ? '30d' : range.period }
}

/** Parâmetros de `GET /api/ads/items` a partir dos filtros da tela (só envia o que foi escolhido). */
export function buildAdsItemsQuery(accountId: string, range: AdsRange, f: AdsItemsFilters): Record<string, string> {
  const query: Record<string, string> = { account_id: accountId, ...rangeQuery(range), sort: f.sort, dir: f.dir, page: String(f.page), per_page: String(f.perPage) }
  if (f.campaignId) query.campaign_id = f.campaignId
  if (f.status) query.status = f.status
  if (f.flag) query.flag = f.flag
  if (f.q.trim()) query.q = f.q.trim()
  return query
}

/** Leituras da seção Ads (`/api/ads`). Sem composables do Nuxt, para testar direto. */
export function createAdsClient(api: ApiFn) {
  return {
    overview(accountId: string, range: AdsRange, options: { signal?: AbortSignal } = {}): Promise<AdsResponse> {
      return api('/api/ads', { query: { account_id: accountId, ...rangeQuery(range) }, signal: options.signal })
    },
    items(params: Record<string, string>, options: { signal?: AbortSignal } = {}): Promise<AdsItemsResponse> {
      return api('/api/ads/items', { query: params, signal: options.signal })
    },
    /** Lê de novo campanhas e métricas no Mercado Livre. Só administradores. */
    /** Aba Análise: saúde, famílias com sinais, leilão e fila de decisões dos últimos 7 dias fechados. */
    analysis(accountId: string): Promise<AdsAnalysis> {
      return api('/api/ads/analysis', { query: { account_id: accountId } })
    },
    diagnosis(accountId: string, target: { family?: string; campaign_id?: number }): Promise<AdsDiagnosis> {
      return api('/api/ads/diagnosis', { query: { account_id: accountId, ...target } })
    },
    /** Marca um item da fila como feito ou ignorado. Só administradores. */
    decide(accountId: string, key: string, signal: string, status: 'feito' | 'ignorado'): Promise<AdsDecision> {
      return api('/api/ads/decisions', { method: 'POST', query: { account_id: accountId }, body: { key, signal, status } })
    },
    undecide(accountId: string, id: number): Promise<unknown> {
      return api(`/api/ads/decisions/${id}`, { method: 'DELETE', query: { account_id: accountId } })
    },
    sync(accountId: string): Promise<{ queued: boolean }> {
      return api('/api/ads/sync', { method: 'POST', query: { account_id: accountId } })
    }
  }
}

export type AdsClient = ReturnType<typeof createAdsClient>
