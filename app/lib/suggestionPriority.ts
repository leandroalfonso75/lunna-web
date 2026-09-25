import type { AbcSuggestion } from '../types/painel'

/**
 * Rótulo e cor do badge de prioridade das sugestões da Curva ABC (SPEC
 * §8.6 — a prioridade em si já vem pronta da API; isto é só apresentação).
 */
export const SUGGESTION_PRIORITY_LABEL: Record<AbcSuggestion['priority'], string> = {
  1: 'Urgente',
  2: 'Importante',
  3: 'Sugestão'
}

export const SUGGESTION_PRIORITY_CLASS: Record<AbcSuggestion['priority'], string> = {
  1: 'bg-danger-soft text-danger',
  2: 'bg-warning-soft text-warning',
  3: 'bg-surface-2 text-ink-2'
}
