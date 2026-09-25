import { describe, expect, it } from 'vitest'
import { SUGGESTION_PRIORITY_CLASS, SUGGESTION_PRIORITY_LABEL } from './suggestionPriority'

describe('suggestionPriority', () => {
  it('mapeia as prioridades 1/2/3 para os rótulos certos', () => {
    expect(SUGGESTION_PRIORITY_LABEL[1]).toBe('Urgente')
    expect(SUGGESTION_PRIORITY_LABEL[2]).toBe('Importante')
    expect(SUGGESTION_PRIORITY_LABEL[3]).toBe('Sugestão')
  })

  it('usa danger-soft para urgente e warning-soft para importante', () => {
    expect(SUGGESTION_PRIORITY_CLASS[1]).toContain('danger-soft')
    expect(SUGGESTION_PRIORITY_CLASS[2]).toContain('warning-soft')
  })

  it('sugestão (prioridade 3) fica neutra, sem cor de alerta', () => {
    expect(SUGGESTION_PRIORITY_CLASS[3]).not.toContain('danger')
    expect(SUGGESTION_PRIORITY_CLASS[3]).not.toContain('warning')
  })
})
