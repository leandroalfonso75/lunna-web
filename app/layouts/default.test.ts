import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `default.vue` usa vários composables auto-importados pelo Nuxt (`useAuth`,
 * `useRoute`, ...) sem import explícito — montá-lo de verdade pediria o
 * ambiente do Nuxt inteiro, que este `vitest.config.ts` não carrega. Uma
 * checagem estática do template é o que garante as regras de layout sem
 * esse peso (mesmo padrão do timeia).
 */
const LAYOUT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'default.vue')
const source = readFileSync(LAYOUT_PATH, 'utf-8')

describe('layouts/default.vue', () => {
  it('a navegação vira gaveta abaixo de md (767px) — barra desktop escondida com md:flex/md:hidden', () => {
    expect(source).toContain('md:flex')
    expect(source).toContain('md:hidden')
  })

  it('mostra Painel (/) e Configurações (/configuracoes) na navegação', () => {
    expect(source).toContain("{ to: '/', label: 'Painel' }")
    expect(source).toContain("{ to: '/configuracoes', label: 'Configurações' }")
  })

  it('o seletor de conta ML só aparece com pelo menos 1 conta', () => {
    expect(source).toContain('session.mlAccounts.length >= 1')
  })

  it('importa e usa o ThemeToggle', () => {
    expect(source).toContain("import ThemeToggle from '../components/ThemeToggle.vue'")
    expect(source).toContain('<ThemeToggle')
  })

  it('tem um botão "Sair" ligado a auth.logout()', () => {
    expect(source).toContain('const sair = () => auth.logout()')
    expect(source).toContain('@click="sair"')
  })

  it('mostra nome e empresa do usuário no menu', () => {
    expect(source).toContain('session.user?.name')
    expect(source).toContain('session.company?.name')
  })
})
