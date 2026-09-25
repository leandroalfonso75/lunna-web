import { ref, watch } from 'vue'
import { apiErrorMessage } from '../lib/apiErrors'
import { createPainelClient } from '../lib/painelClient'
import { withTransientRetry } from '../lib/transientRetry'
import { useSessionStore } from '../stores/session'
import type { PainelResponse } from '../types/painel'
import { usePolling } from './usePolling'

/**
 * Dados da página `/` (Visão geral): `GET /api/painel` inteiro — cabeçalho,
 * KPIs, gráfico, listas (SPEC §7.1–7.6). Troca de conta recarrega tudo; erro
 * com dados já carregados mantém os últimos dados (`stale`).
 */
export function usePainel() {
  const { $api } = useNuxtApp()
  const client = createPainelClient($api)
  const session = useSessionStore()

  const painel = ref<PainelResponse | null>(null)
  const stale = ref(false)
  const loadError = ref('')

  async function load() {
    const accountId = session.selectedAccountId
    if (!accountId) return
    try {
      const data = await withTransientRetry(() => client.getPainel(accountId))
      painel.value = data
      stale.value = false
      loadError.value = ''
    } catch (err) {
      if (painel.value) stale.value = true
      else loadError.value = apiErrorMessage(err, 'Não foi possível carregar o painel agora.')
    }
  }

  const polling = usePolling(load)

  watch(
    () => session.selectedAccountId,
    () => {
      painel.value = null
      polling.refreshNow()
    }
  )

  return { painel, stale, loadError, ...polling }
}
