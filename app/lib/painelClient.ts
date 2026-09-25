import type { AbcItemDetail, AbcResponse, CurveFilter, ItemsResponse, PainelResponse } from '../types/painel'

type ApiFn = (path: string, options?: Record<string, unknown>) => Promise<any>

export interface RequestOptions {
  signal?: AbortSignal
}

/**
 * Fábrica pura das leituras do painel (`GET /api/painel`, `/api/items`,
 * `/api/abc`, `/api/abc/items/:id`). Livre de composables do Nuxt para dar
 * para testar direto contra `$api` (ver painelClient.test.ts) — os
 * composables (`usePainel`, `useItemsTable`, `useAbc`) só conectam isto ao
 * `$api` real e ao estado reativo da tela.
 *
 * `getItems` recebe os params JÁ montados por `lib/itemsQuery.ts` (que
 * inclui `account_id`) — as outras três leituras montam a própria query
 * mínima aqui mesmo.
 */
export function createPainelClient(api: ApiFn) {
  return {
    getPainel(accountId: string, options: RequestOptions = {}): Promise<PainelResponse> {
      return api('/api/painel', { query: { account_id: accountId }, signal: options.signal })
    },

    getItems(params: Record<string, string>, options: RequestOptions = {}): Promise<ItemsResponse> {
      return api('/api/items', { query: params, signal: options.signal })
    },

    getAbc(accountId: string, curve: CurveFilter = 'all', options: RequestOptions = {}): Promise<AbcResponse> {
      return api('/api/abc', { query: { account_id: accountId, curve }, signal: options.signal })
    },

    getAbcItem(accountId: string, itemId: string, options: RequestOptions = {}): Promise<AbcItemDetail> {
      return api(`/api/abc/items/${itemId}`, { query: { account_id: accountId }, signal: options.signal })
    }
  }
}

export type PainelClient = ReturnType<typeof createPainelClient>
