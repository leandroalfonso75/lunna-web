<script setup lang="ts">
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import { usePageHeader } from '../composables/usePageHeader'
import { brl, int } from '../lib/format'
import {
  PERIODS,
  buildIndex,
  childrenOf,
  defaultFilters,
  filterItems,
  formatDay,
  itemUrl,
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

const data = ref<RadarData | null>(null)
const index = ref<RadarIndex | null>(null)
const loadError = ref('')
const filters = reactive(defaultFilters())
const page = ref(0)
const PAGE_SIZE = 50
const copyLabel = ref('Copiar resultado')

onMounted(async () => {
  try {
    const raw = await $fetch<RadarData>('/radar/data.json')
    data.value = raw
    index.value = buildIndex(raw)
  } catch {
    loadError.value = 'Não foi possível carregar a base do Radar. Recarregue a página.'
  }
})

watchEffect(() => {
  header.state.title = 'Radar Mercado Livre'
  header.state.subtitle = 'Beleza e Cuidado Pessoal · base coletada no site do Mercado Livre'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = false
  header.state.onRefresh = null
})

const result = computed(() => (index.value ? filterItems(index.value, filters) : []))
const summary = computed(() => summarize(result.value))
const pages = computed(() => Math.max(1, Math.ceil(result.value.length / PAGE_SIZE)))
const rows = computed(() => result.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE))

const level2 = computed(() => (index.value ? childrenOf(index.value, index.value.rootId) : []))
const level3 = computed(() => (index.value && filters.c2 ? childrenOf(index.value, filters.c2) : []))
const level4 = computed(() => (index.value && filters.c3 ? childrenOf(index.value, filters.c3) : []))

// Qualquer mudança de filtro volta para a primeira página.
watch(filters, () => { page.value = 0 }, { deep: true })
watch(() => filters.c2, () => { filters.c3 = ''; filters.c4 = '' })
watch(() => filters.c3, () => { filters.c4 = '' })

function clear() {
  Object.assign(filters, defaultFilters())
}

function setPeriod(days: number) {
  filters.period = days
  filters.customDays = ''
}

function setSort(sort: RadarSort) {
  filters.sort = filters.sort === 'price_d' && sort === 'price_d' ? 'price_a' : sort
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
      <span v-if="index" class="pill-neutral" data-test="radar-base">
        Dados de {{ formatDay(index.refDay) }} · {{ int(index.items.length) }} anúncios
      </span>
    </header>

    <div v-if="loadError" class="card p-6 text-center text-danger" role="alert">{{ loadError }}</div>
    <div v-else-if="!index" class="card p-10 text-center text-ink-3" role="status">Carregando anúncios…</div>

    <div v-else class="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      <!-- Filtros -->
      <aside class="card space-y-4 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" aria-label="Filtros">
        <div class="flex items-center justify-between">
          <h2 class="section-title">Filtros</h2>
          <button type="button" class="btn-link" data-test="limpar" @click="clear">Limpar tudo</button>
        </div>

        <fieldset class="space-y-2 border-t border-line pt-3">
          <legend class="field-label">Categoria</legend>
          <select v-model="filters.c2" class="input" aria-label="Categoria" data-test="cat-2">
            <option value="">Todas de Beleza e Cuidado Pessoal</option>
            <option v-for="c in level2" :key="c.id" :value="c.id">{{ c.name }} ({{ int(c.count) }})</option>
          </select>
          <select v-model="filters.c3" class="input" :disabled="!level3.length" aria-label="Subcategoria">
            <option value="">Todas as subcategorias</option>
            <option v-for="c in level3" :key="c.id" :value="c.id">{{ c.name }} ({{ int(c.count) }})</option>
          </select>
          <select v-model="filters.c4" class="input" :disabled="!level4.length" aria-label="Sub-subcategoria">
            <option value="">Todas</option>
            <option v-for="c in level4" :key="c.id" :value="c.id">{{ c.name }} ({{ int(c.count) }})</option>
          </select>
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
      </aside>

      <!-- Resultado -->
      <section class="min-w-0 space-y-4">
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
          <div v-if="filters.catalog === 'both'" class="inline-flex overflow-hidden rounded-card border border-line" role="group" aria-label="Tipo de anúncio">
            <button
              v-for="t in [{ v: 'all', l: 'Todos' }, { v: 'cat', l: 'Catálogo' }, { v: 'tra', l: 'Tradicional' }] as const"
              :key="t.v"
              type="button"
              class="px-3 py-1.5 text-[13px]"
              :class="filters.type === t.v ? 'bg-primary text-primary-ink' : 'bg-surface text-ink'"
              :aria-pressed="filters.type === t.v"
              @click="filters.type = t.v"
            >
              {{ t.l }}
            </button>
          </div>
          <span class="text-[13px] text-ink-3">{{ int(summary.total) }} anúncios</span>
          <span class="flex-1" />
          <label for="radar-ordem" class="text-[13px] text-ink-3">Ordenar:</label>
          <select id="radar-ordem" v-model="filters.sort" class="input w-auto">
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
