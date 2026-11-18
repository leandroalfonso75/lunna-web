import { describe, expect, it } from 'vitest'
import type { PromotionGroupRow, PromotionItemRow, PromotionsResponse } from '../types/promotions'
import { markReviewDismissed } from './promotionReview'

const item = (id: string, extra: Partial<PromotionItemRow> = {}) =>
  ({ item_id: id, status: { key: 'para_revisar', label: 'Para revisar', tone: 'bad' }, manual: false, review_dismissed: false, ...extra }) as PromotionItemRow
const group = (key: string, children: PromotionItemRow[]) => ({ group: true, key, item_id: children[0]?.item_id, count: 5, matched: children.length, children }) as unknown as PromotionGroupRow

function response(items: PromotionsResponse['items'], counts: Record<string, number> = { para_revisar: 4, revisar_ciente: 1 }): PromotionsResponse {
  return { items, counts, total: items.length, summary: { to_review: counts.para_revisar }, page: 1, per_page: 50 } as unknown as PromotionsResponse
}

describe('markReviewDismissed', () => {
  it('Ciente em "Para revisar": a linha some e as contagens e o card caem na hora', () => {
    const res = response([item('A'), item('B')])
    const out = markReviewDismissed(res, 'A', true, 'para_revisar')
    expect(out.removed).toBe(true)
    expect(out.response.items.map((r) => r.item_id)).toEqual(['B'])
    expect(out.response.total).toBe(1)
    expect(out.response.counts).toMatchObject({ para_revisar: 3, revisar_ciente: 2 })
    expect(out.response.summary.to_review).toBe(3)
    expect(res.items).toHaveLength(2) // não mexe na resposta original
  })

  it('dentro de um produto com variações: sai do grupo; o grupo vazio some', () => {
    const res = response([group('g1', [item('A'), item('B')]), group('g2', [item('C')])])
    let out = markReviewDismissed(res, 'A', true, 'para_revisar')
    const g1 = out.response.items[0] as PromotionGroupRow
    expect(g1.children.map((c) => c.item_id)).toEqual(['B'])
    expect(g1.matched).toBe(1)
    out = markReviewDismissed(out.response, 'C', true, 'para_revisar')
    expect(out.response.items.map((r) => ('group' in r ? r.key : r.item_id))).toEqual(['g1'])
    expect(out.response.total).toBe(1)
  })

  it('ação que já tirou o anúncio da revisão: sai da lista, mas não conta em "Ciente"', () => {
    const out = markReviewDismissed(response([item('A')]), 'A', true, 'para_revisar', false)
    expect(out.removed).toBe(true)
    expect(out.response.counts).toMatchObject({ para_revisar: 3, revisar_ciente: 1 })
  })

  it('"Voltar para revisar" na guia Ciente: sai de lá e volta à contagem de "Para revisar"', () => {
    const out = markReviewDismissed(response([item('A', { review_dismissed: true })]), 'A', false, 'revisar_ciente')
    expect(out.removed).toBe(true)
    expect(out.response.counts).toMatchObject({ para_revisar: 5, revisar_ciente: 0 })
    expect(out.response.summary.to_review).toBe(5)
  })

  it('em "Todos" a linha fica, só muda a marca', () => {
    const out = markReviewDismissed(response([item('A')]), 'A', true, '')
    expect(out.removed).toBe(false)
    expect((out.response.items[0] as PromotionItemRow).review_dismissed).toBe(true)
    expect(out.response.counts.para_revisar).toBe(3)
  })

  it('anúncio fora da lista, fora da revisão ou não automatizado: nada muda', () => {
    const res = response([item('A', { status: { key: 'ok', label: 'Na melhor', tone: 'ok' } }), item('B', { manual: true })])
    for (const id of ['A', 'B', 'Z']) {
      const out = markReviewDismissed(res, id, true, 'para_revisar')
      expect(out).toEqual({ response: res, removed: false })
    }
  })
})
