import { describe, expect, it } from 'vitest'
import { attentionItems, currentWindow, delta, deltaPp, greeting, moneyFlow, previousWindow } from './dashboard'
import { NAV_GROUPS, QUICK_ACTIONS, isActivePath, matches } from '../components/shell/navigation'

describe('dashboard (novo layout)', () => {
  it('período = últimos dias completos (até ontem) e o anterior do mesmo tamanho', () => {
    const today = new Date(2026, 10, 27, 9, 0)
    expect(currentWindow('7d', today)).toEqual({ from: '2026-11-20', to: '2026-11-26' })
    expect(previousWindow('7d', today)).toEqual({ from: '2026-11-13', to: '2026-11-19' })
    expect(currentWindow('30d', today)).toEqual({ from: '2026-10-28', to: '2026-11-26' })
    expect(previousWindow('30d', today)).toEqual({ from: '2026-09-28', to: '2026-10-27' })
  })

  it('variação contra o anterior: subir é bom ou ruim conforme o indicador; sem base, sem variação', () => {
    expect(delta(106.6, 100)).toEqual({ pct: 6.6, trend: 'up', good: true })
    expect(delta(80, 100, false)).toEqual({ pct: -20, trend: 'down', good: true }) // gastar menos em Ads é bom
    expect(delta(100.2, 100)).toEqual({ pct: 0.2, trend: 'flat', good: null })
    expect(delta(10, 0)).toBeNull()
    expect(deltaPp(7.4, 5.1)).toEqual({ pct: 2.3, trend: 'up', good: true })
  })

  it('para onde vai cada R$ 100: parcelas em % do faturamento, com o lucro (ou prejuízo) no fim', () => {
    const rows = moneyFlow({ revenue: 1000, orders: 10, units: 10, ticket: 100, fee: 120, shipping_cost: 130, tax: 110, fixed_expenses: 40, cost: 480, ads_cost: 30, net_profit_after_ads: 90, net_profit_after_ads_pct: 9 })
    expect(rows.map((r) => [r.key, r.share])).toEqual([['cost', 48], ['fee', 12], ['shipping', 13], ['tax', 11], ['fixed', 4], ['ads', 3], ['profit', 9]])
    expect(rows.at(-1)).toMatchObject({ label: 'Lucro pós Ads', kind: 'profit' })
    expect(moneyFlow({ revenue: 100, orders: 1, units: 1, ticket: 100, fee: 0, shipping_cost: 0, tax: 0, fixed_expenses: 0, cost: 120, ads_cost: 0, net_profit_after_ads: -20, net_profit_after_ads_pct: -20 }).at(-1)?.label).toBe('Prejuízo pós Ads')
    expect(moneyFlow(null)).toEqual([])
  })

  it('precisa da sua atenção: do mais urgente (atender cliente) ao que pode esperar, só o que tem número', () => {
    const items = attentionItems({
      attention: { claims: 1, questions: 3, messages: 0 },
      promotions: { below_min: 25, to_switch: 15, to_review: 0 },
      alerts: [{ key: 'low_coverage', title: 'Estoque para menos de 14 dias', description: '…', severity: 'warn', count: 7 }, { key: 'x', title: 'Zero', description: '', severity: 'info', count: 0 }]
    })
    expect(items.map((i) => i.key)).toEqual(['claims', 'questions', 'promo_below', 'alert_low_coverage', 'promo_switch'])
    expect(items.find((i) => i.key === 'alert_low_coverage')?.to).toBe('/estoque')
    expect(attentionItems({})).toEqual([])
  })

  it('saudação pelo horário', () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe('Bom dia')
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Boa tarde')
    expect(greeting(new Date(2026, 0, 1, 21))).toBe('Boa noite')
  })

  it('menu: todas as seções agrupadas, item ativo pelo caminho e busca sem acento', () => {
    const all = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.to))
    expect(all).toEqual(expect.arrayContaining(['/', '/vendas', '/anuncios', '/promocoes', '/ads', '/produtos', '/estoque', '/curva-abc', '/perguntas', '/mensagens', '/reclamacoes', '/financeiro', '/radar-ml']))
    expect(isActivePath('/produtos/ia/5', '/produtos')).toBe(true)
    expect(isActivePath('/vendas', '/')).toBe(false)
    expect(matches(NAV_GROUPS[1]!.items[3]!, 'publicidade')).toBe(true) // Ads
    expect(matches(QUICK_ACTIONS[0]!, 'criar produto')).toBe(true)
    expect(matches(NAV_GROUPS[2]!.items[0]!, 'reclamacao')).toBe(false)
  })
})
