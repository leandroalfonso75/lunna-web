import { describe, expect, it } from 'vitest'
import { buildGrid, compositionCost, validGtin, type Variation } from './catalogProducts'

describe('catalogProducts', () => {
  it('valida o dígito verificador do EAN', () => {
    expect(validGtin('7891234567895')).toBe(true)
    expect(validGtin('7891234567890')).toBe(false)
    expect(validGtin('96385074')).toBe(true) // EAN-8
    expect(validGtin('abc')).toBe(false)
  })

  it('monta a grade com todas as combinações e mantém SKU/EAN das linhas que já existiam', () => {
    const current: Variation[] = [{ key: 'a', attrs: { Cor: 'Vermelho', Tamanho: 'P' }, sku: 'CAM-V-P', gtin: null, price: null, stock: 3, kit: false, components: [] }]
    const grid = buildGrid(['Cor', 'Tamanho'], { Cor: ['Vermelho', ' Preto '], Tamanho: ['P', 'M', ''] }, current)

    expect(grid.map((v) => `${v.attrs.Cor}/${v.attrs.Tamanho}`)).toEqual(['Vermelho/P', 'Vermelho/M', 'Preto/P', 'Preto/M'])
    expect(grid[0]).toMatchObject({ key: 'a', sku: 'CAM-V-P', stock: 3 })
    expect(buildGrid(['Cor'], { Cor: [] }, current)).toBe(current) // eixo sem valores: não mexe
  })

  it('soma o custo da composição só quando todos os SKUs têm custo', () => {
    const info = { A: { name: 'A', cost: 10, price: null, gtin: null }, B: { name: 'B', cost: 2.5, price: null, gtin: null }, C: { name: 'C', cost: null, price: null, gtin: null } }
    expect(compositionCost([{ sku: 'A', quantity: 1 }, { sku: 'B', quantity: 2 }], info)).toBe(15)
    expect(compositionCost([{ sku: 'A', quantity: 1 }, { sku: 'C', quantity: 1 }], info)).toBeNull()
    expect(compositionCost([], info)).toBeNull()
  })
})
