import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PromoRowNovo from './PromoRowNovo.vue'
import type { PromotionItemRow } from '../../../types/promotions'

/** Linha de Promoções do layout novo: ação principal visível, sem aplicar nada direto (só pede a confirmação do painel). */
function makeRow(over: Partial<PromotionItemRow> = {}): PromotionItemRow {
  const offer = { promotion_id: 'P1', type: 'SELLER_CAMPAIGN', label: 'Campanha do vendedor', name: 'Campanha X', status: 'started', price: 90, margin_pct: 12, profit: 10.8, profit_before_ads: 12, margin_before_ads_pct: 13, meli_amount: 0, valid: true, reason: null, start_date: null, finish_date: null, action: 'aderir' as const }
  return {
    item_id: 'MLB1', title: 'Produto teste', sku: 'SKU1', thumbnail: null, permalink: null, listing_type: 'gold_special', logistic_type: null, stock: 5,
    catalog: null, synced_with_catalog: false, sold_total: 10, sold_30d: 2, catalog_info: null, full_price: 100, cost: 50,
    base: null, ads: { spend: 0, units: 0, unit: 0, days: 15 }, current: { ...offer, name: 'Atual', price: 95, margin_pct: 10, profit: 9.5, action: 'manter' }, best: offer, gain: 1.3, offers_count: 2,
    settings: { limit_mode: 'margin', min_margin_pct: null, max_margin_pct: null, min_price: null, max_price: null, apply_to_sku: false, apply_to_variations: false, rules_note: null, automation_enabled: true, effective_min_pct: 9, effective_max_pct: 15 },
    status: { key: 'trocar', label: 'Trocar por melhor', tone: 'warn' }, review: null, manual: false, notes: null, review_dismissed: false,
    ...over
  } as PromotionItemRow
}

describe('PromoRowNovo', () => {
  it('troca que rende mais: botão "Aplicar melhor" visível, ganho em verde e selo com texto', async () => {
    const w = mount(PromoRowNovo, { props: { row: makeRow(), isAdmin: true, checked: false, selected: false } })
    expect(w.get('[data-test="linha-aplicar-melhor"]').text()).toContain('Aplicar melhor')
    expect(w.text()).toContain('+R$')
    expect(w.text()).toContain('Trocar por melhor')
    await w.get('[data-test="linha-aplicar-melhor"]').trigger('click')
    expect(w.emitted('act')?.[0]).toEqual(['best'])
    expect(w.emitted('toggle')).toBeUndefined()
  })

  it('aplicando: o botão gira e fica desabilitado', () => {
    const w = mount(PromoRowNovo, { props: { row: makeRow(), isAdmin: true, checked: false, selected: true, busy: true } })
    const b = w.get('[data-test="linha-aplicar-melhor"]')
    expect(b.text()).toContain('Aplicando')
    expect(b.attributes('disabled')).toBeDefined()
  })

  it('para revisar com oferta cabível: "Aplicar cabível" e "Ciente"', async () => {
    const fitting = { ...makeRow().best!, name: 'Desconto próprio', price: 88, soft_reason: null }
    const w = mount(PromoRowNovo, { props: { row: makeRow({ status: { key: 'para_revisar', label: 'Para revisar', tone: 'bad' }, best: null, gain: null, review: { current_reason: null, reasons: [], label: 'abaixo da mínima', blocked_best: null, fitting, suggestion: null, suggested: null } as never }), isAdmin: true, checked: false, selected: false } })
    await w.get('[data-test="linha-aplicar-cabivel"]').trigger('click')
    expect(w.emitted('act')?.[0]).toEqual(['fitting'])
    await w.get('[data-test="ciente"]').trigger('click')
    expect(w.emitted('review')?.[0]).toEqual([true])
  })

  it('quem não é administrador só vê "Detalhes"', () => {
    const w = mount(PromoRowNovo, { props: { row: makeRow(), isAdmin: false, checked: false, selected: false } })
    expect(w.find('[data-test="linha-aplicar-melhor"]').exists()).toBe(false)
    expect(w.get('[data-test="linha-detalhes"]').text()).toContain('Detalhes')
  })
})
