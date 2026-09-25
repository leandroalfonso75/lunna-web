<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import AbcDetail from './AbcDetail.vue'
import { useAbc } from '../../composables/useAbc'
import { usePageHeader } from '../../composables/usePageHeader'
import { brl, int, pct } from '../../lib/format'
import type { AbcRow, CurveFilter } from '../../types/painel'

/**
 * Curva ABC (`/curva-abc`, SPEC §8): resumo por curva, abas, os três blocos
 * da curva A e a tabela — clique na linha abre o detalhe (`AbcDetail.vue`),
 * buscado sob demanda por `useAbc().loadDetail`.
 */
const {
  curve,
  abc: data,
  loading,
  stale,
  loadError,
  account,
  sync,
  generatedAt,
  refreshing,
  setCurve,
  detailCache,
  detailLoadingId,
  detailErrorId,
  loadDetail,
  start,
  stop,
  refreshNow
} = useAbc()

const header = usePageHeader()
watchEffect(() => {
  header.state.title = 'Curva ABC'
  header.state.subtitle = account.value ? `Mercado Livre · ${account.value.nickname}` : 'Mercado Livre'
  header.state.sync = sync.value
  header.state.generatedAt = generatedAt.value
  header.state.refreshing = refreshing.value
  header.state.onRefresh = refreshNow
})

onMounted(start)
onBeforeUnmount(stop)

const TABS: { value: CurveFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'A', label: 'Curva A' },
  { value: 'B', label: 'Curva B' },
  { value: 'C', label: 'Curva C' }
]

function tabCount(value: CurveFilter): number {
  if (value === 'all') return data.value?.summary.reduce((sum, s) => sum + s.count, 0) ?? 0
  return data.value?.summary.find((s) => s.curve === value)?.count ?? 0
}

const expandedId = ref<string | null>(null)

function toggleRow(row: AbcRow) {
  expandedId.value = expandedId.value === row.id ? null : row.id
  if (expandedId.value) loadDetail(row.id)
}

function profitLabel(): string {
  return data.value?.has_costs ? 'Lucro líq./mês' : 'Lucro antes do custo'
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="data?.notice" role="status" class="rounded-card border border-info bg-info-soft px-3 py-2 text-[13px] text-info">
      {{ data.notice }}
    </p>

    <p v-if="data && data.details.done < data.details.total" class="text-[13px] text-ink-3">
      Detalhes carregados para {{ data.details.done }} de {{ data.details.total }} anúncios.
    </p>

    <p v-if="stale" role="status" class="rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
      Não foi possível atualizar agora — mostrando os últimos dados.
    </p>

    <div v-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="refreshNow">Tentar de novo</button>
    </div>

    <template v-else-if="loading && !data">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div v-for="i in 3" :key="i" class="card h-20 animate-pulse bg-surface-2" />
      </div>
      <div class="card h-64 animate-pulse bg-surface-2" />
    </template>

    <template v-else-if="data">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div v-for="row in data.summary" :key="row.curve" class="card p-4">
          <p class="text-[13px] font-medium text-ink-2">Curva {{ row.curve }}</p>
          <p class="mt-1 text-[20px] font-semibold text-ink">{{ int(row.count) }} anúncios</p>
          <p class="text-[13px] text-ink-3">{{ brl(row.revenue) }} · {{ pct(row.share_pct) }} do total</p>
        </div>
      </div>

      <nav class="tab-bar" aria-label="Abas de curva">
        <button v-for="tab in TABS" :key="tab.value" type="button" :class="curve === tab.value ? 'tab-active' : 'tab'" @click="setCurve(tab.value)">
          {{ tab.label }} ({{ tabCount(tab.value) }})
        </button>
      </nav>

      <div v-if="curve === 'A' && data.groups" class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="card p-4">
          <p class="text-[14px] font-semibold text-success">{{ data.groups.up.label }}</p>
          <p class="text-[13px] text-ink-2">{{ data.groups.up.description }}</p>
          <p class="mt-1 text-[13px] text-ink-3">{{ int(data.groups.up.count) }} anúncios · {{ brl(data.groups.up.revenue) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-[14px] font-semibold text-ink">{{ data.groups.flat.label }}</p>
          <p class="text-[13px] text-ink-2">{{ data.groups.flat.description }}</p>
          <p class="mt-1 text-[13px] text-ink-3">{{ int(data.groups.flat.count) }} anúncios · {{ brl(data.groups.flat.revenue) }}</p>
        </div>
        <div class="card p-4">
          <p class="text-[14px] font-semibold text-danger">{{ data.groups.down.label }}</p>
          <p class="text-[13px] text-ink-2">{{ data.groups.down.description }}</p>
          <p class="mt-1 text-[13px] text-ink-3">{{ int(data.groups.down.count) }} anúncios · {{ brl(data.groups.down.revenue) }}</p>
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1000px] border-collapse text-[13px]">
            <thead>
              <tr class="border-b border-line">
                <th scope="col" class="px-3 py-2 text-left font-semibold text-ink-2">Curva</th>
                <th scope="col" class="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-semibold text-ink-2">Anúncio</th>
                <th scope="col" class="px-3 py-2 text-left font-semibold text-ink-2">SKU</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold text-ink-2">Visitas 30d</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold text-ink-2">Vendas 30d</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold text-ink-2">vs. anterior</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold text-ink-2">Conversão</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold text-ink-2">Faturamento 30d</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold text-ink-2">{{ profitLabel() }}</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold text-ink-2">Margem</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold text-ink-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!data.rows.length">
                <td colspan="11" class="px-3 py-10 text-center text-ink-3">Nenhum anúncio nesta curva.</td>
              </tr>

              <template v-for="row in data.rows" :key="row.id">
                <tr class="cursor-pointer border-b border-line hover:bg-surface-2" @click="toggleRow(row)">
                  <td class="px-3 py-2 font-semibold text-ink">{{ row.curve }}</td>
                  <td class="sticky left-0 z-10 max-w-[280px] bg-surface px-3 py-2">
                    <p class="truncate font-medium text-ink">{{ row.title }}</p>
                    <p class="text-[12px] text-ink-3">
                      {{ row.id }} · {{ row.status_label }}
                      <span v-if="row.full" class="pill-primary ml-1 px-1.5 py-0 text-[11px]">Full</span>
                      <span v-if="row.group === 'up'" class="pill-success ml-1 px-1.5 py-0 text-[11px]">Vendendo</span>
                      <span v-else-if="row.group === 'down'" class="pill-danger ml-1 px-1.5 py-0 text-[11px]">Em queda</span>
                      <span v-else-if="row.group === 'flat'" class="pill-neutral ml-1 px-1.5 py-0 text-[11px]">Estagnado</span>
                    </p>
                  </td>
                  <td class="px-3 py-2 text-ink-2">{{ row.sku ?? 'sem SKU' }}</td>
                  <td class="px-3 py-2 text-right" data-numeric>{{ int(row.visits_30d) }}</td>
                  <td class="px-3 py-2 text-right" data-numeric>{{ int(row.units_30d) }}<span v-if="row.is_new" class="ml-1 text-[12px] text-ink-3">novo</span></td>
                  <td
                    class="px-3 py-2 text-right"
                    data-numeric
                    :class="{ 'text-success': row.units_change_state === 'ok', 'text-danger': row.units_change_state === 'bad', 'text-warning': row.units_change_state === 'warn' }"
                  >
                    {{ row.units_change_pct !== null ? pct(row.units_change_pct) : '—' }}
                  </td>
                  <td class="px-3 py-2 text-right" data-numeric>{{ pct(row.conversion_30d) }}</td>
                  <td class="px-3 py-2 text-right" data-numeric>{{ brl(row.revenue_30d) }} <span class="text-[12px] text-ink-3">({{ pct(row.share_pct) }})</span></td>
                  <td class="px-3 py-2 text-right" data-numeric :class="{ 'font-semibold text-danger': row.profit_state === 'bad' }">
                    {{ brl(row.profit_month) }}
                  </td>
                  <td
                    class="px-3 py-2 text-right"
                    data-numeric
                    :class="{ 'font-semibold text-danger': row.margin_state === 'bad', 'text-warning': row.margin_state === 'warn' }"
                  >
                    {{ row.margin_pct !== null ? pct(row.margin_pct) : '—' }}
                  </td>
                  <td class="px-3 py-2 text-right" data-numeric>
                    {{ row.suggestions_count }}
                    <span v-if="row.urgent_count" class="ml-1 rounded-full bg-danger-soft px-1.5 text-[11px] font-semibold text-danger">{{ row.urgent_count }} urgente</span>
                  </td>
                </tr>

                <tr v-if="expandedId === row.id" class="border-b border-line bg-surface-2/40">
                  <td colspan="11" class="px-4 py-4">
                    <AbcDetail
                      :row="row"
                      :detail="detailCache.get(row.id)"
                      :loading="detailLoadingId === row.id"
                      :load-error="detailErrorId === row.id"
                      :has-costs="data.has_costs"
                      @retry="loadDetail(row.id)"
                    />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
