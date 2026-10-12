<script setup lang="ts">
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import { usePageHeader } from '../composables/usePageHeader'
import { useRadarCollections } from '../composables/useRadarCollections'
import { useRadarSearches } from '../composables/useRadarSearches'
import { brl, dateTimeShort, int } from '../lib/format'
import { COLLECTION_STATUS_LABEL } from '../lib/radarCollectionsClient'
import { describeFilters, restoreFilters, type RadarSearch } from '../lib/radarSearchesClient'
import {
  PERIODS,
  buildIndex,
  categoryLevels,
  defaultFilters,
  filterItems,
  formatDay,
  itemUrl,
  pickCategory,
  splitBold,
  summarize,
  toTsv,
  type RadarData,
  type RadarIndex,
  type RadarSort
} from '../lib/radar'

/**
 * `/radar-ml` — Radar Mercado Livre (protótipo, adaptado do artefato
 * "Radar Beleza ML"): consulta filtrável de anúncios da categoria Beleza e
 * Cuidado Pessoal a partir de uma coleta estática (`/radar/data.json`).
 * Os números NÃO são ao vivo. Ver `lib/radar.ts` sobre onde a regra mora.
 */
const header = usePageHeader()
const collections = useRadarCollections()
const history = useRadarSearches()

const data = ref<RadarData | null>(null)
const index = ref<RadarIndex | null>(null)
const loadError = ref('')
/** `filters` é o que o usuário está editando; `applied` é o que a última busca usou. */
const filters = reactive(defaultFilters())
const applied = reactive(defaultFilters())
const page = ref(0)
/** A busca só roda depois de "Pesquisar", com a categoria escolhida (obrigatória). */
const searched = ref(false)
const categoryError = ref('')
/** Painel "Consultas dos últimos 3 meses" e a consulta reaberta (se houver). */
const historyOpen = ref(false)
const openedSearch = ref<RadarSearch | null>(null)
const PAGE_SIZE = 50
const copyLabel = ref('Copiar resultado')

onMounted(async () => {
  void collections.load()
  try {
    const [raw, paths] = await Promise.all([
      $fetch<RadarData>('/radar/data.json'),
      $fetch<string[]>('/radar/categorias.json')
    ])
    data.value = raw
    index.value = buildIndex(raw, paths)
  } catch {
    loadError.value = 'Não foi possível carregar a base do Radar. Recarregue a página.'
  }
})

watchEffect(() => {
  header.state.title = 'Radar Mercado Livre'
  header.state.subtitle = 'Todas as categorias · base coletada no site do Mercado Livre'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = false
  header.state.onRefresh = null
})

const result = computed(() => (index.value ? filterItems(index.value, applied) : []))
const summary = computed(() => summarize(result.value))
const pages = computed(() => Math.max(1, Math.ceil(result.value.length / PAGE_SIZE)))
const rows = computed(() => result.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE))

const levels = computed(() => (index.value ? categoryLevels(index.value, filters.category) : []))

// Qualquer mudança de filtro volta para a primeira página.
// Ordenação e aba de tipo agem direto no resultado; o resto só vale após "Pesquisar".
const filterKey = (f: typeof filters) => JSON.stringify({ ...f, sort: '', type: '' })
const dirty = computed(() => filterKey(filters) !== filterKey(applied))

/** Consulta reaberta: a categoria dela é o piso; só dá para refinar para subcategorias de dentro. */
const baseCategory = computed(() => openedSearch.value?.category_path ?? '')
const lockedDepth = computed(() => (baseCategory.value ? baseCategory.value.split(' > ').length : 0))
const insideBase = (path: string) => !baseCategory.value || path === baseCategory.value || path.startsWith(`${baseCategory.value} > `)

function search() {
  if (!filters.category) {
    categoryError.value = 'Escolha uma categoria para pesquisar. As subcategorias são opcionais.'
    return
  }
  categoryError.value = ''
  searched.value = true
  const reopened = !!openedSearch.value
  const catalogChanged = filters.catalog !== applied.catalog
  Object.assign(applied, filters, { sort: applied.sort, type: catalogChanged ? 'all' : applied.type })
  page.value = 0
  // Refinar uma consulta reaberta não cria uma nova entrada no histórico.
  if (reopened) return
  openedSearch.value = null
  if (index.value) {
    const found = summarize(filterItems(index.value, applied))
    void history.save({
      category_path: applied.category,
      filters: { ...applied },
      data_ref: new Date(index.value.refDay * 86400000).toISOString().slice(0, 10),
      total_items: found.total,
      total_sold: found.sold,
      total_revenue: Math.round(found.revenue * 100) / 100,
      median_price: found.medianPrice
    })
  }
}

async function toggleHistory() {
  historyOpen.value = !historyOpen.value
  if (historyOpen.value) await history.load()
}

/** Reabre uma consulta salva: reaplica os filtros e mostra o resultado completo. */
function openSearch(saved: RadarSearch) {
  const restored = restoreFilters(saved.filters, defaultFilters())
  Object.assign(filters, restored)
  Object.assign(applied, restored)
  categoryError.value = ''
  searched.value = true
  page.value = 0
  openedSearch.value = saved
  historyOpen.value = false
}

watch(() => applied.sort, () => { page.value = 0 })
watch(() => applied.type, () => { page.value = 0 })

function selectCategory(level: number, value: string) {
  const next = pickCategory(filters.category, level, value)
  if (!insideBase(next)) return
  filters.category = next
  // Numa consulta reaberta, escolher a subcategoria já filtra a lista na hora.
  if (openedSearch.value) {
    applied.category = next
    page.value = 0
  }
}

function clear() {
  Object.assign(filters, defaultFilters())
  Object.assign(applied, defaultFilters())
  searched.value = false
  categoryError.value = ''
  openedSearch.value = null
  page.value = 0
}

function setPeriod(days: number) {
  filters.period = days
  filters.customDays = ''
}

function setSort(sort: RadarSort) {
  applied.sort = applied.sort === 'price_d' && sort === 'price_d' ? 'price_a' : sort
}

async function copy() {
  try {
    await navigator.clipboard.writeText(toTsv(result.value))
    copyLabel.value = 'Copiado ✓'
  } catch {
    copyLabel.value = 'Não foi possível copiar'
  }
  setTimeout(() => { copyLabel.value = 'Copiar resultado' }, 2200)
}

const bucket = (n: number) => (n >= 1000 ? `+${int(n / 1000)} mil` : `+${n}`)
const stars = (r: number | null) => (r ? `★ ${r.toFixed(1).replace('.', ',')}` : '')
const noteParts = computed(() => splitBold(data.value?.note ?? ''))
const sellerNote = computed(() => splitBold(data.value?.sellerNote ?? '').map((p) => p.text).join(''))

/** Categoria escolhida sem anúncios na base: dá para pedir a coleta dela. */
const selectedCategory = computed(() => (index.value && filters.category ? (index.value.tree[filters.category] ?? null) : null))
const activeRequest = computed(() => (filters.category ? collections.activeByPath.value.get(filters.category) : undefined))
const STATUS_PILL: Record<string, string> = { requested: 'pill-warning', collecting: 'pill-primary', done: 'pill-success', failed: 'pill-danger' }

const SORTS: { value: RadarSort; label: string }[] = [
  { value: 'rev', label: 'Maior receita' },
  { value: 'avg', label: 'Maior média de vendas/mês' },
  { value: 'sold', label: 'Mais vendas' },
  { value: 'date', label: 'Mais recentes' },
  { value: 'price_d', label: 'Maior preço' },
  { value: 'price_a', label: 'Menor preço' },
  { value: 'rat', label: 'Melhor avaliação' }
]
</script>

<template>
  <div class="page space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="page-title">Radar Mercado Livre</h1>
        <p class="page-subtitle max-w-2xl">
          Filtre anúncios por categoria, período de criação, tipo, vendedor, marca, preço, vendas, receita e
          avaliação. Os números vêm de uma coleta no site do Mercado Livre, não de consulta ao vivo.
        </p>
      </div>
      <div class="flex flex-col items-end gap-2">
        <button type="button" class="btn-secondary" data-test="consultas-anteriores" :aria-expanded="historyOpen" @click="toggleHistory">
          Consultar pesquisas dos últimos 3 meses
        </button>
        <span v-if="index" class="pill-neutral" data-test="radar-base">
          Dados de {{ formatDay(index.refDay) }} · {{ int(index.items.length) }} anúncios
        </span>
      </div>
    </header>

    <section v-if="historyOpen" class="card p-4" data-test="historico" aria-label="Consultas dos últimos 3 meses">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="section-title">Pesquisas realizadas nos últimos 3 meses</h2>
        <button type="button" class="btn-link" @click="historyOpen = false">Fechar</button>
      </div>
      <p v-if="history.loading.value" class="py-4 text-center text-ink-3" role="status">Carregando consultas…</p>
      <p v-else-if="!history.searches.value.length" class="py-4 text-center text-ink-3">Nenhuma pesquisa nos últimos 3 meses.</p>
      <ul v-else class="max-h-96 divide-y divide-line overflow-y-auto text-[13px]">
        <li v-for="h in history.searches.value" :key="h.id">
          <button type="button" class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2 text-left hover:bg-surface-2" data-test="consulta" @click="openSearch(h)">
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold text-ink" :title="h.category_path">{{ h.category_path }}</span>
              <span class="block truncate text-[12px] text-ink-3">{{ describeFilters(h.filters) || 'sem outros filtros' }}</span>
            </span>
            <span class="text-[12px] text-ink-2">{{ int(h.total_items) }} anúncios · {{ brl(Number(h.total_revenue)) }}</span>
            <span class="text-[12px] text-ink-3">{{ dateTimeShort(h.searched_at) }}<template v-if="h.searched_by"> · {{ h.searched_by }}</template></span>
          </button>
        </li>
      </ul>
    </section>

    <div v-if="loadError" class="card p-6 text-center text-danger" role="alert">{{ loadError }}</div>
    <div v-else-if="!index" class="card p-10 text-center text-ink-3" role="status">Carregando anúncios…</div>

    <div v-else class="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      <!-- Filtros -->
      <form class="card space-y-4 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" aria-label="Filtros" data-test="filtros" @submit.prevent="search">
        <div class="flex items-center justify-between">
          <h2 class="section-title">Filtros</h2>
          <button type="button" class="btn-link" data-test="limpar" @click="clear">Limpar tudo</button>
        </div>

        <fieldset class="space-y-2 border-t border-line pt-3">
          <legend class="field-label">Categoria <span class="text-danger" aria-hidden="true">*</span> <span class="font-normal text-ink-3">(obrigatória)</span></legend>
          <select
            v-for="(lvl, i) in levels"
            :key="i"
            :value="lvl.value"
            class="input"
            :aria-required="i === 0"
            :disabled="i < lockedDepth"
            :aria-label="i === 0 ? 'Categoria' : `Subcategoria nível ${i}`"
            :data-test="`cat-${i}`"
            @change="selectCategory(i, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ i === 0 ? 'Selecione a categoria' : 'Todas as subcategorias' }}</option>
            <option v-for="c in lvl.options" :key="c.key" :value="c.key">{{ c.name }} ({{ int(c.count) }})</option>
          </select>
          <p class="text-[12px] text-ink-3">
            A base coletada hoje só tem anúncios de Beleza e Cuidado Pessoal; as demais categorias aparecem com (0) até serem coletadas.
          </p>
          <p v-if="categoryError" class="text-[12px] text-danger" role="alert" data-test="erro-categoria">{{ categoryError }}</p>
          <p class="text-[12px] text-ink-3">Sem escolher subcategoria, a pesquisa traz os anúncios de todas as subcategorias abaixo da categoria.</p>
          <div v-if="selectedCategory" class="rounded-card border border-line bg-surface-2 p-3 text-[13px]" data-test="pedir-coleta">
            <template v-if="activeRequest">
              <span :class="STATUS_PILL[activeRequest.status]">{{ COLLECTION_STATUS_LABEL[activeRequest.status] }}</span>
              <p class="mt-1 text-ink-3">Pedido registrado. A coleta só acontece quando for executada sob comando.</p>
            </template>
            <template v-else>
        <p v-if="openedSearch" class="rounded-card border border-info bg-info-soft px-3 py-2 text-[13px] text-info" data-test="consulta-aberta">
          Consulta de {{ dateTimeShort(openedSearch.searched_at) }}<template v-if="openedSearch.searched_by"> por {{ openedSearch.searched_by }}</template>, sobre a base de {{ openedSearch.data_ref ? formatDay(Math.floor(Date.parse(openedSearch.data_ref) / 86400000)) : '—' }}. Escolha uma subcategoria à esquerda para ver só os anúncios dela. Para uma pesquisa nova, use “Limpar tudo”.
        </p>
              <p class="text-ink-2">
                {{ selectedCategory.count ? 'Quer atualizar os dados desta categoria?' : 'Esta categoria ainda não foi coletada.' }}
              </p>
              <button type="button" class="btn-secondary mt-2 w-full" :disabled="collections.busy.value" @click="collections.request(filters.category)">
                Pedir coleta desta categoria
              </button>
              <p class="mt-1 text-[12px] text-ink-3">Inclui as subcategorias. Nada é coletado até a coleta ser executada.</p>
            </template>
          </div>
        </fieldset>

        <fieldset class="border-t border-line pt-3">
          <legend class="field-label">Período de criação do anúncio</legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in PERIODS"
              :key="p"
              type="button"
              :class="!filters.customDays && filters.period === p ? 'pill-primary' : 'pill-neutral'"
              :aria-pressed="!filters.customDays && filters.period === p"
              @click="setPeriod(p)"
            >
              {{ p }} dias
            </button>
            <button
              type="button"
              :class="!filters.customDays && filters.period === 0 ? 'pill-primary' : 'pill-neutral'"
              :aria-pressed="!filters.customDays && filters.period === 0"
              @click="setPeriod(0)"
            >
              Todos
            </button>
          </div>
          <div class="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
            <label for="radar-dias">Ou últimos</label>
            <input id="radar-dias" v-model="filters.customDays" type="number" min="1" inputmode="numeric" class="input w-24" placeholder="dias" />
            <span>dias</span>
          </div>
        </fieldset>

        <fieldset class="space-y-1.5 border-t border-line pt-3">
          <legend class="field-label">Produtos de catálogo</legend>
          <label class="flex items-center gap-2 text-[14px]"><input v-model="filters.catalog" type="radio" value="only" /> Mostrar apenas (só catálogo)</label>
          <label class="flex items-center gap-2 text-[14px]"><input v-model="filters.catalog" type="radio" value="excl" /> Excluir (só tradicionais)</label>
          <label class="flex items-center gap-2 text-[14px]"><input v-model="filters.catalog" type="radio" value="both" /> Mostrar ambos</label>
        </fieldset>

        <fieldset class="border-t border-line pt-3">
          <legend class="field-label">Vendedor (opcional)</legend>
          <input v-model="filters.seller" type="search" list="radar-vendedores" class="input" placeholder="Nome do vendedor ou loja" autocomplete="off" />
          <datalist id="radar-vendedores"><option v-for="s in data?.topSellers" :key="s" :value="s" /></datalist>
          <p class="mt-1 text-[12px] text-ink-3">{{ sellerNote }}</p>
        </fieldset>

        <fieldset class="border-t border-line pt-3">
          <legend class="field-label">Marca (opcional)</legend>
          <input v-model="filters.brand" type="search" list="radar-marcas" class="input" placeholder="Ex.: Ruby Rose, Payot" autocomplete="off" />
          <datalist id="radar-marcas"><option v-for="s in data?.topBrands" :key="s" :value="s" /></datalist>
        </fieldset>

        <fieldset class="border-t border-line pt-3">
          <legend class="field-label">Preço (R$)</legend>
          <div class="grid grid-cols-2 gap-2">
            <input v-model="filters.priceMin" type="number" min="0" step="0.01" class="input" placeholder="Mínimo" aria-label="Preço mínimo" />
            <input v-model="filters.priceMax" type="number" min="0" step="0.01" class="input" placeholder="Máximo" aria-label="Preço máximo" />
          </div>
        </fieldset>

        <fieldset class="border-t border-line pt-3">
          <legend class="field-label">Receita no período (R$)</legend>
          <div class="grid grid-cols-2 gap-2">
            <input v-model="filters.revMin" type="number" min="0" class="input" placeholder="Mínima" aria-label="Receita mínima" />
            <input v-model="filters.revMax" type="number" min="0" class="input" placeholder="Máxima" aria-label="Receita máxima" />
          </div>
        </fieldset>

        <fieldset class="border-t border-line pt-3">
          <legend class="field-label">Vendas no período</legend>
          <div class="grid grid-cols-2 gap-2">
            <input v-model="filters.soldMin" type="number" min="0" class="input" placeholder="Mínimo" aria-label="Vendas mínimas" />
            <input v-model="filters.soldMax" type="number" min="0" class="input" placeholder="Máximo" aria-label="Vendas máximas" />
          </div>
          <p class="mt-1 text-[12px] text-ink-3">Vendas desde a criação do anúncio. Com um período selecionado, só entram anúncios criados nele.</p>
        </fieldset>

        <fieldset class="border-t border-line pt-3">
          <legend class="field-label">Avaliação</legend>
          <select v-model="filters.rating" class="input" aria-label="Avaliação">
            <option value="">Qualquer avaliação</option>
            <option value="4.8">4,8 estrelas ou mais</option>
            <option value="4.5">4,5 estrelas ou mais</option>
            <option value="4">4 estrelas ou mais</option>
            <option value="3.5">3,5 estrelas ou mais</option>
            <option value="3">3 estrelas ou mais</option>
            <option value="none">Sem avaliação</option>
          </select>
        </fieldset>
        <div class="sticky bottom-0 -mx-4 -mb-4 space-y-1 border-t border-line bg-surface px-4 py-3">
          <button type="submit" class="btn-primary w-full" data-test="pesquisar">
            <MagnifyingGlassIcon class="h-4 w-4" aria-hidden="true" />
            Pesquisar
          </button>
          <p v-if="dirty" class="text-center text-[12px] text-warning" role="status">Filtros alterados. Clique em Pesquisar para atualizar.</p>
        </div>
      </form>

      <!-- Resultado -->
      <section class="min-w-0 space-y-4">
        <div v-if="collections.collections.value.length" class="card p-3" data-test="pedidos-coleta">
          <h2 class="section-title mb-2">Pedidos de coleta</h2>
          <ul class="divide-y divide-line text-[13px]">
            <li v-for="c in collections.collections.value.slice(0, 8)" :key="c.id" class="flex flex-wrap items-center gap-2 py-1.5">
              <span :class="STATUS_PILL[c.status]">{{ COLLECTION_STATUS_LABEL[c.status] }}</span>
              <span class="min-w-0 flex-1 truncate" :title="c.category_path">{{ c.category_path }}</span>
              <span class="text-[12px] text-ink-3">{{ dateTimeShort(c.requested_at) }}<template v-if="c.requested_by"> · {{ c.requested_by }}</template></span>
              <span v-if="c.error" class="w-full text-[12px] text-danger">{{ c.error }}</span>
              <button v-if="c.status === 'requested'" type="button" class="btn-link" :disabled="collections.busy.value" @click="collections.cancel(c.id)">Cancelar</button>
            </li>
          </ul>
        </div>

        <div v-if="!searched" class="card p-10 text-center text-ink-3" data-test="radar-vazio">
          <MagnifyingGlassIcon class="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
          Escolha a categoria (as subcategorias são opcionais), ajuste os demais filtros e clique em <b class="text-ink-2">Pesquisar</b>.
        </div>

        <template v-else>
        <div class="grid grid-cols-2 gap-3 2xl:grid-cols-4" data-test="radar-kpis">
          <div class="card p-3">
            <p class="text-[12px] text-ink-3">Anúncios encontrados</p>
            <p class="text-[20px] font-bold text-ink break-words">{{ int(summary.total) }}</p>
            <p class="text-[12px] text-ink-3">{{ int(summary.catalog) }} catálogo · {{ int(summary.traditional) }} tradicionais</p>
          </div>
          <div class="card p-3">
            <p class="text-[12px] text-ink-3">Vendas somadas</p>
            <p class="text-[20px] font-bold text-ink break-words">{{ int(summary.sold) }}</p>
            <p class="text-[12px] text-ink-3">piso das faixas exibidas</p>
          </div>
          <div class="card p-3">
            <p class="text-[12px] text-ink-3">Receita somada</p>
            <p class="text-[20px] font-bold text-ink break-words">{{ brl(summary.revenue) }}</p>
            <p class="text-[12px] text-ink-3">vendas × preço atual</p>
          </div>
          <div class="card p-3">
            <p class="text-[12px] text-ink-3">Preço mediano</p>
            <p class="text-[20px] font-bold text-ink break-words">{{ brl(summary.medianPrice) }}</p>
            <p class="text-[12px] text-ink-3">dos anúncios filtrados</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div v-if="applied.catalog === 'both'" class="inline-flex overflow-hidden rounded-card border border-line" role="group" aria-label="Tipo de anúncio">
            <button
              v-for="t in [{ v: 'all', l: 'Todos' }, { v: 'cat', l: 'Catálogo' }, { v: 'tra', l: 'Tradicional' }] as const"
              :key="t.v"
              type="button"
              class="px-3 py-1.5 text-[13px]"
              :class="applied.type === t.v ? 'bg-primary text-primary-ink' : 'bg-surface text-ink'"
              :aria-pressed="applied.type === t.v"
              @click="applied.type = t.v"
            >
              {{ t.l }}
            </button>
          </div>
          <span class="text-[13px] text-ink-3">{{ int(summary.total) }} anúncios</span>
          <span class="flex-1" />
          <label for="radar-ordem" class="text-[13px] text-ink-3">Ordenar:</label>
          <select id="radar-ordem" v-model="applied.sort" class="input w-auto">
            <option v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
          <button type="button" class="btn-secondary" @click="copy">{{ copyLabel }}</button>
        </div>

        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[1000px] border-collapse text-[13px]">
              <thead class="bg-surface-2">
                <tr class="border-b border-line text-left text-ink-2">
                  <th scope="col" class="px-3 py-2 font-semibold">Anúncio</th>
                  <th scope="col" class="px-3 py-2 font-semibold">Vendedor · Marca</th>
                  <th scope="col" class="px-3 py-2 font-semibold"><button type="button" @click="setSort('date')">Criado em</button></th>
                  <th scope="col" class="px-3 py-2 text-right font-semibold"><button type="button" @click="setSort('sold')">Vendas</button></th>
                  <th scope="col" class="px-3 py-2 text-right font-semibold"><button type="button" @click="setSort('avg')">Média/mês</button></th>
                  <th scope="col" class="px-3 py-2 text-right font-semibold"><button type="button" @click="setSort('price_d')">Preço</button></th>
                  <th scope="col" class="px-3 py-2 text-right font-semibold"><button type="button" @click="setSort('rev')">Receita</button></th>
                  <th scope="col" class="px-3 py-2 font-semibold"><button type="button" @click="setSort('rat')">Avaliação</button></th>
                  <th scope="col" class="px-3 py-2 font-semibold">Link</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="it in rows" :key="it.id" class="border-b border-line align-top hover:bg-surface-2" data-test="radar-linha">
                  <td class="max-w-[420px] px-3 py-2">
                    <p class="font-semibold text-ink">{{ it.title }}</p>
                    <p class="mt-0.5 text-[12px] text-ink-3">
                      <span :class="it.isCatalog ? 'pill-primary' : 'pill-neutral'">{{ it.isCatalog ? 'Catálogo' : 'Tradicional' }}</span>
                      {{ it.catName }} · MLB{{ it.id }}
                    </p>
                  </td>
                  <td class="px-3 py-2">
                    <span v-if="it.seller">{{ it.seller }}</span>
                    <span v-else class="text-ink-3">não identificado</span>
                    <p class="text-[12px] text-ink-3">{{ it.brand || '—' }}</p>
                  </td>
                  <td class="whitespace-nowrap px-3 py-2">
                    {{ formatDay(it.day) }}
                    <p class="text-[12px] text-ink-3">{{ int(index.refDay - it.day) }} dias</p>
                  </td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {{ int(it.sold) }}
                    <p class="text-[12px] text-ink-3">{{ it.sold ? `${bucket(it.sold)} vendidos` : 'sem vendas exibidas' }}</p>
                  </td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ int(it.monthlyAvg) }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ brl(it.price) }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ brl(it.revenue) }}</td>
                  <td class="whitespace-nowrap px-3 py-2">
                    <span v-if="it.rating">{{ stars(it.rating) }}</span>
                    <span v-else class="text-[12px] text-ink-3">sem avaliação</span>
                  </td>
                  <td class="px-3 py-2">
                    <a :href="itemUrl(it.id)" target="_blank" rel="noopener" class="btn-link whitespace-nowrap">Ver ↗</a>
                  </td>
                </tr>
                <tr v-if="!rows.length">
                  <td colspan="9" class="px-3 py-10 text-center text-ink-3">
                    <MagnifyingGlassIcon class="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
                    Nenhum anúncio com esses filtros. Amplie o período, remova algum filtro ou clique em “Limpar tudo”.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="pages > 1" class="flex items-center justify-center gap-3">
          <button type="button" class="btn-secondary" :disabled="page === 0" @click="page--">← Anteriores</button>
          <span class="text-[13px] text-ink-3">Página {{ page + 1 }} de {{ int(pages) }}</span>
          <button type="button" class="btn-secondary" :disabled="page >= pages - 1" @click="page++">Próximos →</button>
        </div>

        </template>

        <p class="max-w-4xl text-[12px] text-ink-3">
          <template v-for="(p, i) in noteParts" :key="i">
            <b v-if="p.bold" class="text-ink-2">{{ p.text }}</b>
            <template v-else>{{ p.text }}</template>
          </template>
        </p>
      </section>
    </div>
  </div>
</template>
