import { describe, expect, it } from 'vitest'
import { promotionValidity } from './promotionValidity'

describe('promotionValidity', () => {
  it('mostra início e término no fuso de São Paulo', () => {
    const o = { type: 'DEAL', action: 'manter', start_date: '2026-10-28T03:00:00Z', finish_date: '2026-11-30T23:00:00Z' }
    expect(promotionValidity(o)).toBe('28/10 00:00 até 30/11 20:00')
    expect(promotionValidity(o, true)).toBe('28/10 até 30/11')
  })

  it('desconto próprio a criar vale 30 dias a partir de quando aplicar', () => {
    expect(promotionValidity({ type: 'PRICE_DISCOUNT', action: 'aderir', start_date: null, finish_date: null })).toBe('30 dias a partir de quando aplicar')
  })

  it('relâmpago candidato: o ML marca o horário depois', () => {
    expect(promotionValidity({ type: 'LIGHTNING', action: 'aderir', start_date: null, finish_date: null })).toBe('horário definido pelo ML ao entrar')
  })

  it('sem datas', () => {
    expect(promotionValidity({ type: 'SMART', start_date: null, finish_date: null })).toBe('sem data de término')
    expect(promotionValidity(null)).toBe('')
  })
})
