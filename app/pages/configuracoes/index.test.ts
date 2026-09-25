import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `index.vue` usa vários auto-imports do Nuxt (`useSettings`, `useRoute`,
 * `navigateTo`...) — montá-lo de verdade pediria o runtime do Nuxt, que este
 * `vitest.config.ts` não carrega (mesmo padrão de `layouts/default.test.ts`).
 * Uma checagem estática do template garante a aba curta no celular.
 */
const PAGE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'index.vue')
const source = readFileSync(PAGE_PATH, 'utf-8')

describe('configuracoes/index.vue (abas com rótulo curto no celular)', () => {
  it('mostra o rótulo curto abaixo de sm e o completo a partir de sm', () => {
    expect(source).toContain('sm:hidden')
    expect(source).toContain('hidden sm:inline')
    expect(source).toContain('tabShortLabel(tab)')
    expect(source).toContain('tabLabel(tab)')
  })

  it('a barra usa a classe compartilhada tab-bar (rolável com scroll-snap)', () => {
    expect(source).toContain('class="tab-bar"')
  })
})
