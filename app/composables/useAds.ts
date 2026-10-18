import { reactive, ref, watch } from 'vue'
import { buildAdsItemsQuery, createAdsClient } from '../lib/adsClient'
import { apiErrorMessage } from '../lib/apiErrors'
import { withTransientRetry } from '../lib/transientRetry'
import { useSessionStore } from '../stores/session'
import type { AdsItemsFilters, AdsItemsResponse, AdsRange, AdsResponse } from '../types/ads'
import { usePolling } from './usePolling'

const DEBOUNCE_MS = 300

/**
 * Dados e controles da seção Ads (`/ads`): período, campanhas e anúncios em campanha.
 * Toda a conta (ACOS, ROAS, totais, sinais) é feita na API; aqui só se decide quando pedir.
 */
export function useAds() {
  const { $api } = useNuxtApp()
  const client = createAdsClient($api)
  const session = useSessionStore()

  const range = reactive<AdsRange>({ period: '30d', from: '', to: '' })
  const tab = ref<'campanhas' | 'anuncios'>('campanhas')
  const overview = ref<AdsResponse | null>(null)
  const itemsResponse = ref<AdsItemsResponse | null>(null)
  const loading = ref(true)
  const itemsLoading = ref(false)
  const loadError = ref('')
  const stale = ref(false)
  const syncing = ref(false)
  const syncMessage = ref('')

  const filters = reactive<AdsItemsFilters>({ campaignId: '', status: '', flag: '', q: '', sort: 'cost', dir: 'desc', page: 1, perPage: 50 })

  let timer: ReturnType<typeof setTimeout> | null = null
  let overviewController: AbortController | null = null
  let itemsController: AbortController | null = null

  async function loadOverview() {
    const accountId = session.selectedAccountId
    if (!accountId) return
    overviewController?.abort()
    const mine = new AbortController()
    overviewController = mine
    loading.value = true
    try {
      const data = await withTransientRetry(() => client.overview(accountId, { ...range }, { signal: mine.signal }))
      if (mine.signal.aborted) return
      overview.value = data
      stale.value = false
      loadError.value = ''
    } catch (err) {
      if (mine.signal.aborted) return
      if (overview.value) stale.value = true
      else loadError.value = apiErrorMessage(err, 'Não foi possível carregar os dados de publicidade agora.')
    } finally {
      if (!mine.signal.aborted) loading.value = false
    }
  }

  async function loadItems() {
    const accountId = session.selectedAccountId
    if (!accountId) return
    itemsController?.abort()
    const mine = new AbortController()
    itemsController = mine
    itemsLoading.value = true
    try {
      const data = await withTransientRetry(() => client.items(buildAdsItemsQuery(accountId, { ...range }, filters), { signal: mine.signal }))
      if (mine.signal.aborted) return
      itemsResponse.value = data
    } catch (err) {
      if (mine.signal.aborted) return
      if (!itemsResponse.value) loadError.value = apiErrorMessage(err, 'Não foi possível carregar os anúncios agora.')
    } finally {
      if (!mine.signal.aborted) itemsLoading.value = false
    }
  }

  async function refreshAll() {
    await Promise.all([loadOverview(), loadItems()])
  }

  function scheduleItems(debounced: boolean) {
    if (timer) clearTimeout(timer)
    timer = null
    if (debounced) timer = setTimeout(loadItems, DEBOUNCE_MS)
    else loadItems()
  }

  function setPeriod(value: string) {
    range.period = value
    filters.page = 1
    refreshAll()
  }

  /** Datas escolhidas: só consulta quando as duas estiverem preenchidas. */
  function setCustomRange(from: string, to: string) {
    Object.assign(range, { period: 'custom', from, to })
    filters.page = 1
    if (from && to) refreshAll()
  }

  function changeFilters(patch: Partial<AdsItemsFilters>, debounced = false) {
    Object.assign(filters, patch, { page: 1 })
    scheduleItems(debounced)
  }

  function sortBy(column: string) {
    const same = filters.sort === column
    filters.sort = column
    filters.dir = same ? (filters.dir === 'desc' ? 'asc' : 'desc') : column === 'title' ? 'asc' : 'desc'
    filters.page = 1
    scheduleItems(false)
  }

  function setPage(page: number) {
    filters.page = page
    scheduleItems(false)
  }

  /** "Ver anúncios desta campanha": troca de aba já filtrando. */
  function showCampaignItems(campaignId: number) {
    tab.value = 'anuncios'
    // abre já nos anúncios ativos (os pausados não gastam)
    changeFilters({ campaignId: String(campaignId), status: 'active', flag: '', q: '' })
  }

  async function syncNow() {
    const accountId = session.selectedAccountId
    if (!accountId || syncing.value) return
    syncing.value = true
    syncMessage.value = ''
    try {
      await client.sync(accountId)
      syncMessage.value = 'Pedido enviado. As campanhas e métricas estão sendo lidas do Mercado Livre; a tela se atualiza sozinha.'
      setTimeout(() => polling.refreshNow(), 20000)
    } catch (err) {
      syncMessage.value = apiErrorMessage(err, 'Não foi possível pedir a atualização agora.')
    } finally {
      syncing.value = false
    }
  }

  const polling = usePolling(refreshAll, { intervalMs: 5 * 60 * 1000 })

  watch(
    () => session.selectedAccountId,
    () => {
      overview.value = null
      itemsResponse.value = null
      filters.campaignId = ''
      filters.page = 1
      polling.refreshNow()
    }
  )

  return {
    range, tab, overview, itemsResponse, loading, itemsLoading, loadError, stale, syncing, syncMessage, filters,
    setPeriod, setCustomRange, changeFilters, sortBy, setPage, showCampaignItems, syncNow, ...polling
  }
}
