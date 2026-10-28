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

    await client.saveSettings('acc1', 'MLB1', { limit_mode: 'price', min_margin_pct: '', max_margin_pct: '', min_price: ' 49.9 ', max_price: '', apply_to_sku: true, apply_to_variations: true, rules_note: ' sem relâmpago ' })
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1/settings', {
      method: 'PATCH',
      query: { account_id: 'acc1' },
      body: { limit_mode: 'price', min_margin_pct: '', max_margin_pct: '', min_price: '49.9', max_price: '', apply_to_sku: true, apply_to_variations: true, rules_note: 'sem relâmpago' }
    })

    // input type="number" com v-model entrega número
    await client.saveSettings('acc1', 'MLB1', { limit_mode: 'margin', min_margin_pct: 8, max_margin_pct: 12, min_price: '', max_price: '', apply_to_sku: false, apply_to_variations: false, rules_note: '' })
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1/settings', expect.objectContaining({
      body: expect.objectContaining({ min_margin_pct: '8', max_margin_pct: '12', min_price: '' })
    }))

    await client.apply('acc1', 'MLB1')
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1/apply', { method: 'POST', query: { account_id: 'acc1' }, body: {} })

    await client.apply('acc1', 'MLB1', { promotion_id: null, promotion_type: 'PRICE_DISCOUNT', action: 'aderir' })
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1/apply', {
      method: 'POST', query: { account_id: 'acc1' }, body: { promotion_id: '', promotion_type: 'PRICE_DISCOUNT', action: 'aderir' }
    })

    await client.apply('acc1', 'MLB1', { promotion_id: 'P-2', promotion_type: 'DEAL', action: 'aderir' }, { alsoSku: true, alsoVariations: false })
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1/apply', {
      method: 'POST', query: { account_id: 'acc1' }, body: { promotion_id: 'P-2', promotion_type: 'DEAL', action: 'aderir', also_sku: true }
    })

    await client.applyBest('acc1', ['MLB1', 'MLB2'])
    expect(api).toHaveBeenLastCalledWith('/api/promotions/apply_best', { method: 'POST', query: { account_id: 'acc1' }, body: { item_ids: ['MLB1', 'MLB2'] } })

    await client.setAutomation('acc1', 'MLB1', false, { sku: true, variations: false })
    expect(api).toHaveBeenLastCalledWith('/api/promotions/items/MLB1/automation', {
      method: 'PATCH', query: { account_id: 'acc1' }, body: { enabled: false, apply_to_sku: true, apply_to_variations: false }
    })

    await client.simulate('acc1')
    expect(api).toHaveBeenLastCalledWith('/api/promotions/runs', { method: 'POST', query: { account_id: 'acc1' } })

    await client.run('acc1', 7)
    expect(api).toHaveBeenLastCalledWith('/api/promotions/runs/7', { query: { account_id: 'acc1' } })

    await client.export('acc1')
    expect(api).toHaveBeenLastCalledWith('/api/promotions/export', { query: { account_id: 'acc1' }, responseType: 'blob' })
  })
})
