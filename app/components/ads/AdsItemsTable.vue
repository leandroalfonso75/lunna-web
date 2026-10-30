<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { brl, int, num, pct } from '../../lib/format'
import type { AdsCampaign, AdsItemsFilters, AdsItemsResponse } from '../../types/ads'

const props = defineProps<{
  response: AdsItemsResponse | null
  loading: boolean
  filters: AdsItemsFilters
  campaigns: AdsCampaign[]
}>()

const emit = defineEmits<{
  (e: 'change', patch: Partial<AdsItemsFilters>, debounced?: boolean): void
  (e: 'sort', column: string): void
  (e: 'page', page: number): void
}>()

const COLUMNS = [
  { key: 'title', label: 'Anúncio', sort: 'title', width: 'w-[27%] max-xl:w-[34%]', align: 'left' },
  { key: 'cost', label: 'Investimento', sort: 'cost', width: 'w-[10%]', align: 'right' },
  { key: 'total_amount', label: 'Vendas por Ads', sort: 'total_amount', width: 'w-[10%]', align: 'right' },
  { key: 'acos', label: 'ACOS', sort: 'acos', width: 'w-[8%]', align: 'right' },
  { key: 'roas', label: 'ROAS', sort: 'roas', width: 'w-[7%]', align: 'right' },
  { key: 'units', label: 'Unid.', sort: 'units', width: 'w-[6%]', align: 'right' },
  { key: 'clicks', label: 'Cliques', sort: 'clicks', width: 'w-[7%]', align: 'right', hide: true },
  { key: 'prints', label: 'Impressões', sort: 'prints', width: 'w-[9%]', align: 'right', hide: true },
  { key: 'flag', label: 'Situação', width: 'w-[16%]', align: 'left' }
]

const FLAGS: { value: AdsItemsFilters['flag']; label: string; key?: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'sem_venda', label: 'Gastaram e não venderam', key: 'sem_venda' },
  { value: 'acos_alto', label: 'ACOS acima da meta', key: 'acos_alto' },
  { value: 'bom', label: 'Dentro da meta', key: 'bom' }
]

const STATUSES: { value: AdsItemsFilters['status']; label: string }[] = [
  { value: '', label: 'Todos' }, { value: 'active', label: 'Ativos' }, { value: 'paused', label: 'Pausados' }
]

const pages = computed(() => (props.response ? Math.max(1, Math.ceil(props.response.total / props.response.per_page)) : 1))
const hasFilters = computed(() => !!(props.filters.campaignId || props.filters.status || props.filters.flag || props.filters.q))

function tone(t: string): string {
  return { ok: 'pill-success', warn: 'pill-warning', bad: 'pill-danger', neutral: 'pill-neutral' }[t] ?? 'pill-neutral'
}

function flagCount(key?: string): string {
  if (!key || !props.response) return ''
  const n = props.response.flags[key]
  return n !== undefined ? ` (${int(n)})` : ''
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-[16rem] flex-1 sm:max-w-md">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          :value="filters.q"
          type="search"
          class="input h-10 w-full pl-9"
          placeholder="Buscar por título ou código do anúncio"
          aria-label="Buscar anúncios"
          @input="emit('change', { q: ($event.target as HTMLInputElement).value }, true)"
        />
      </div>
      <select :value="filters.campaignId" class="input h-10 w-auto max-w-[16rem]" aria-label="Campanha" @change="emit('change', { campaignId: ($event.target as HTMLSelectElement).value })">
        <option value="">Todas as campanhas</option>
        <option v-for="c in campaigns" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
      </select>
    </div>

    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
      <div class="flex flex-wrap gap-1" role="group" aria-label="Situação do anúncio">
        <button
          v-for="t in STATUSES"
          :key="t.label"
          type="button"
          class="rounded-md px-2.5 py-1"
          :class="filters.status === t.value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'"
          @click="emit('change', { status: t.value })"
        >{{ t.label }}</button>
      </div>
      <div class="flex flex-wrap gap-1" role="group" aria-label="Desempenho">
        <button
          v-for="t in FLAGS"
          :key="t.label"
          type="button"
          class="rounded-md px-2.5 py-1"
          :class="filters.flag === t.value ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-surface-2'"
          @click="emit('change', { flag: t.value })"
        >{{ t.label }}{{ flagCount(t.key) }}</button>
      </div>
      <button v-if="hasFilters" type="button" class="btn-link" @click="emit('change', { campaignId: '', status: '', flag: '', q: '' })">Limpar filtros</button>
    </div>

    <div class="card overflow-hidden">
      <table class="w-full table-fixed border-collapse text-[12px]">
        <thead>
          <tr class="border-b border-line">
            <th
              v-for="c in COLUMNS"
              :key="c.key"
              scope="col"
              class="px-2 py-2 font-semibold text-ink-2"
              :class="[c.width, c.align === 'right' ? 'text-right' : 'text-left', c.hide ? 'max-xl:hidden' : '']"
              :aria-sort="c.sort && response?.sort === c.sort ? (response?.dir === 'asc' ? 'ascending' : 'descending') : undefined"
            >
              <button v-if="c.sort" type="button" class="inline-flex items-center gap-1 hover:text-ink" :class="response?.sort === c.sort ? 'text-ink' : ''" @click="emit('sort', c.sort)">
                {{ c.label }}
                <ChevronUpIcon v-if="response?.sort === c.sort && response?.dir === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
                <ChevronDownIcon v-else-if="response?.sort === c.sort && response?.dir === 'desc'" class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span v-else>{{ c.label }}</span>
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
          <tr v-for="item in response?.items ?? []" :key="item.item_id" class="border-b border-line hover:bg-surface-2" data-test="ad-row">
            <td class="px-2 py-2 align-top">
              <div class="flex items-start gap-2">
                <img v-if="item.thumbnail" :src="item.thumbnail" alt="" class="h-12 w-12 shrink-0 rounded object-cover" loading="lazy" />
                <div class="min-w-0">
                  <a :href="item.permalink ?? '#'" target="_blank" rel="noopener" class="block truncate text-[13px] font-medium text-ink hover:underline" :title="item.title ?? ''">{{ item.title }}</a>
                  <p class="truncate text-[12px] text-ink-3">
                    {{ item.item_id }} · {{ brl(item.price) }} · {{ item.campaign.name }}
                    <span v-if="item.status !== 'active'" class="ml-1 pill-warning">{{ item.status_label }}</span>
                  </p>
                </div>
              </div>
            </td>
            <td class="px-2 py-2 text-right align-top" data-numeric>{{ brl(item.metrics.cost) }}</td>
            <td class="px-2 py-2 text-right align-top" data-numeric>{{ brl(item.metrics.total_amount) }}</td>
            <td class="px-2 py-2 text-right align-top" data-numeric>
              <span :class="item.flag?.tone === 'ok' ? 'font-semibold text-success' : item.flag?.tone === 'bad' ? 'font-semibold text-danger' : item.flag?.tone === 'warn' ? 'font-semibold text-warning' : ''">{{ pct(item.metrics.acos) }}</span>
            </td>
            <td class="px-2 py-2 text-right align-top" data-numeric>{{ item.metrics.roas === null ? '—' : `${num(item.metrics.roas, 2)}x` }}</td>
            <td class="px-2 py-2 text-right align-top" data-numeric>{{ int(item.metrics.units) }}</td>
            <td class="px-2 py-2 text-right align-top max-xl:hidden" data-numeric>{{ int(item.metrics.clicks) }}</td>
            <td class="px-2 py-2 text-right align-top max-xl:hidden" data-numeric>{{ int(item.metrics.prints) }}</td>
            <td class="px-2 py-2 align-top"><span v-if="item.flag" :class="tone(item.flag.tone)">{{ item.flag.label }}</span><span v-else class="text-ink-3">—</span></td>
          </tr>
        </tbody>
      </table>

      <div v-if="response && response.total > 0" class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[12px] text-ink-2">
        <span>
          {{ int(response.total) }} anúncios · página {{ response.page }} de {{ pages }} ·
          total filtrado: investimento {{ brl(response.totals.cost) }}, vendas {{ brl(response.totals.total_amount) }}, ACOS {{ pct(response.totals.acos) }}
        </span>
        <div class="flex gap-2">
          <button type="button" class="btn-link" :disabled="response.page <= 1" @click="emit('page', response.page - 1)">Anterior</button>
          <button type="button" class="btn-link" :disabled="response.page >= pages" @click="emit('page', response.page + 1)">Próxima</button>
        </div>
      </div>
    </div>
  </div>
</template>
