import { describe, expect, it } from 'vitest'
import { buildGrid, compositionCost, importVariationsSheet, parseCsv, validGtin, variationsSheet, type Variation } from './catalogProducts'

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

  it('planilha das variações: o modelo já vem com as variações e a planilha preenchida volta para a grade', () => {
    const grid = buildGrid(['Cor'], { Cor: ['Azul', 'Verde', 'Preto'] }, [])
    const model = variationsSheet(['Cor'], grid)
    expect(model.charCodeAt(0)).toBe(0xfeff) // BOM: o Excel abre com acentos
    expect(parseCsv(model)).toEqual([['Cor', 'SKU', 'EAN', 'Preço', 'Estoque inicial'], ['Azul', '', '', '', ''], ['Verde', '', '', '', ''], ['Preto', '', '', '', '']])

    const filled = ['Cor;SKU;EAN;Preço;Estoque inicial', 'azul;CAM-AZ;7891234567895;129,90;5', 'Verde;CAM-VD;7891234567890;;', 'Amarelo;CAM-AM;;1.299,90;2', ''].join('\r\n')
    const res = importVariationsSheet(filled, ['Cor'], grid)
    expect(res.updated).toBe(2)
    expect(res.added).toBe(1)
    expect(res.variations.find((v) => v.attrs.Cor === 'Azul')).toMatchObject({ sku: 'CAM-AZ', gtin: '7891234567895', price: 129.9, stock: 5 })
    expect(res.variations.find((v) => v.attrs.Cor === 'Amarelo')).toMatchObject({ sku: 'CAM-AM', price: 1299.9, stock: 2 })
    expect(res.problems).toEqual(['Linha 3: EAN 7891234567890 inválido (dígito verificador).'])
  })

  it('planilha com vírgula e aspas também é lida', () => {
    expect(parseCsv('Cor,SKU\n"Azul, claro","A-1"\n')).toEqual([['Cor', 'SKU'], ['Azul, claro', 'A-1']])
  })

  it('planilha sem as colunas do modelo é recusada', () => {
    const res = importVariationsSheet('Nome,Valor\nx,1', ['Cor'], [])
    expect(res.problems[0]).toContain('Faltam as colunas: Cor, SKU, EAN')
  })
})
