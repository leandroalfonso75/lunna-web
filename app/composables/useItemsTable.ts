import { reactive, ref, watch } from 'vue'
import { apiErrorMessage } from '../lib/apiErrors'
import { buildItemsQuery, ITEMS_NUMERIC_FILTER_KEYS, nextSort, type ItemsControlsState, type ItemsNumericFilterKey } from '../lib/itemsQuery'
import { createPainelClient } from '../lib/painelClient'
import { withTransientRetry } from '../lib/transientRetry'
import { useSessionStore } from '../stores/session'
import type { ItemsResponse, SortDir } from '../types/painel'
import { usePolling } from './usePolling'
import { useSyncBadge } from './useSyncBadge'

const DEBOUNCE_MS = 300

function initialFilters(route: { query: Record<string, unknown> }): ItemsControlsState {
  const alert = route.query.alert
  const id = route.query.id
  return {
    status: 'active',
    alert: typeof alert === 'string' ? alert : null,
    q: '',
    type: '',
    shipping: '',
    id: typeof id === 'string' ? id : null,
    titleFilter: '',
    skuFilter: '',
    numericFilters: {},
    sort: 'units_7d',
    dir: null,
    page: 1,
    perPage: 50
  }
}

/**
 * Dados e controles da tabela de anúncios (`/anuncios`, SPEC §7.7): filtros,
 * busca, ordenação e paginação — toda a REGRA acontece no Ruby
 * (`GET /api/items`); aqui só se decide QUANDO mandar a requisição (debounce
 * de 300 ms nos campos de texto, cancelando a anterior) e o que virou
 * `sort`/`dir` a partir do clique no cabeçalho (`lib/itemsQuery.nextSort`).
 */
export function useItemsTable() {
  const { $api } = useNuxtApp()
  const client = createPainelClient($api)
  const session = useSessionStore()
  const route = useRoute()
  const router = useRouter()
  const syncBadge = useSyncBadge()

  /** Tira `id`/`alert` da URL quando o usuário navega para longe deles
   * (aba de status, outro alerta, "Ver todos", ordenar) — senão um refresh
   * da página reaplicaria um filtro que o usuário já abandonou. */
  function stripUrlParams(keys: Array<'id' | 'alert'>) {
    if (!keys.some((k) => route.query[k] !== undefined)) return
    const query = Object.fromEntries(Object.entries(route.query).filter(([k]) => !(keys as string[]).includes(k)))
    router.replace({ query })
  }

  const filters = reactive<ItemsControlsState>(initialFilters(route))
  const response = ref<ItemsResponse | null>(null)
  const loading = ref(true)
  const stale = ref(false)
  const loadError = ref('')

  let controller: AbortController | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  async function runFetch() {
    const accountId = session.selectedAccountId
    if (!accountId) return

    controller?.abort()
    const mine = new AbortController()
    controller = mine
    loading.value = true

    try {
      const params = buildItemsQuery(accountId, filters)
      const data = await withTransientRetry(() => client.getItems(params, { signal: mine.signal }))
      if (mine.signal.aborted) return
      response.value = data
      stale.value = false
      loadError.value = ''
    } catch (err) {
      if (mine.signal.aborted) return
      if (response.value) stale.value = true
      else loadError.value = apiErrorMessage(err, 'Não foi possível carregar os anúncios agora.')
    } finally {
      if (!mine.signal.aborted) loading.value = false
    }
  }

  function schedule(debounced: boolean) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (debounced) debounceTimer = setTimeout(runFetch, DEBOUNCE_MS)
    else runFetch()
  }

  function resetPage() {
    filters.page = 1
  }

  function setStatus(status: ItemsControlsState['status']) {
    filters.status = status
    filters.id = null
    stripUrlParams(['id'])
    resetPage()
    schedule(false)
  }

  function setAlert(key: string | null) {
    filters.alert = key
    filters.id = null
    stripUrlParams(key ? ['id'] : ['id', 'alert'])
    resetPage()
    schedule(false)
  }

  function setQuery(q: string) {
    filters.q = q
    resetPage()
    schedule(true)
  }

  function setType(type: ItemsControlsState['type']) {
    filters.type = type
    resetPage()
    schedule(false)
  }

  function setShipping(shipping: ItemsControlsState['shipping']) {
    filters.shipping = shipping
    resetPage()
    schedule(false)
  }

  function setTitleFilter(value: string) {
    filters.titleFilter = value
    resetPage()
    schedule(true)
  }

  function setSkuFilter(value: string) {
    filters.skuFilter = value
    resetPage()
    schedule(true)
  }

  function setNumericFilter(key: ItemsNumericFilterKey, value: string) {
    filters.numericFilters = { ...filters.numericFilters, [key]: value }
    resetPage()
    schedule(true)
  }

  function sortBy(column: string) {
    const effective = response.value ? { sort: response.value.sort, dir: response.value.dir as SortDir } : null
    const next = nextSort(effective, column)
    filters.sort = next.sort
    filters.dir = next.dir
    filters.id = null
    stripUrlParams(['id'])
    resetPage()
    schedule(false)
  }

  function setPage(page: number) {
    filters.page = page
    schedule(false)
  }

  function clearFilters() {
    filters.alert = null
    filters.q = ''
    filters.type = ''
    filters.shipping = ''
    filters.titleFilter = ''
    filters.skuFilter = ''
    filters.numericFilters = {}
    stripUrlParams(['id', 'alert'])
    resetPage()
    schedule(false)
  }

  function showAllItems() {
    filters.id = null
    stripUrlParams(['id'])
    resetPage()
    schedule(false)
  }

  async function refreshAll() {
    await Promise.all([runFetch(), syncBadge.load()])
  }

  const polling = usePolling(refreshAll, { intervalMs: 3 * 60 * 1000 })

  watch(
    () => session.selectedAccountId,
    () => {
      response.value = null
      resetPage()
      polling.refreshNow()
    }
  )

  watch(
    () => [route.query.id, route.query.alert],
    ([id, alert]) => {
      const nextId = typeof id === 'string' ? id : null
      const nextAlert = nextId ? filters.alert : typeof alert === 'string' ? alert : null
      // Evita um refetch duplicado quando a própria mudança veio daqui
      // (`stripUrlParams`, acionado pelos setters abaixo).
      if (nextId === filters.id && nextAlert === filters.alert) return
      filters.id = nextId
      filters.alert = nextAlert
      resetPage()
      schedule(false)
    }
  )

  return {
    filters,
    numericFilterKeys: ITEMS_NUMERIC_FILTER_KEYS,
    response,
    loading,
    stale,
    loadError,
    account: syncBadge.account,
    sync: syncBadge.sync,
    generatedAt: syncBadge.generatedAt,
    setStatus,
    setAlert,
    setQuery,
    setType,
    setShipping,
    setTitleFilter,
    setSkuFilter,
    setNumericFilter,
    sortBy,
    setPage,
    clearFilters,
    showAllItems,
    ...polling
  }
}
