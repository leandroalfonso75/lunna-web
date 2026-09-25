import { describe, expect, it } from 'vitest'
import { buildItemsQuery, nextSort, type ItemsControlsState } from './itemsQuery'

function baseState(overrides: Partial<ItemsControlsState> = {}): ItemsControlsState {
  return {
    status: 'active',
    alert: null,
    q: '',
    type: '',
    shipping: '',
    id: null,
    titleFilter: '',
    skuFilter: '',
    numericFilters: {},
    sort: 'units_7d',
    dir: null,
    page: 1,
    perPage: 50,
    ...overrides
  }
}

describe('buildItemsQuery', () => {
  it('estado padrão: account_id, status e page, sem mais nada', () => {
    expect(buildItemsQuery('acc1', baseState())).toEqual({
      account_id: 'acc1',
      status: 'active',
      sort: 'units_7d',
      page: '1',
      per_page: '50'
    })
  })

  it('com id preenchido, ignora todos os demais filtros (SPEC 10.4)', () => {
    const state = baseState({ id: 'MLB123', status: 'paused', q: 'furadeira', alert: 'nostock', sort: 'title' })
    expect(buildItemsQuery('acc1', state)).toEqual({ account_id: 'acc1', id: 'MLB123' })
  })

  it('omite q, type, shipping e alert quando vazios', () => {
    const params = buildItemsQuery('acc1', baseState())
    expect(params.q).toBeUndefined()
    expect(params.type).toBeUndefined()
    expect(params.shipping).toBeUndefined()
    expect(params.alert).toBeUndefined()
  })

  it('inclui q (com trim), type, shipping e alert quando preenchidos', () => {
    const state = baseState({ q: '  furadeira  ', type: 'P', shipping: 'full', alert: 'nostock' })
    const params = buildItemsQuery('acc1', state)
    expect(params.q).toBe('furadeira')
    expect(params.type).toBe('P')
    expect(params.shipping).toBe('full')
    expect(params.alert).toBe('nostock')
  })

  it('monta f[title] e f[sku] a partir dos filtros de coluna, com trim', () => {
    const state = baseState({ titleFilter: ' parafusadeira ', skuFilter: 'sem sku' })
    const params = buildItemsQuery('acc1', state)
    expect(params['f[title]']).toBe('parafusadeira')
    expect(params['f[sku]']).toBe('sem sku')
  })

  it('monta f[<coluna>] para cada filtro numérico preenchido, omitindo os vazios', () => {
    const state = baseState({ numericFilters: { price: '>50', stock: '', coverage_days: '<14' } })
    const params = buildItemsQuery('acc1', state)
    expect(params['f[price]']).toBe('>50')
    expect(params['f[coverage_days]']).toBe('<14')
    expect(params['f[stock]']).toBeUndefined()
  })

  it('não manda dir quando ainda não há um clique de segunda vez na mesma coluna', () => {
    const params = buildItemsQuery('acc1', baseState({ sort: 'revenue_7d', dir: null }))
    expect(params.sort).toBe('revenue_7d')
    expect(params.dir).toBeUndefined()
  })

  it('manda dir quando o estado já tem uma direção explícita', () => {
    const params = buildItemsQuery('acc1', baseState({ sort: 'revenue_7d', dir: 'asc' }))
    expect(params.dir).toBe('asc')
  })

  it('manda a página pedida', () => {
    expect(buildItemsQuery('acc1', baseState({ page: 3 })).page).toBe('3')
  })

  it('não inventa nenhuma regra: valores passam direto, sem validação de formato', () => {
    const params = buildItemsQuery('acc1', baseState({ numericFilters: { price: 'isso não é uma expressão válida' } }))
    expect(params['f[price]']).toBe('isso não é uma expressão válida')
  })
})

describe('nextSort', () => {
  it('primeiro clique (sem resposta efetiva ainda): manda só a coluna, sem dir', () => {
    expect(nextSort(null, 'revenue_7d')).toEqual({ sort: 'revenue_7d', dir: null })
  })

  it('clicar numa coluna diferente da ativa reseta (sem dir)', () => {
    expect(nextSort({ sort: 'units_7d', dir: 'desc' }, 'revenue_7d')).toEqual({ sort: 'revenue_7d', dir: null })
  })

  it('segundo clique na mesma coluna inverte o dir efetivo devolvido pela API (desc -> asc)', () => {
    expect(nextSort({ sort: 'units_7d', dir: 'desc' }, 'units_7d')).toEqual({ sort: 'units_7d', dir: 'asc' })
  })

  it('segundo clique na mesma coluna inverte o dir efetivo devolvido pela API (asc -> desc)', () => {
    expect(nextSort({ sort: 'title', dir: 'asc' }, 'title')).toEqual({ sort: 'title', dir: 'desc' })
  })
})
