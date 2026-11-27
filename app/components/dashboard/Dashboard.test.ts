import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AttentionStrip from './AttentionStrip.vue'
import KpiTile from './KpiTile.vue'
import MoneyFlow from './MoneyFlow.vue'

/** Novo layout (27/11/2026): cartões de indicador, "Precisa da sua atenção" e "Para onde vai cada R$ 100 vendido". */
vi.stubGlobal('resolveComponent', () => 'a')
const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

describe('KpiTile', () => {
  it('mostra valor, variação com seta e texto (verde quando é bom) e o detalhe', () => {
    const w = mount(KpiTile, { props: { label: 'Faturamento', value: 'R$ 56.068,71', delta: { pct: 6.6, trend: 'up', good: true }, hint: 'vs. período anterior', spark: [1, 2, 3] } })
    expect(w.get('[data-test="kpi-valor"]').text()).toBe('R$ 56.068,71')
    expect(w.get('[data-test="kpi-variacao"]').text()).toBe('+6,6%')
    expect(w.get('[data-test="kpi-variacao"]').classes()).toContain('delta-up')
    expect(w.text()).toContain('vs. período anterior')
  })

  it('custo que sobe é ruim (vermelho) e "estável" fica neutro', () => {
    const up = mount(KpiTile, { props: { label: 'Ads', value: 'R$ 10', delta: { pct: 20, trend: 'up', good: false } } })
    expect(up.get('[data-test="kpi-variacao"]').classes()).toContain('delta-down')
    const flat = mount(KpiTile, { props: { label: 'X', value: '1', delta: { pct: 0.2, trend: 'flat', good: null } } })
    expect(flat.get('[data-test="kpi-variacao"]').classes()).toContain('delta-flat')
  })
})

describe('AttentionStrip', () => {
  const item = (i: number) => ({ key: `k${i}`, label: `Item ${i}`, detail: 'porque', count: i, to: '/x', tone: 'warning' as const })

  it('sem pendências mostra "Tudo em dia"', () => {
    const w = mount(AttentionStrip, { props: { items: [] }, global: { stubs: { NuxtLink } } })
    expect(w.get('[data-test="atencao-em-dia"]').text()).toContain('Tudo em dia')
  })

  it('mostra os 4 mais urgentes e o resto em "Ver mais"', async () => {
    const w = mount(AttentionStrip, { props: { items: [1, 2, 3, 4, 5, 6].map(item) }, global: { stubs: { NuxtLink } } })
    expect(w.findAll('[data-test="atencao-item"]')).toHaveLength(4)
    expect(w.get('[data-test="atencao-mais"]').text()).toBe('Ver mais 2')
    await w.get('[data-test="atencao-mais"]').trigger('click')
    expect(w.findAll('[data-test="atencao-item"]')).toHaveLength(6)
  })
})

describe('MoneyFlow', () => {
  it('lista as parcelas com % e R$, com o lucro em destaque', () => {
    const w = mount(MoneyFlow, { props: { revenue: 1000, rows: [{ key: 'cost', label: 'Custo dos produtos', value: 480, share: 48, kind: 'cost' }, { key: 'profit', label: 'Lucro pós Ads', value: 90, share: 9, kind: 'profit' }] } })
    expect(w.text().replace(/\s/g, '')).toContain('Custodosprodutos48,0%R$480,00')
    expect(w.text()).toContain('Lucro pós Ads')
  })
})
