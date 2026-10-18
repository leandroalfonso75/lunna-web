import { reactive, ref, watch } from 'vue'
import { apiErrorMessage } from '../lib/apiErrors'
import { buildSalesQuery, createSalesClient } from '../lib/salesClient'
import { withTransientRetry } from '../lib/transientRetry'
import { useSessionStore } from '../stores/session'
import type { SaleDetail, SalesFilters, SalesResponse } from '../types/sales'
import { usePolling } from './usePolling'

const DEBOUNCE_MS = 300

/**
 * Dados e controles da seção Vendas (`/vendas`): período, filtros, busca,
 * ordenação, paginação e o detalhe de um pedido. Toda a regra (lucro, totais,
 * filtros) é da API (`GET /api/sales`); aqui só se decide quando pedir.
 */
export function useSales() {
  const { $api } = useNuxtApp()
  const client = createSalesClient($api)
  const session = useSessionStore()

  const filters = reactive<SalesFilters>({
    period: 'today', from: '', to: '', status: '', shipping: '', logistic: '', q: '',
    sort: 'date', dir: 'desc', page: 1, perPage: 50
  })
  const response = ref<SalesResponse | null>(null)
  const loading = ref(true)
  const stale = ref(false)
  const loadError = ref('')
  const syncing = ref(false)
  const syncMessage = ref('')

  const details = reactive<Record<number, SaleDetail | 'loading' | 'error'>>({})

  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  async function runFetch() {
    const accountId = session.selectedAccountId
    if (!accountId) return
    controller?.abort()
    const mine = new AbortController()
    controller = mine
    loading.value = true
    try {
      const data = await withTransientRetry(() => client.list(buildSalesQuery(accountId, filters), { signal: mine.signal }))
      if (mine.signal.aborted) return
      response.value = data
      stale.value = false
      loadError.value = ''
    } catch (err) {
      if (mine.signal.aborted) return
      if (response.value) stale.value = true
      else loadError.value = apiErrorMessage(err, 'Não foi possível carregar as vendas agora.')
    } finally {
      if (!mine.signal.aborted) loading.value = false
    }
  }

  function schedule(debounced: boolean) {
    if (timer) clearTimeout(timer)
    timer = null
    if (debounced) timer = setTimeout(runFetch, DEBOUNCE_MS)
    else runFetch()
  }

  function change(patch: Partial<SalesFilters>, debounced = false) {
    Object.assign(filters, patch, { page: 1 })
    schedule(debounced)
  }

  function setPeriod(period: string) {
    change({ period })
  }

  function setCustomRange(from: string, to: string) {
    Object.assign(filters, { period: 'custom', from, to, page: 1 })
    if (from && to) schedule(false)
  }

  function setQuery(q: string) {
    change({ q }, true)
  }

  function sortBy(column: string) {
    const same = filters.sort === column
    filters.sort = column
    filters.dir = same ? (filters.dir === 'desc' ? 'asc' : 'desc') : 'desc'
    filters.page = 1
    schedule(false)
  }

  function setPage(page: number) {
    filters.page = page
    schedule(false)
  }

  function clearFilters() {
    change({ status: '', shipping: '', logistic: '', q: '' })
  }

  async function loadDetail(orderId: number) {
    const accountId = session.selectedAccountId
    if (!accountId || details[orderId] === 'loading' || (details[orderId] && details[orderId] !== 'error')) return
    details[orderId] = 'loading'
    try {
      details[orderId] = await client.detail(accountId, orderId)
    } catch {
      details[orderId] = 'error'
    }
  }

  async function syncThreeMonths() {
    const accountId = session.selectedAccountId
    if (!accountId || syncing.value) return
    syncing.value = true
    syncMessage.value = ''
    try {
      await client.sync(accountId)
      syncMessage.value = 'Pedido enviado. As vendas e os envios dos últimos 3 meses estão sendo baixados; a tela se atualiza sozinha.'
      setTimeout(() => polling.refreshNow(), 4000)
    } catch (err) {
      syncMessage.value = apiErrorMessage(err, 'Não foi possível pedir a atualização agora.')
    } finally {
      syncing.value = false
    }
  }

  const polling = usePolling(runFetch, { intervalMs: 60 * 1000 })

  watch(
    () => session.selectedAccountId,
    () => {
      response.value = null
      filters.page = 1
      polling.refreshNow()
    }
  )

  return {
    filters, response, loading, stale, loadError, details, syncing, syncMessage,
    setPeriod, setCustomRange, setQuery, sortBy, setPage, clearFilters, change, loadDetail, syncThreeMonths,
    ...polling
  }
}
