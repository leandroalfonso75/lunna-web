import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `.tab-bar` é reusada por `/configuracoes`, `/anuncios` (abas de status) e
 * `/curva-abc` (abas de curva) — uma checagem estática do CSS compartilhado
 * garante o comportamento nas três sem depender de montar cada página.
 */
const TOKENS_PATH = join(dirname(fileURLToPath(import.meta.url)), 'tokens.css')
const source = readFileSync(TOKENS_PATH, 'utf-8')

function ruleBody(selector: string): string {
  const match = source.match(new RegExp(`${selector.replace(/[.]/g, '\\.')}\\s*{([^}]*)}`))
  return match?.[1] ?? ''
}

describe('.tab-bar (barra de abas rolável no celular)', () => {
  it('rola na horizontal em vez de quebrar as abas', () => {
    expect(ruleBody('.tab-bar')).toContain('overflow-x-auto')
  })

  it('usa scroll-snap para parar aba a aba ao rolar', () => {
    expect(ruleBody('.tab-bar')).toContain('snap-x')
    expect(ruleBody('.tab-bar')).toContain('snap-mandatory')
  })

  it('cada aba trava no snap e nunca quebra o texto em várias linhas', () => {
    const tab = ruleBody('.tab')
    expect(tab).toContain('snap-start')
    expect(tab).toContain('whitespace-nowrap')
  })
})
