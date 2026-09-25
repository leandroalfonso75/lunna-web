<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { useItemsTable } from '../../composables/useItemsTable'
import { usePageHeader } from '../../composables/usePageHeader'
import { brl, int, num, pct } from '../../lib/format'
import type { ItemsNumericFilterKey } from '../../lib/itemsQuery'
import type { ItemRow } from '../../types/painel'

/**
 * Tabela de anúncios (`/anuncios`, SPEC §7.7). Chama `useItemsTable()`
 * (único ponto de instância — a página não repete a chamada) e cuida só do
 * que é do componente: abrir/fechar o detalhe da linha, montar as colunas.
 * Toda regra (filtro/busca/ordenação/paginação) é da API; aqui só se manda
 * o que o usuário digitou/clicou.
 */
const COLUMNS: { key: string; label: string; sort: string; filter?: 'text' | 'numeric'; placeholder?: string }[] = [
  { key: 'title', label: 'Anúncio', sort: 'title', filter: 'text', placeholder: 'título ou ID' },
  { key: 'sku', label: 'SKU', sort: 'sku', filter: 'text', placeholder: 'sem sku' },
  { key: 'status', label: 'Status', sort: 'status' },
  { key: 'price', label: 'Preço', sort: 'price', filter: 'numeric', placeholder: '>50' },
  { key: 'stock', label: 'Estoque', sort: 'stock', filter: 'numeric', placeholder: '>10' },
  { key: 'visits_7d', label: 'Visitas 7d', sort: 'visits_7d', filter: 'numeric', placeholder: '>50' },
  { key: 'units_7d', label: 'Vendas 7d', sort: 'units_7d', filter: 'numeric', placeholder: '>10' },
  { key: 'conversion_7d', label: 'Conversão', sort: 'conversion_7d', filter: 'numeric', placeholder: '>5' },
  { key: 'units_delta', label: 'Variação', sort: 'units_delta', filter: 'numeric', placeholder: '>0' },
  { key: 'revenue_7d', label: 'Faturado 7d', sort: 'revenue_7d', filter: 'numeric', placeholder: '>1000' },
  { key: 'coverage_days', label: 'Cobertura', sort: 'coverage_days', filter: 'numeric', placeholder: '<14' },
  { key: 'quality_score', label: 'Qualidade', sort: 'quality_score', filter: 'numeric', placeholder: '>=70' }
]

const STATUS_TABS: { value: 'active' | 'paused' | 'closed' | 'all'; label: string }[] = [
  { value: 'active', label: 'Ativos' },
  { value: 'paused', label: 'Pausados' },
  { value: 'closed', label: 'Finalizados' },
  { value: 'all', label: 'Todos' }
]

const table = useItemsTable()
const { filters, response, loading, stale, loadError, account, sync, generatedAt, refreshing } = table

const header = usePageHeader()
watchEffect(() => {
  header.state.title = 'Anúncios'
  header.state.subtitle = account.value ? `Mercado Livre · ${account.value.nickname}` : 'Mercado Livre'
  header.state.sync = sync.value
  header.state.generatedAt = generatedAt.value
  header.state.refreshing = refreshing.value
  header.state.onRefresh = table.refreshNow
})

onMounted(table.start)
onBeforeUnmount(table.stop)

const expandedId = ref<string | null>(null)

function toggleRow(item: ItemRow) {
  expandedId.value = expandedId.value === item.id ? null : item.id
}

// Modo "focado" (?id=): expande a única linha assim que ela chegar.
watchEffect(() => {
  if (filters.id && response.value?.items[0]) expandedId.value = response.value.items[0].id
})

function onNumericInput(key: ItemsNumericFilterKey, event: Event) {
  table.setNumericFilter(key, (event.target as HTMLInputElement).value)
}

function totalPages(): number {
  if (!response.value || !response.value.per_page) return 1
  return Math.max(1, Math.ceil(response.value.total / response.value.per_page))
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="filters.id" class="card flex flex-wrap items-center justify-between gap-3 p-3">
      <p class="text-[14px] text-ink-2">Mostrando 1 anúncio.</p>
      <button type="button" class="btn-secondary" @click="table.showAllItems">Ver todos</button>
    </div>

    <template v-else>
      <nav class="tab-bar" aria-label="Abas de status">
        <button
          v-for="tab in STATUS_TABS"
          :key="tab.value"
          type="button"
          :class="filters.status === tab.value ? 'tab-active' : 'tab'"
          @click="table.setStatus(tab.value)"
        >
          {{ tab.label }} ({{ response?.status_counts[tab.value] ?? 0 }})
        </button>
      </nav>

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-[220px] flex-1">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            :value="filters.q"
            type="search"
            class="input pl-9"
            placeholder="Buscar por título, ID ou SKU"
            aria-label="Buscar anúncios"
            @input="table.setQuery(($event.target as HTMLInputElement).value)"
          />
        </div>

        <select :value="filters.type" class="input w-auto" aria-label="Tipo de anúncio" @change="table.setType(($event.target as HTMLSelectElement).value as '' | 'P' | 'C')">
          <option value="">Todos os tipos</option>
          <option value="P">Premium</option>
          <option value="C">Clássico</option>
        </select>

        <select
          :value="filters.shipping"
          class="input w-auto"
          aria-label="Envio"
          @change="table.setShipping(($event.target as HTMLSelectElement).value as '' | 'full' | 'non_full')"
        >
          <option value="">Todo envio</option>
          <option value="full">Full</option>
          <option value="non_full">Fora do Full</option>
        </select>

        <button
          v-if="(response?.active_filters_count ?? 0) > 0"
          type="button"
          class="btn-link"
          @click="table.clearFilters"
        >
          Limpar filtros ({{ response?.active_filters_count }})
        </button>
      </div>

      <div v-if="filters.alert && response?.active_filter.alert" class="flex items-center gap-2">
        <span class="pill-primary">
          {{ response.active_filter.alert.title }}
          <button type="button" class="ml-1 font-semibold" aria-label="Remover filtro de alerta" @click="table.setAlert(null)">×</button>
        </span>
      </div>
    </template>

    <p v-if="stale" role="status" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
      Não foi possível atualizar agora — mostrando os últimos dados.
    </p>

    <div v-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="table.refreshNow">Tentar de novo</button>
    </div>

    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1100px] border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-line">
              <th
                v-for="column in COLUMNS"
                :key="column.key"
                scope="col"
                class="whitespace-nowrap px-3 py-2 text-left font-semibold text-ink-2"
                :class="[column.key === 'title' ? 'sticky left-0 z-10 bg-surface' : '', column.key === 'sku' ? 'min-w-[110px]' : '']"
                :aria-sort="!filters.id && response?.sort === column.sort ? (response?.dir === 'asc' ? 'ascending' : 'descending') : undefined"
              >
                <button
                  v-if="!filters.id"
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-ink"
                  :class="response?.sort === column.sort ? 'text-ink' : ''"
                  @click="table.sortBy(column.sort)"
                >
                  {{ column.label }}
                  <ChevronUpIcon v-if="response?.sort === column.sort && response?.dir === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
                  <ChevronDownIcon v-else-if="response?.sort === column.sort && response?.dir === 'desc'" class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span v-else>{{ column.label }}</span>
              </th>
            </tr>
            <tr v-if="!filters.id" class="border-b border-line">
              <th v-for="column in COLUMNS" :key="`f-${column.key}`" class="px-3 py-1.5" :class="column.key === 'title' ? 'sticky left-0 z-10 bg-surface' : ''">
                <input
                  v-if="column.filter === 'text' && column.key === 'title'"
                  :value="filters.titleFilter"
                  type="text"
                  class="input h-8 text-[13px]"
                  :placeholder="column.placeholder"
                  :aria-label="`Filtrar por ${column.label}`"
                  @input="table.setTitleFilter(($event.target as HTMLInputElement).value)"
                />
                <input
                  v-else-if="column.filter === 'text' && column.key === 'sku'"
                  :value="filters.skuFilter"
                  type="text"
                  class="input h-8 text-[13px]"
                  :placeholder="column.placeholder"
                  :aria-label="`Filtrar por ${column.label}`"
                  @input="table.setSkuFilter(($event.target as HTMLInputElement).value)"
                />
                <input
                  v-else-if="column.filter === 'numeric'"
                  :value="filters.numericFilters[column.key as ItemsNumericFilterKey] ?? ''"
                  type="text"
                  inputmode="text"
                  class="input h-8 text-[13px]"
                  :class="response?.invalid_filters.includes(column.key) ? 'border-danger text-danger' : ''"
                  :placeholder="column.placeholder"
                  :aria-label="`Filtrar por ${column.label}`"
                  :aria-invalid="response?.invalid_filters.includes(column.key) ? 'true' : 'false'"
                  @input="onNumericInput(column.key as ItemsNumericFilterKey, $event)"
                />
              </th>
            </tr>
          </thead>

          <tbody>
            <template v-if="loading && !response">
              <tr v-for="i in 8" :key="i" class="border-b border-line">
                <td :colspan="COLUMNS.length" class="px-3 py-3"><div class="h-4 animate-pulse rounded bg-surface-2" /></td>
              </tr>
            </template>

            <tr v-else-if="!response?.items.length">
              <td :colspan="COLUMNS.length" class="px-3 py-10 text-center text-ink-3">Nenhum anúncio encontrado com esses filtros.</td>
            </tr>

            <template v-for="item in response?.items ?? []" :key="item.id">
              <tr class="group cursor-pointer border-b border-line hover:bg-surface-2" @click="toggleRow(item)">
                <td class="sticky left-0 z-10 max-w-[280px] bg-surface px-3 py-2 group-hover:bg-surface-2">
                  <p class="truncate font-medium text-ink">{{ item.title }}</p>
                  <p class="text-[12px] text-ink-3">
                    {{ item.id }}
                    <span v-if="item.full" class="pill-primary ml-1 px-1.5 py-0 text-[11px]">Full</span>
                  </p>
                </td>
                <td class="whitespace-nowrap px-3 py-2 text-ink-2">{{ item.sku ?? 'sem SKU' }}</td>
                <td class="px-3 py-2 text-ink-2">{{ item.status_label }}</td>
                <td class="px-3 py-2" data-numeric>
                  <span v-if="item.original_price" class="mr-1 text-ink-3 line-through">{{ brl(item.original_price) }}</span>
                  {{ brl(item.price) }}
                  <span v-if="item.listing_type_label" class="ml-1 text-[12px] text-ink-3">{{ item.listing_type_label }}</span>
                </td>
                <td class="px-3 py-2" data-numeric :class="{ 'font-semibold text-danger': item.stock_state === 'bad', 'text-warning': item.stock_state === 'warn' }">
                  {{ int(item.stock) }}
                </td>
                <td class="px-3 py-2" data-numeric>{{ int(item.visits_7d) }}</td>
                <td class="px-3 py-2" data-numeric>
                  {{ int(item.units_7d) }}
                  <span v-if="item.units_today" class="text-[12px] text-ink-3">+{{ item.units_today }} hoje</span>
                </td>
                <td class="px-3 py-2" data-numeric>{{ pct(item.conversion_7d) }}</td>
                <td
                  class="px-3 py-2"
                  data-numeric
                  :class="{ 'text-success': item.units_delta_direction === 'up', 'text-danger': item.units_delta_direction === 'down' }"
                >
                  {{ item.units_delta !== null ? `${item.units_delta > 0 ? '+' : ''}${int(item.units_delta)}` : '—' }}
                </td>
                <td class="px-3 py-2" data-numeric>{{ brl(item.revenue_7d) }}</td>
                <td class="px-3 py-2" data-numeric :class="{ 'font-semibold text-danger': item.coverage_state === 'bad', 'text-warning': item.coverage_state === 'warn' }">
                  {{ item.coverage_days !== null ? `${num(item.coverage_days, 1)} dias` : '—' }}
                </td>
                <td class="px-3 py-2">
                  <div v-if="item.quality_score !== null" class="flex items-center gap-2">
                    <div class="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
                      <div
                        class="h-full rounded-full"
                        :class="{ 'bg-success': item.quality_state === 'ok', 'bg-warning': item.quality_state === 'warn', 'bg-danger': item.quality_state === 'bad' }"
                        :style="{ width: `${item.quality_score}%` }"
                      />
                    </div>
                    <span data-numeric>{{ item.quality_score }}</span>
                  </div>
                  <span v-else class="text-ink-3">—</span>
                </td>
              </tr>

              <tr v-if="expandedId === item.id" class="border-b border-line bg-surface-2">
                <td :colspan="COLUMNS.length" class="border-l-4 border-l-primary px-4 py-4">
                  <div class="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                    <div class="card p-4">
                      <p class="mb-2 font-semibold text-ink">Preço e oferta</p>
                      <dl>
                        <div class="def-row">
                          <dt>Preço</dt>
                          <dd data-numeric>
                            <span v-if="item.original_price" class="mr-1 font-normal text-ink-3 line-through">{{ brl(item.original_price) }}</span>
                            {{ brl(item.price) }}
                          </dd>
                        </div>
                        <div v-if="item.discount_pct" class="def-row"><dt>Desconto</dt><dd data-numeric>{{ pct(item.discount_pct) }}</dd></div>
                        <div class="def-row"><dt>Frete</dt><dd>{{ item.free_shipping ? 'Grátis' : 'Pago pelo comprador' }}</dd></div>
                        <div class="def-row"><dt>Logística</dt><dd>{{ item.full ? 'Full' : 'Fora do Full' }}</dd></div>
                        <div class="def-row"><dt>Catálogo</dt><dd>{{ item.catalog ? 'Sim' : 'Não' }}</dd></div>
                      </dl>
                    </div>

                    <div class="card p-4">
                      <p class="mb-2 font-semibold text-ink">Desempenho 7 dias</p>
                      <div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1">
                        <span />
                        <span class="text-right text-[11px] font-medium uppercase tracking-wide text-ink-3">Atual</span>
                        <span class="text-right text-[11px] font-medium uppercase tracking-wide text-ink-3">Anterior</span>

                        <span class="text-ink-2">Visitas</span>
                        <span class="text-right text-ink" data-numeric>{{ int(item.visits_7d) }}</span>
                        <span class="text-right text-ink-3" data-numeric>{{ int(item.prev_visits_7d) }}</span>

                        <span class="text-ink-2">Vendas</span>
                        <span class="text-right text-ink" data-numeric>{{ int(item.units_7d) }}</span>
                        <span class="text-right text-ink-3" data-numeric>{{ int(item.prev_units_7d) }}</span>

                        <span class="text-ink-2">Conversão</span>
                        <span class="text-right text-ink" data-numeric>{{ pct(item.conversion_7d) }}</span>
                        <span class="text-right text-ink-3" data-numeric>{{ pct(item.prev_conversion_7d) }}</span>
                      </div>
                      <dl class="mt-2 border-t border-line pt-1">
                        <div class="def-row"><dt>Após tarifa</dt><dd data-numeric>{{ brl(item.net_after_fee_7d) }}</dd></div>
                      </dl>
                    </div>

                    <div class="card p-4">
                      <p class="mb-2 font-semibold text-ink">Estoque e cadastro</p>
                      <dl>
                        <div class="def-row"><dt>Disponível</dt><dd data-numeric>{{ int(item.stock) }}</dd></div>
                        <div class="def-row"><dt>Cobertura</dt><dd data-numeric>{{ item.coverage_days !== null ? `${num(item.coverage_days, 1)} dias` : '—' }}</dd></div>
                        <div class="def-row"><dt>SKU</dt><dd>{{ item.sku ?? 'sem SKU' }}</dd></div>
                        <div class="def-row"><dt>Variações</dt><dd data-numeric>{{ item.variations }}</dd></div>
                      </dl>
                    </div>

                    <div class="card p-4">
                      <p class="mb-2 font-semibold text-ink">Qualidade</p>
                      <template v-if="item.quality_score !== null">
                        <div class="flex items-center gap-2">
                          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div
                              class="h-full rounded-full"
                              :class="{ 'bg-success': item.quality_state === 'ok', 'bg-warning': item.quality_state === 'warn', 'bg-danger': item.quality_state === 'bad' }"
                              :style="{ width: `${item.quality_score}%` }"
                            />
                          </div>
                          <span class="shrink-0 text-ink" data-numeric>{{ item.quality_score }}/100</span>
                        </div>
                        <p class="mt-1 text-[12px] text-ink-3">{{ item.quality_level }}</p>
                      </template>
                      <p v-else class="text-ink-2">O Mercado Livre não calculou.</p>
                      <ul v-if="item.quality_actions.length" class="mt-2 space-y-1 text-ink-2">
                        <li v-for="(action, i) in item.quality_actions.slice(0, 6)" :key="i" class="flex gap-1.5">
                          <span class="text-ink-3" aria-hidden="true">•</span>
                          <span><span class="text-ink">{{ action.title }}</span><template v-if="action.label"> — {{ action.label }}</template></span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-4 text-[13px]">
                    <a :href="item.links.public" target="_blank" rel="noopener" class="btn-link">Ver anúncio publicado</a>
                    <a :href="item.links.seller_panel" target="_blank" rel="noopener" class="btn-link">Ver no painel do vendedor</a>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="response && response.total > response.per_page" class="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-[13px] text-ink-2">
        <span>{{ response.total }} anúncios · página {{ response.page }} de {{ totalPages() }}</span>
        <div class="flex gap-2">
          <button type="button" class="btn-secondary" :disabled="response.page <= 1" @click="table.setPage(response.page - 1)">Anterior</button>
          <button type="button" class="btn-secondary" :disabled="response.page >= totalPages()" @click="table.setPage(response.page + 1)">Próxima</button>
        </div>
      </div>
    </div>
  </div>
</template>
