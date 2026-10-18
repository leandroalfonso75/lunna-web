import { describe, expect, it, vi } from 'vitest'
import type { AdsItemsFilters, AdsRange } from '../types/ads'
import { buildAdsItemsQuery, createAdsClient, rangeQuery } from './adsClient'

const r30: AdsRange = { period: '30d', from: '', to: '' }

const base: AdsItemsFilters = { campaignId: '', status: '', flag: '', q: '', sort: 'cost', dir: 'desc', page: 1, perPage: 50 }

describe('rangeQuery', () => {
  it('atalhos (hoje, ontem, 7 dias…) mandam só o period', () => {
    expect(rangeQuery({ period: 'today', from: '', to: '' })).toEqual({ period: 'today' })
    expect(rangeQuery({ period: 'yesterday', from: '2026-01-01', to: '2026-01-02' })).toEqual({ period: 'yesterday' })
  })

  it('período personalizado manda as datas no lugar do period', () => {
    expect(rangeQuery({ period: 'custom', from: '2026-09-01', to: '2026-09-30' })).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('personalizado ainda sem as duas datas cai nos 30 dias', () => {
    expect(rangeQuery({ period: 'custom', from: '2026-09-01', to: '' })).toEqual({ period: '30d' })
  })
})

describe('buildAdsItemsQuery', () => {
  it('manda só o que foi escolhido', () => {
    expect(buildAdsItemsQuery('acc1', r30, base)).toEqual({
      account_id: 'acc1', period: '30d', sort: 'cost', dir: 'desc', page: '1', per_page: '50'
    })
  })

  it('inclui campanha, situação, sinal e busca (sem espaços nas pontas)', () => {
    const query = buildAdsItemsQuery('acc1', { period: '7d', from: '', to: '' }, { ...base, campaignId: '12', status: 'active', flag: 'sem_venda', q: ' batom ' })
    expect(query).toMatchObject({ campaign_id: '12', status: 'active', flag: 'sem_venda', q: 'batom', period: '7d' })
  })
})

describe('createAdsClient', () => {
  it('overview, items e sync usam as rotas de /api/ads', async () => {
    const api = vi.fn().mockResolvedValue({})
    const client = createAdsClient(api)

    await client.overview('acc1', { period: '90d', from: '', to: '' })
    expect(api).toHaveBeenLastCalledWith('/api/ads', { query: { account_id: 'acc1', period: '90d' }, signal: undefined })

    await client.items({ account_id: 'acc1' })
    expect(api).toHaveBeenLastCalledWith('/api/ads/items', { query: { account_id: 'acc1' }, signal: undefined })

    await client.sync('acc1')
    expect(api).toHaveBeenLastCalledWith('/api/ads/sync', { method: 'POST', query: { account_id: 'acc1' } })
  })
})
