import { describe, expect, it, vi } from 'vitest'
import type { AdsItemsFilters } from '../types/ads'
import { buildAdsItemsQuery, createAdsClient } from './adsClient'

const base: AdsItemsFilters = { campaignId: '', status: '', flag: '', q: '', sort: 'cost', dir: 'desc', page: 1, perPage: 50 }

describe('buildAdsItemsQuery', () => {
  it('manda só o que foi escolhido', () => {
    expect(buildAdsItemsQuery('acc1', '30d', base)).toEqual({
      account_id: 'acc1', period: '30d', sort: 'cost', dir: 'desc', page: '1', per_page: '50'
    })
  })

  it('inclui campanha, situação, sinal e busca (sem espaços nas pontas)', () => {
    const query = buildAdsItemsQuery('acc1', '7d', { ...base, campaignId: '12', status: 'active', flag: 'sem_venda', q: ' batom ' })
    expect(query).toMatchObject({ campaign_id: '12', status: 'active', flag: 'sem_venda', q: 'batom', period: '7d' })
  })
})

describe('createAdsClient', () => {
  it('overview, items e sync usam as rotas de /api/ads', async () => {
    const api = vi.fn().mockResolvedValue({})
    const client = createAdsClient(api)

    await client.overview('acc1', '90d')
    expect(api).toHaveBeenLastCalledWith('/api/ads', { query: { account_id: 'acc1', period: '90d' }, signal: undefined })

    await client.items({ account_id: 'acc1' })
    expect(api).toHaveBeenLastCalledWith('/api/ads/items', { query: { account_id: 'acc1' }, signal: undefined })

    await client.sync('acc1')
    expect(api).toHaveBeenLastCalledWith('/api/ads/sync', { method: 'POST', query: { account_id: 'acc1' } })
  })
})
