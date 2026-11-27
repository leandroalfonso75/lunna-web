<script setup lang="ts">
import { ArrowTrendingUpIcon, BanknotesIcon, CursorArrowRaysIcon, EyeIcon, FunnelIcon, MegaphoneIcon, ReceiptPercentIcon, ShoppingBagIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import KpiTile from '../dashboard/KpiTile.vue'
import TrendChart from '../dashboard/TrendChart.vue'
import { useLayoutPref } from '../../composables/useLayoutPref'
import { delta as dashDelta } from '../../lib/dashboard'
import { brl, int, pct } from '../../lib/format'
import type { AdsDay, AdsMetrics } from '../../types/ads'

const props = defineProps<{ summary: AdsMetrics; previous: AdsMetrics | null; daily: AdsDay[] }>()
/** Layout novo (27/11/2026): cartões com ícone e variação (seta + texto + cor) e gráfico de linhas com dica por dia. */
const layoutPref = useLayoutPref()
const isNew = computed(() => layoutPref.pref.value === 'novo')
const ICONS: Record<string, unknown> = { cost: MegaphoneIcon, amount: BanknotesIcon, acos: ReceiptPercentIcon, roas: ArrowTrendingUpIcon, clicks: CursorArrowRaysIcon, prints: EyeIcon, cvr: FunnelIcon, organic: ShoppingBagIcon }
const BETTER: Record<string, boolean | null> = { cost: null, amount: true, acos: false, roas: true, clicks: true, prints: true, cvr: true, organic: null }
const VALUES: Record<string, (m: AdsMetrics) => number | null> = {
  cost: (m) => m.cost, amount: (m) => m.total_amount, acos: (m) => m.acos, roas: (m) => m.roas, clicks: (m) => m.clicks, prints: (m) => m.prints, cvr: (m) => m.cvr, organic: () => null
}
/** Variação do layout novo: investimento sobe/desce sem ser bom nem ruim (neutro). */
function newDelta(key: string) {
  const d = dashDelta(VALUES[key]!(props.summary), props.previous ? VALUES[key]!(props.previous) : null, BETTER[key] !== false)
  if (!d) return null
  return BETTER[key] === null ? { ...d, good: null } : d
}
const trend = computed(() => [
  { key: 'amount', label: 'Vendas por Ads', color: 'var(--chart-1)', values: props.daily.map((d) => d.total_amount), area: true },
  { key: 'cost', label: 'Investimento', color: 'var(--chart-2)', values: props.daily.map((d) => d.cost) }
])

type Better = 'up' | 'down' | 'none'

/** Variação sobre o período anterior; `better` diz se subir é bom (verde), ruim (vermelho) ou neutro. */
function delta(current: number | null, previous: number | null | undefined, better: Better) {
  if (current === null || previous === null || previous === undefined || previous === 0) return null
  const change = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(change) < 0.05) return { text: '0%', tone: 'text-ink-3' }
  const good = better === 'none' ? null : better === 'up' ? change > 0 : change < 0
  const tone = good === null ? 'text-ink-3' : good ? 'text-success' : 'text-danger'
  return { text: `${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1).replace('.', ',')}%`, tone }
}

const cards = computed(() => {
  const s = props.summary
  const p = props.previous
  return [
    { key: 'cost', label: 'Investimento', value: brl(s.cost), hint: `${brl(s.cpc)} por clique`, delta: delta(s.cost, p?.cost, 'none') },
    { key: 'amount', label: 'Vendas por Ads', value: brl(s.total_amount), hint: `${int(s.units)} unidades`, delta: delta(s.total_amount, p?.total_amount, 'up') },
    { key: 'acos', label: 'ACOS', value: pct(s.acos), hint: 'Investimento ÷ vendas', delta: delta(s.acos, p?.acos, 'down') },
    { key: 'roas', label: 'ROAS', value: s.roas === null ? '—' : `${s.roas.toFixed(2).replace('.', ',')}x`, hint: 'Vendas ÷ investimento', delta: delta(s.roas, p?.roas, 'up') },
    { key: 'clicks', label: 'Cliques', value: int(s.clicks), hint: `CTR ${pct(s.ctr)}`, delta: delta(s.clicks, p?.clicks, 'up') },
    { key: 'prints', label: 'Impressões', value: int(s.prints), hint: 'Vezes que o anúncio apareceu', delta: delta(s.prints, p?.prints, 'up') },
    { key: 'cvr', label: 'Conversão', value: pct(s.cvr), hint: 'Vendas ÷ cliques', delta: delta(s.cvr, p?.cvr, 'up') },
    { key: 'organic', label: 'Vendas sem Ads', value: int(s.organic_units), hint: `${brl(s.organic_amount)} em unidades orgânicas`, delta: null }
  ]
})

const max = computed(() => Math.max(1, ...props.daily.map((d) => Math.max(d.cost, d.total_amount))))
const labelEvery = computed(() => Math.max(1, Math.ceil(props.daily.length / 12)))

function dayLabel(date: string): string {
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}
</script>

<template>
  <section v-if="isNew" class="nv space-y-4" aria-label="Resumo de publicidade">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile v-for="card in cards" :key="card.key" :label="card.label" :value="card.value" :hint="card.hint" :icon="ICONS[card.key] as never" :delta="newDelta(card.key)" :data-test="`kpi-${card.key}`" />
    </div>
    <div class="panel p-5">
      <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p class="panel-title">Investimento e vendas por dia</p>
        <p class="panel-sub">Variação dos cartões: contra o período anterior de mesmo tamanho</p>
      </div>
      <TrendChart v-if="daily.length" :labels="daily.map((d) => d.date)" :series="trend" :format="brl" :height="240" caption="Vendas por Ads e investimento por dia" />
      <p v-else class="py-12 text-center text-[14px] text-ink-3">Sem dados de Ads no período.</p>
    </div>
  </section>
  <section v-else class="space-y-4" aria-label="Resumo de publicidade">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div v-for="card in cards" :key="card.key" class="card p-4" :data-test="`kpi-${card.key}`">
        <p class="text-[12px] font-medium text-ink-2">{{ card.label }}</p>
        <p class="mt-1 text-[20px] font-semibold leading-tight text-ink" data-numeric>{{ card.value }}</p>
        <p class="mt-1 text-[11px] text-ink-3">
          <span v-if="card.delta" :class="card.delta.tone" class="mr-1 font-medium" :title="'Comparado ao período anterior de mesmo tamanho'">{{ card.delta.text }}</span>
          {{ card.hint }}
        </p>
      </div>
    </div>

    <div class="card p-4">
      <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p class="text-[13px] font-semibold text-ink">Investimento e vendas por dia</p>
        <p class="flex items-center gap-3 text-[11px] text-ink-3">
          <span class="inline-flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-sm bg-primary" /> Vendas por Ads</span>
          <span class="inline-flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-sm bg-warning" /> Investimento</span>
        </p>
      </div>
      <div class="flex h-36 items-end gap-[2px]" role="img" aria-label="Investimento e vendas por Ads por dia">
        <div
          v-for="day in daily"
          :key="day.date"
          class="group flex h-full max-w-[4rem] flex-1 items-end gap-[1px]"
          :title="`${dayLabel(day.date)}: vendas ${brl(day.total_amount)} · investimento ${brl(day.cost)} · ${int(day.clicks)} cliques`"
        >
          <div class="w-1/2 rounded-t bg-primary opacity-70 group-hover:opacity-100" :style="{ height: `${Math.max(1, (day.total_amount / max) * 100)}%` }" />
          <div class="w-1/2 rounded-t bg-warning opacity-70 group-hover:opacity-100" :style="{ height: `${Math.max(1, (day.cost / max) * 100)}%` }" />
        </div>
      </div>
      <div class="mt-1 flex gap-[2px] text-[10px] text-ink-3">
        <span v-for="(day, i) in daily" :key="day.date" class="flex-1 overflow-visible whitespace-nowrap">{{ i % labelEvery === 0 ? dayLabel(day.date) : '' }}</span>
      </div>
    </div>
  </section>
</template>
