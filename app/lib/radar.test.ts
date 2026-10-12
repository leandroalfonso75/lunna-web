import { describe, expect, it } from 'vitest'
import {
  buildIndex, categoryLevels, childrenOf, pickCategory, defaultFilters, effectiveDays, filterItems, formatDay, splitBold, summarize, toTsv,
  type RadarData
} from './radar'

// ref = dia 1000. Itens: 1 catálogo recente e barato, 2 tradicional antigo caro, 3 tradicional recente sem nota.
const data: RadarData = {
  ref: 1000,
  note: 'Texto <b>negrito</b> fim',
  sellerNote: '',
  root: 'R',
  cats: [['R', 'Beleza', null], ['A', 'Perfumes', 'R'], ['B', 'Cabelo', 'R'], ['A1', 'Femininos', 'A']],
  sellers: ['Loja Ótima', 'Outra'],
  brands: ['Ruby Rose', 'Payot'],
  topSellers: [],
  topBrands: [],
  items: [
    [1, 'Batom', 'B', 1, 0, 0, 990, 100, 20, 48],
    [2, 'Perfume Chique', 'A1', 0, 1, 1, 700, 3000, 200, 40],
    [3, 'Shampoo', 'B', 0, -1, -1, 950, 0, 30, 0]
  ]
}
const index = buildIndex(data, ['Beleza > Perfumes > Femininos', 'Beleza > Perfumes > Masculinos', 'Pet Shop > Rações'])

describe('buildIndex', () => {
  it('calcula receita, média mensal e nota', () => {
    const batom = index.items[0]!
    expect(batom.revenue).toBe(2000)
    expect(batom.rating).toBe(4.8)
    expect(batom.monthlyAvg).toBeCloseTo(100 / Math.max(10 / 30.4375, 1))
    expect(index.items[2]!.rating).toBeNull()
  })

  it('conta anúncios por categoria, incluindo ancestrais', () => {
    expect(index.tree['Beleza']!.count).toBe(3)
    expect(index.tree['Beleza > Perfumes']!.count).toBe(1)
    expect(index.tree['Beleza > Perfumes > Femininos']!.count).toBe(1)
  })

  it('inclui categorias da lista do ML mesmo sem anúncios na base', () => {
    expect(index.roots).toEqual(['Beleza', 'Pet Shop'])
    expect(index.tree['Pet Shop > Rações']!.count).toBe(0)
    expect(childrenOf(index, 'Beleza > Perfumes').map((c) => c.name)).toEqual(['Femininos', 'Masculinos'])
  })

  it('lista filhos em ordem alfabética', () => {
    expect(childrenOf(index, 'Beleza').map((c) => c.name)).toEqual(['Cabelo', 'Perfumes'])
  })

  it('monta os seletores em cascata e volta um nível ao limpar', () => {
    const levels = categoryLevels(index, 'Beleza > Perfumes')
    expect(levels.map((l) => l.value)).toEqual(['Beleza', 'Beleza > Perfumes', ''])
    expect(pickCategory('Beleza > Perfumes', 1, '')).toBe('Beleza')
    expect(pickCategory('Beleza > Perfumes', 0, '')).toBe('')
    expect(pickCategory('Beleza', 1, 'Beleza > Cabelo')).toBe('Beleza > Cabelo')
  })
})

describe('filterItems', () => {
  const ids = (f = defaultFilters()) => filterItems(index, f).map((i) => i.id)

  it('período padrão de 180 dias exclui o anúncio antigo', () => {
    expect(ids()).toEqual([1, 3])
    expect(ids({ ...defaultFilters(), period: 0 })).toEqual([2, 1, 3])
  })

  it('"últimos N dias" personalizado vale mais que os botões', () => {
    const f = { ...defaultFilters(), period: 0, customDays: '60' }
    expect(effectiveDays(f)).toBe(60)
    expect(ids(f)).toEqual([1, 3])
  })

  it('30 dias traz criados há até 30 dias e exclui os de 31 dias ou mais', () => {
    const d: RadarData = { ...data, items: [[10, 'A', 'B', 0, -1, -1, 970, 1, 10, 0], [11, 'B', 'B', 0, -1, -1, 969, 1, 10, 0]] }
    const idx = buildIndex(d)
    expect(filterItems(idx, { ...defaultFilters(), period: 30 }).map((i) => i.id)).toEqual([10])
  })

  it('filtra por categoria (inclui descendentes)', () => {
    expect(ids({ ...defaultFilters(), period: 0, category: 'Beleza > Perfumes' })).toEqual([2])
    expect(ids({ ...defaultFilters(), period: 0, category: 'Pet Shop' })).toEqual([])
  })

  it('catálogo: apenas, excluir e abas de tipo', () => {
    expect(ids({ ...defaultFilters(), catalog: 'only' })).toEqual([1])
    expect(ids({ ...defaultFilters(), catalog: 'excl' })).toEqual([3])
    expect(ids({ ...defaultFilters(), type: 'tra' })).toEqual([3])
  })

  it('vendedor e marca ignoram acento e caixa', () => {
    expect(ids({ ...defaultFilters(), seller: 'otima' })).toEqual([1])
    expect(ids({ ...defaultFilters(), period: 0, brand: 'PAYOT' })).toEqual([2])
  })

  it('faixas de preço, vendas e receita', () => {
    expect(ids({ ...defaultFilters(), period: 0, priceMin: '25' })).toEqual([2, 3])
    expect(ids({ ...defaultFilters(), period: 0, soldMin: '100', soldMax: '100' })).toEqual([1])
    expect(ids({ ...defaultFilters(), period: 0, revMin: '1000', revMax: '5000' })).toEqual([1])
  })

  it('avaliação mínima e "sem avaliação"', () => {
    expect(ids({ ...defaultFilters(), rating: '4.5' })).toEqual([1])
    expect(ids({ ...defaultFilters(), rating: 'none' })).toEqual([3])
  })

  it('ordena por menor preço', () => {
    expect(ids({ ...defaultFilters(), period: 0, sort: 'price_a' })).toEqual([1, 3, 2])
  })
})

describe('apoio', () => {
  it('resume o resultado', () => {
    const s = summarize(index.items)
    expect(s).toMatchObject({ total: 3, catalog: 1, traditional: 2, sold: 3100, revenue: 602000 })
    expect(s.medianPrice).toBe(30)
  })

  it('formata o dia em dd/mm/aaaa', () => {
    expect(formatDay(20719)).toBe('23/09/2026')
  })

  it('separa trechos em negrito sem HTML', () => {
    expect(splitBold('a <b>b</b> c<i>d</i>')).toEqual([
      { text: 'a ', bold: false }, { text: 'b', bold: true }, { text: ' cd', bold: false }
    ])
  })

  it('gera TSV com cabeçalho e link', () => {
    const lines = toTsv(index.items).split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain('MLB1')
    expect(lines[1]).toContain('https://produto.mercadolivre.com.br/MLB-1-_JM')
  })
})
