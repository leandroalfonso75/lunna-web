<script setup lang="ts">
import { computed, ref } from 'vue'
import { brl } from '../../lib/format'
import type { FinanceDailyPoint } from '../../types/finance'

/**
 * Gráfico de linhas (SVG) do período atual contra o anterior, alinhados pela posição do dia (1º dia com 1º dia).
 * `metric` escolhe receita ou lucro pós Ads.
 */
const props = defineProps<{ daily: FinanceDailyPoint[]; metric: 'revenue' | 'profit'; previousLabel: string }>()

const W = 720
const H = 220
const PAD = { l: 56, r: 12, t: 12, b: 28 }
const hover = ref<number | null>(null)

const cur = computed(() => props.daily.map((d) => (props.metric === 'revenue' ? d.revenue : d.profit)))
const prev = computed(() => props.daily.map((d) => (props.metric === 'revenue' ? d.previous_revenue : d.previous_profit)))
const max = computed(() => Math.max(1, ...cur.value, ...prev.value.map((v) => v ?? 0)))
const min = computed(() => Math.min(0, ...cur.value, ...prev.value.map((v) => v ?? 0)))

function x(i: number) {
  const n = Math.max(1, props.daily.length - 1)
  return PAD.l + (i / n) * (W - PAD.l - PAD.r)
}
function y(v: number) {
  const span = max.value - min.value || 1
  return PAD.t + (1 - (v - min.value) / span) * (H - PAD.t - PAD.b)
}
function path(values: (number | null)[]) {
  let d = ''
  values.forEach((v, i) => {
    if (v === null || v === undefined) return
    d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
  })
  return d
}
const ticks = computed(() => {
  const steps = 4
  return Array.from({ length: steps + 1 }, (_, k) => min.value + ((max.value - min.value) * k) / steps)
})
function label(date: string) {
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}
const labelEvery = computed(() => Math.max(1, Math.ceil(props.daily.length / 10)))
const point = computed(() => (hover.value === null ? null : props.daily[hover.value]))
function short(v: number) {
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)} mil` : v.toFixed(0)
}
</script>

<template>
  <div>
    <p class="mb-1 h-5 text-[12px] text-ink-2" role="status">
      <template v-if="point">
        {{ label(point.date) }}: <strong>{{ brl(metric === 'revenue' ? point.revenue : point.profit) }}</strong> · {{ point.orders }} vendas
        <template v-if="point.previous_date"> · {{ previousLabel }} ({{ label(point.previous_date) }}): {{ brl((metric === 'revenue' ? point.previous_revenue : point.previous_profit) ?? 0) }} · {{ point.previous_orders }} vendas</template>
      </template>
      <template v-else>&nbsp;</template>
    </p>
    <svg :viewBox="`0 0 ${W} ${H}`" class="h-auto w-full" role="img" :aria-label="metric === 'revenue' ? 'Receita por dia' : 'Lucro por dia'">
      <g v-for="(t, k) in ticks" :key="k">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(t)" :y2="y(t)" class="stroke-line" stroke-width="1" />
        <text :x="PAD.l - 6" :y="y(t) + 4" text-anchor="end" class="fill-ink-3" font-size="10">{{ short(t) }}</text>
      </g>
      <line v-if="min < 0" :x1="PAD.l" :x2="W - PAD.r" :y1="y(0)" :y2="y(0)" class="stroke-ink-3" stroke-width="1" />
      <path :d="path(prev)" fill="none" class="stroke-ink-3" stroke-width="2" stroke-dasharray="4 3" />
      <path :d="path(cur)" fill="none" class="stroke-primary" stroke-width="2.5" />
      <g v-for="(d, i) in daily" :key="d.date">
        <text v-if="i % labelEvery === 0" :x="x(i)" :y="H - 8" text-anchor="middle" class="fill-ink-3" font-size="10">{{ label(d.date) }}</text>
        <circle :cx="x(i)" :cy="y(cur[i] ?? 0)" :r="hover === i ? 4 : 2.5" class="fill-primary" />
        <rect :x="x(i) - (W - PAD.l - PAD.r) / Math.max(1, daily.length) / 2" :y="PAD.t" :width="(W - PAD.l - PAD.r) / Math.max(1, daily.length)" :height="H - PAD.t - PAD.b" fill="transparent" @mouseenter="hover = i" @mouseleave="hover = null" />
      </g>
    </svg>
    <div class="mt-1 flex gap-4 text-[12px] text-ink-2">
      <span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-5 bg-primary" /> Período atual</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-5 border-t-2 border-dashed border-ink-3" /> {{ previousLabel }}</span>
    </div>
  </div>
</template>
