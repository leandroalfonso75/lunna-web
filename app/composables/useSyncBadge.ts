import { ref } from 'vue'
import { createPainelClient } from '../lib/painelClient'
import { withTransientRetry } from '../lib/transientRetry'
import { useSessionStore } from '../stores/session'
import type { PainelAccount, SyncStatus } from '../types/painel'

/**
 * Só o selo de sincronização + conta de `GET /api/painel` (SPEC §7.1), para
 * as páginas que não precisam do payload inteiro (`/anuncios`,
 * `/curva-abc`) mas ainda mostram o cabeçalho padronizado — "o selo de sync
 * sempre vem de `/api/painel`". A página `/` já tem `account`/`sync` dentro
 * do próprio `usePainel()` e não precisa disto.
 */
export function useSyncBadge() {
  const { $api } = useNuxtApp()
  const client = createPainelClient($api)
  const session = useSessionStore()

  const account = ref<PainelAccount | null>(null)
  const sync = ref<SyncStatus | null>(null)
  const generatedAt = ref<string | null>(null)

  async function load() {
    const accountId = session.selectedAccountId
    if (!accountId) return
    try {
      const data = await withTransientRetry(() => client.getPainel(accountId))
      account.value = data.account
      sync.value = data.sync
      generatedAt.value = data.generated_at
    } catch {
      // O selo mantém o último estado conhecido; a página dona dos dados
      // (useItemsTable/useAbc) já mostra "mostrando os últimos dados".
    }
  }

  return { account, sync, generatedAt, load }
}
