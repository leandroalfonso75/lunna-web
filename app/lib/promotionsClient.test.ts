import { describe, expect, it, vi } from 'vitest'
import { buildPromotionsQuery, createPromotionsClient } from './promotionsClient'

describe('buildPromotionsQuery', () => {
  it('envia só os filtros escolhidos', () => {
    const base = { status: '', promotionId: '', q: '  ', sort: 'gain', dir: 'desc' as const, page: 1, perPage: 50 }
    expect(buildPromotionsQuery('acc1', base)).toEqual({ account_id: 'acc1', sort: 'gain', dir: 'desc', page: '1', per_page: '50' })
    expect(buildPromotionsQuery('acc1', { ...base, status: 'trocar', promotionId: 'C-1', q: ' gama ' })).toMatchObject({ status: 'trocar', promotion_id: 'C-1', q: 'gama' })
  })
})

describe('createPromotionsClient', () => {
  it('usa as rotas de /api/promotions', async () => {
    const api = vi.fn().mockResolvedValue({})
    const client = createPromotionsClient(api)

    await client.detail('acc1', 'MLB1')
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1', { query: { account_id: 'acc1' } })

    await client.saveSettings('acc1', 'MLB1', { min_margin_pct: ' 10 ', max_margin_pct: '', apply_to_sku: true })
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1/settings', {
      method: 'PATCH', query: { account_id: 'acc1' }, body: { min_margin_pct: '10', max_margin_pct: '', apply_to_sku: true }
    })

    await client.apply('acc1', 'MLB1')
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1/apply', { method: 'POST', query: { account_id: 'acc1' }, body: {} })

    await client.apply('acc1', 'MLB1', { promotion_id: null, promotion_type: 'PRICE_DISCOUNT', action: 'aderir' })
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1/apply', {
      method: 'POST', query: { account_id: 'acc1' }, body: { promotion_id: '', promotion_type: 'PRICE_DISCOUNT', action: 'aderir' }
    })

    await client.applyBest('acc1', ['MLB1', 'MLB2'])
    expect(api).toHaveBeenLastCalledWith('/api/promotions/apply_best', { method: 'POST', query: { account_id: 'acc1' }, body: { item_ids: ['MLB1', 'MLB2'] } })

    await client.export('acc1')
    expect(api).toHaveBeenLastCalledWith('/api/promotions/export', { query: { account_id: 'acc1' }, responseType: 'blob' })
  })
})
