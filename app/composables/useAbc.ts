import { reactive, ref, watch } from 'vue'
import { apiErrorMessage } from '../lib/apiErrors'
import { createPainelClient } from '../lib/painelClient'
import { withTransientRetry } from '../lib/transientRetry'
import { useSessionStore } from '../stores/session'
import type { AbcItemDetail, AbcResponse, CurveFilter } from '../types/painel'
import { usePolling } from './usePolling'
import { useSyncBadge } from './useSyncBadge'

/**
 * Dados da página `/curva-abc` (SPEC §8): resumo, abas por curva e linhas
 * via `GET /api/abc`; detalhe de cada anúncio (`GET /api/abc/items/:id`)
 * buscado sob demanda ao abrir a linha e mantido em cache (`Map`) enquanto
 * a página está aberta — reabrir a mesma linha não refaz a chamada.
 */
export function useAbc() {
  const { $api } = useNuxtApp()
  const client = createPainelClient($api)
  const session = useSessionStore()
  const syncBadge = useSyncBadge()

  const curve = ref<CurveFilter>('all')
  const abc = ref<AbcResponse | null>(null)
  const loading = ref(true)
  const stale = ref(false)
  const loadError = ref('')

  async function fetchAbc() {
    const accountId = session.selectedAccountId
    if (!accountId) return
    loading.value = true
    try {
      const data = await withTransientRetry(() => client.getAbc(accountId, curve.value))
      abc.value = data
      stale.value = false
      loadError.value = ''
    } catch (err) {
      if (abc.value) stale.value = true
      else loadError.value = apiErrorMessage(err, 'Não foi possível carregar a Curva ABC agora.')
    } finally {
      loading.value = false
    }
  }

  function setCurve(next: CurveFilter) {
    if (curve.value === next) return
    curve.value = next
    fetchAbc()
  }

  async function refreshAll() {
    await Promise.all([fetchAbc(), syncBadge.load()])
  }

  const polling = usePolling(refreshAll, { intervalMs: 3 * 60 * 1000 })

  // --- Detalhe do anúncio (linha expandida) -----------------------------
  const detailCache = reactive(new Map<string, AbcItemDetail>())
  const detailLoadingId = ref<string | null>(null)
  const detailErrorId = ref<string | null>(null)

  watch(
    () => session.selectedAccountId,
    () => {
      abc.value = null
      detailCache.clear()
      polling.refreshNow()
    }
  )

  async function loadDetail(itemId: string) {
    if (detailCache.has(itemId)) return
    const accountId = session.selectedAccountId
    if (!accountId) return
    detailLoadingId.value = itemId
    detailErrorId.value = null
    try {
      const data = await withTransientRetry(() => client.getAbcItem(accountId, itemId))
      detailCache.set(itemId, data)
    } catch {
      detailErrorId.value = itemId
    } finally {
      if (detailLoadingId.value === itemId) detailLoadingId.value = null
    }
  }

  return {
    curve,
    abc,
    loading,
    stale,
    loadError,
    account: syncBadge.account,
    sync: syncBadge.sync,
    generatedAt: syncBadge.generatedAt,
    setCurve,
    detailCache,
    detailLoadingId,
    detailErrorId,
    loadDetail,
    ...polling
  }
}
