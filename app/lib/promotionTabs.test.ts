import { describe, expect, it } from 'vitest'
import { PROMO_TABS, chipCount, defaultChip, recentFailures, resolvePromoRoute, tabCount, tabOfStatus } from './promotionTabs'
import { canApplyBest, rowAction, statusBadge } from './promotionStatus'

/** Promoções no layout novo (27/11/2026): guias por tarefa, filtros em chips e links antigos. */
describe('guias de Promoções (layout novo)', () => {
  const counts = { para_revisar: 2, trocar: 14, sem_promocao: 17, abaixo_minima: 24, acima_maxima: 14, ok: 77, sem_custo: 11, revisar_ciente: 3, programado: 69, minima_inalcancavel: 12, nao_automatizados: 12, catalogo: 41, catalogo_perdendo: 12 }

  it('nenhuma situação da API ficou de fora: todas as 13 subguias antigas viraram um chip', () => {
    const chips = PROMO_TABS.flatMap((t) => t.chips.map((c) => c.value))
    for (const old of ['', 'trocar', 'sem_promocao', 'abaixo_minima', 'acima_maxima', 'ok', 'sem_custo', 'para_revisar', 'revisar_ciente', 'programado', 'minima_inalcancavel', 'nao_automatizados', 'catalogo']) {
      expect(chips).toContain(old)
    }
    expect(PROMO_TABS.map((t) => t.key)).toEqual(['decidir', 'automacao', 'todos', 'campanhas', 'historico'])
  })

  it('contadores: "Todos" soma as situações sem os recortes; "Decidir agora" soma o que pede decisão', () => {
    expect(chipCount(counts, '')).toBe(2 + 14 + 17 + 24 + 14 + 77 + 11 + 3 + 69 + 12)
    expect(chipCount(counts, 'catalogo')).toBe(41)
    expect(tabCount(counts, 'decidir')).toBe(2 + 14 + 17 + 24 + 14 + 11)
    expect(tabCount({ ...counts, baixar_alvo: 14 }, 'decidir')).toBe(2 + 14 + 14 + 17 + 24 + 14 + 11)
    expect(PROMO_TABS[0]!.chips.map((c) => c.value)).toContain('baixar_alvo')
    expect(tabCount(counts, 'automacao')).toBe(69 + 12)
    expect(tabCount(counts, 'campanhas')).toBeNull()
  })

  it('"Decidir agora" abre no primeiro filtro com anúncio (Para revisar antes de tudo)', () => {
    expect(defaultChip('decidir', counts)).toBe('para_revisar')
    expect(defaultChip('decidir', { ...counts, para_revisar: 0 })).toBe('trocar')
    expect(defaultChip('automacao', counts)).toBe('programado')
    expect(defaultChip('todos', counts)).toBe('')
  })

  it('endereços antigos continuam funcionando', () => {
    expect(resolvePromoRoute({})).toEqual({ tab: 'decidir', chip: null })
    expect(resolvePromoRoute({ aba: 'anuncios' })).toEqual({ tab: 'todos', chip: '' })
    expect(resolvePromoRoute({ aba: 'promocoes' })).toEqual({ tab: 'campanhas', chip: null })
    expect(resolvePromoRoute({ aba: 'rotina' })).toEqual({ tab: 'automacao', chip: 'rotina' })
    expect(resolvePromoRoute({ aba: 'historico' })).toEqual({ tab: 'historico', chip: null })
    expect(resolvePromoRoute({ status: 'programado' })).toEqual({ tab: 'automacao', chip: 'programado' })
    expect(resolvePromoRoute({ aba: 'anuncios', status: 'trocar' })).toEqual({ tab: 'decidir', chip: 'trocar' })
    expect(resolvePromoRoute({ aba: 'decidir', filtro: 'sem_custo' })).toEqual({ tab: 'decidir', chip: 'sem_custo' })
    expect(resolvePromoRoute({ aba: 'historico', filtro: 'falhou' })).toEqual({ tab: 'historico', chip: 'falhou' })
    expect(tabOfStatus('ok')).toBe('todos')
    expect(tabOfStatus('desconhecido')).toBe('todos')
  })

  it('recusas recentes: só a última recusa de cada anúncio nas 24 h, e só se não deu certo depois', () => {
    const now = new Date('2026-11-27T12:00:00Z')
    const actions = [
      { id: 5, item_id: 'A', ok: false, created_at: '2026-11-27T11:50:00Z' },
      { id: 4, item_id: 'A', ok: false, created_at: '2026-11-27T11:48:00Z' },
      { id: 3, item_id: 'B', ok: true, created_at: '2026-11-27T11:00:00Z' },
      { id: 2, item_id: 'B', ok: false, created_at: '2026-11-27T10:58:00Z' },
      { id: 1, item_id: 'C', ok: false, created_at: '2026-11-25T10:00:00Z' }
    ]
    expect(recentFailures(actions, now).map((a) => a.id)).toEqual([5])
  })
})

describe('linha de Promoções: selo e ação principal', () => {
  const row = (over: object = {}) => ({ manual: false, status: { key: 'trocar' }, best: { action: 'aderir' }, current: { valid: true }, gain: 1.5, review: null, ...over })

  it('"Aplicar melhor" só quando o painel também deixa (ganho positivo ou atual fora das regras)', () => {
    expect(rowAction(row(), true)).toBe('best')
    expect(rowAction(row({ gain: -0.32 }), true)).toBe('details')
    expect(rowAction(row({ gain: -0.32, current: { valid: false } }), true)).toBe('best')
    expect(canApplyBest(row({ best: { action: 'manter' } }))).toBe(false)
    expect(rowAction(row({ manual: true }), true)).toBe('details')
    // "Baixar preço até o alvo" (27/11/2026): ação própria, que não sugere ganho
    expect(rowAction(row({ status: { key: 'baixar_alvo' }, gain: -0.32 }), true)).toBe('lower')
    expect(rowAction(row({ status: { key: 'baixar_alvo' }, gain: -0.32, manual: true }), true)).toBe('details')
    expect(rowAction(row(), false)).toBe('details')
  })

  it('"Para revisar": cabível quando existe, senão revisar', () => {
    expect(rowAction(row({ status: { key: 'para_revisar' }, best: null, review: { fitting: {} } }), true)).toBe('fitting')
    expect(rowAction(row({ status: { key: 'para_revisar' }, best: null, review: { fitting: null } }), true)).toBe('review')
  })

  it('selo com cor e ícone pela situação; situação nova cai no tom da API', () => {
    expect(statusBadge({ key: 'para_revisar', tone: 'bad' }).cls).toBe('badge-danger')
    expect(statusBadge({ key: 'programado', tone: 'ok' }).cls).toBe('badge-accent')
    expect(statusBadge({ key: 'baixar_alvo', tone: 'neutral' }).cls).toBe('badge-info')
    expect(statusBadge({ key: 'nova', tone: 'warn' }).cls).toBe('badge-warning')
  })
})
