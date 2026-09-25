import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `AbcTable.vue` chama `useAbc()` direto (sem prop de injeção) — montá-lo de
 * verdade pediria mocks pesados de `$api`/Pinia para todo o composable só
 * para checar um `<p>` de texto. Uma checagem estática do template garante
 * que o notice da API (SPEC §8.4/§10.5) aparece uma única vez, sem repetir
 * "Detalhes carregados..." como um segundo aviso hardcoded no front.
 */
const PATH = join(dirname(fileURLToPath(import.meta.url)), 'AbcTable.vue')
const source = readFileSync(PATH, 'utf-8')

describe('AbcTable.vue (notice único da Curva ABC)', () => {
  it('não hardcoda mais um segundo aviso de "Detalhes carregados..." (isso já vem em data.notice)', () => {
    expect(source).not.toContain('Detalhes carregados para')
  })

  it('mostra data.notice em um único banner informativo', () => {
    const bannerBlocks = source.split('role="status"').length - 1
    // stale banner + notice banner — nunca um terceiro/duplicado para o mesmo aviso.
    expect(source).toContain('v-if="data?.notice"')
    expect(bannerBlocks).toBe(2)
  })
})
