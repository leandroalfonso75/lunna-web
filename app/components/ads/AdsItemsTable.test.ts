import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdsItemsTable from './AdsItemsTable.vue'
import type { AdsItemsResponse } from '../../types/ads'

/** Seção Ads (27/11/2026): vendas atribuídas pelo ML x vendas reais do anúncio, e o custo de Ads por venda real. */
function metrics(over: Record<string, unknown> = {}) {
  return { clicks: 98, prints: 54762, cost: 46.26, total_amount: 917.96, direct_amount: 0, indirect_amount: 0, units: 4, direct_units: 3, indirect_units: 1,
    organic_units: 0, organic_amount: 0, acos: 5.04, roas: 19.84, ctr: 0.18, cpc: 0.47, cvr: 4.08, real_units: 2, cost_per_real_sale: 23.13, ...over }
}

function response(over: Partial<AdsItemsResponse> = {}): AdsItemsResponse {
  return {
    window: '7d', live: false, live_error: false, daily: true, total: 1, page: 1, per_page: 50, sort: 'cost', dir: 'desc', flags: {},
    items: [{ item_id: 'MLB7410035586', title: 'Secador Gama 2100w', thumbnail: null, permalink: null, price: 279.7, status: 'active', status_label: 'Ativo',
      campaign: { id: 1, name: 'Curva A', status: 'active' }, listing_type: 'gold_special', logistic_type: 'fulfillment', catalog: false,
      buy_box_winner: null, recommended: null, has_discount: false, metrics: metrics(), flag: null }] as unknown as AdsItemsResponse['items'],
    totals: metrics() as unknown as AdsItemsResponse['totals'], ...over
  }
}

const filters = { campaignId: '', status: '', flag: '', q: '' } as never

describe('AdsItemsTable', () => {
  it('mostra vendas atribuídas pelo ML, vendas reais e o custo de Ads por venda real, com a explicação', () => {
    const w = mount(AdsItemsTable, { props: { response: response(), loading: false, filters, campaigns: [] } })

    expect(w.text()).toContain('Vendas atribuídas (ML)')
    expect(w.get('[data-test="item-qtde-com-ads"]').text()).toBe('4')
    expect(w.get('[data-test="item-vendas-reais"]').text()).toBe('2')
    expect(w.get('[data-test="item-ads-por-venda-real"]').text().replace(/\s/g, ' ')).toBe('R$ 23,13')
    expect(w.get('[data-test="ads-dica-atribuidas"]').text()).toContain('outros anúncios da mesma família, pedidos cancelados e compras indiretas')
    expect(w.get('[data-test="ads-dica-atribuidas"]').text()).toContain('o mesmo usado em Vendas')
    expect(w.text()).toContain('vendas reais 2')
  })

  it('anúncio sem venda real no período mostra "—" no custo por venda real', () => {
    const r = response()
    r.items[0]!.metrics = metrics({ real_units: 0, cost_per_real_sale: null }) as never
    const w = mount(AdsItemsTable, { props: { response: r, loading: false, filters, campaigns: [] } })

    expect(w.get('[data-test="item-vendas-reais"]').text()).toBe('0')
    expect(w.get('[data-test="item-ads-por-venda-real"]').text()).toBe('—')
  })
})
