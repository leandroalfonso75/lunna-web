import { describe, expect, it } from 'vitest'
import { brl, dateTimeShort, int, num, pct, pp, timeShort } from './format'

describe('brl', () => {
  it('formata em Real pt-BR', () => {
    expect(brl(1234.5)).toBe('R$ 1.234,50')
  })

  it('null/undefined viram travessão', () => {
    expect(brl(null)).toBe('—')
    expect(brl(undefined)).toBe('—')
  })

  it('zero é um valor válido, não "vazio"', () => {
    expect(brl(0)).toBe('R$ 0,00')
  })
})

describe('int', () => {
  it('separa milhar no padrão pt-BR', () => {
    expect(int(12345)).toBe('12.345')
  })

  it('null/undefined viram travessão', () => {
    expect(int(null)).toBe('—')
    expect(int(undefined)).toBe('—')
  })
})

describe('pct', () => {
  it('uma casa decimal com o símbolo %', () => {
    expect(pct(12.34)).toBe('12,3%')
  })

  it('null/undefined viram travessão', () => {
    expect(pct(null)).toBe('—')
  })
})

describe('pp', () => {
  it('uma casa decimal com o sufixo p.p.', () => {
    expect(pp(3.2)).toBe('3,2 p.p.')
  })

  it('null/undefined viram travessão', () => {
    expect(pp(undefined)).toBe('—')
  })
})

describe('num', () => {
  it('formata pt-BR com o número de casas pedido', () => {
    expect(num(1234.5, 2)).toBe('1.234,50')
    expect(num(1234.5, 0)).toBe('1.235')
  })

  it('null/undefined viram travessão', () => {
    expect(num(null, 2)).toBe('—')
  })
})

describe('dateTimeShort', () => {
  it('formata "DD/MM HH:MM" no fuso America/Sao_Paulo', () => {
    // 12:00 UTC = 09:00 em São Paulo (UTC-3, sem horário de verão).
    expect(dateTimeShort('2026-09-24T12:00:00Z')).toBe('24/09 09:00')
  })

  it('null/undefined/inválido viram travessão', () => {
    expect(dateTimeShort(null)).toBe('—')
    expect(dateTimeShort(undefined)).toBe('—')
    expect(dateTimeShort('não é uma data')).toBe('—')
  })
})

describe('timeShort', () => {
  it('formata "HH:MM" no fuso America/Sao_Paulo', () => {
    expect(timeShort('2026-09-24T12:05:00Z')).toBe('09:05')
  })

  it('null/undefined viram travessão', () => {
    expect(timeShort(null)).toBe('—')
    expect(timeShort(undefined)).toBe('—')
  })
})
