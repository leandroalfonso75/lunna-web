<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Gráfico de linhas/área do novo layout (27/11/2026), em SVG puro (o projeto não tem biblioteca de gráficos).
 * Regras: um eixo só (as séries têm a mesma unidade), linhas de 2px, grade discreta, legenda sempre com 2+ séries,
 * cruz + tooltip ao passar o mouse, tabela acessível escondida para leitor de tela. Cores vêm dos tokens `--chart-*`
 * (azul + laranja, validados para daltonismo nos dois temas).
 */
export interface TrendSeries { key: string; label: string; color: string; values: (number | null)[]; dashed?: boolean; area?: boolean }

const props = withDefaults(defineProps<{
  labels: string[]
  series: TrendSeries[]
  format: (v: number) => string
  height?: number
  caption: string
}>(), { height: 260 })

const wrap = ref<HTMLDivElement | null>(null)
const width = ref(720)
let ro: ResizeObserver | undefined
onMounted(() => {
  if (!wrap.value) return
  width.value = wrap.value.clientWidth || 720
  ro = new ResizeObserver((entries) => { width.value = Math.max(280, entries[0]?.contentRect.width ?? 720) })
  ro.observe(wrap.value)
})
onBeforeUnmount(() => ro?.disconnect())

const PAD = { top: 12, right: 12, bottom: 28, left: 64 }
const innerW = computed(() => width.value - PAD.left - PAD.right)
const innerH = computed(() => props.height - PAD.top - PAD.bottom)

/** Teto "redondo" do eixo (1, 2, 2,5, 5 × 10ⁿ) e 4 linhas de grade. */
const scale = computed(() => {
  const all = props.series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  const max = Math.max(0, ...all)
  const min = Math.min(0, ...all)
  const span = max - min || 1
  const raw = span / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step || step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return { lo, hi, ticks }
})

const n = computed(() => props.labels.length)
const x = (i: number) => PAD.left + (n.value <= 1 ? innerW.value / 2 : (i / (n.value - 1)) * innerW.value)
const y = (v: number) => PAD.top + innerH.value - ((v - scale.value.lo) / (scale.value.hi - scale.value.lo || 1)) * innerH.value

function linePath(values: (number | null)[]) {
  let d = ''
  values.forEach((v, i) => {
    if (v === null) return
    d += `${d === '' || values[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  return d
}
function areaPath(values: (number | null)[]) {
  const pts = values.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter((p): p is readonly [number, number] => p !== null)
  if (!pts.length) return ''
  const base = y(Math.max(scale.value.lo, 0))
  return `M${pts[0]![0]},${base} ${pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} L${pts[pts.length - 1]![0]},${base} Z`
}

const shortDate = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }
const xTicks = computed(() => {
  const every = Math.max(1, Math.ceil(n.value / Math.max(2, Math.floor(innerW.value / 70))))
  return props.labels.map((l, i) => ({ i, label: shortDate(l) })).filter((t) => t.i % every === 0 || t.i === n.value - 1)
})
const compact = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (a >= 1_000) return `${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

// hover
const hover = ref<number | null>(null)
function onMove(e: MouseEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const px = e.clientX - rect.left
  if (n.value <= 1) { hover.value = 0; return }
  const i = Math.round(((px - PAD.left) / innerW.value) * (n.value - 1))
  hover.value = Math.min(n.value - 1, Math.max(0, i))
}
const tipLeft = computed(() => (hover.value === null ? 0 : Math.min(Math.max(x(hover.value) + 12, 0), width.value - 200)))
const gradId = `g-${Math.random().toString(36).slice(2, 8)}`
const weekday = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
</script>

<template>
  <div class="space-y-2">
    <div v-if="series.length > 1" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2" data-test="grafico-legenda">
      <span v-for="s in series" :key="s.key" class="inline-flex items-center gap-1.5">
        <svg width="18" height="8" aria-hidden="true"><line x1="1" y1="4" x2="17" y2="4" :stroke="s.color" stroke-width="2.5" :stroke-dasharray="s.dashed ? '4 3' : undefined" stroke-linecap="round" /></svg>
        {{ s.label }}
      </span>
    </div>
    <div ref="wrap" class="relative w-full" :style="{ height: `${height}px` }">
      <svg :width="width" :height="height" class="block" role="img" :aria-label="caption" @mousemove="onMove" @mouseleave="hover = null">
        <defs>
          <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="series[0]?.color" stop-opacity="0.22" />
            <stop offset="100%" :stop-color="series[0]?.color" stop-opacity="0" />
          </linearGradient>
        </defs>
        <g v-for="t in scale.ticks" :key="t">
          <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(t)" :y2="y(t)" class="stroke-chart-grid" :stroke-dasharray="t === 0 ? undefined : '3 4'" />
          <text :x="PAD.left - 10" :y="y(t) + 4" text-anchor="end" class="fill-ink-3 text-[12px]" style="font-variant-numeric: tabular-nums">{{ compact(t) }}</text>
        </g>
        <text v-for="t in xTicks" :key="t.i" :x="x(t.i)" :y="height - 8" text-anchor="middle" class="fill-ink-3 text-[12px]">{{ t.label }}</text>
        <template v-for="(s, k) in series" :key="s.key">
          <path v-if="s.area && k === 0" :d="areaPath(s.values)" :fill="`url(#${gradId})`" />
          <path :d="linePath(s.values)" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" :stroke-dasharray="s.dashed ? '5 4' : undefined" :opacity="s.dashed ? 0.75 : 1" />
        </template>
        <g v-if="hover !== null">
          <line :x1="x(hover)" :x2="x(hover)" :y1="PAD.top" :y2="PAD.top + innerH" class="stroke-ink-3" stroke-width="1" stroke-dasharray="3 3" />
          <template v-for="s in series" :key="s.key">
            <circle v-if="s.values[hover] !== null && s.values[hover] !== undefined" :cx="x(hover)" :cy="y(s.values[hover] as number)" r="4.5" :fill="s.color" class="stroke-surface" stroke-width="2" />
          </template>
        </g>
        <rect :x="PAD.left" :y="PAD.top" :width="innerW" :height="innerH" fill="transparent" />
      </svg>
      <div
        v-if="hover !== null"
        class="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-card border border-line bg-surface px-3 py-2 text-[13px] shadow-lift"
        :style="{ left: `${tipLeft}px` }"
        data-test="grafico-tooltip"
      >
        <p class="mb-1 font-semibold capitalize text-ink">{{ weekday(labels[hover] ?? '') }}</p>
        <p v-for="s in series" :key="s.key" class="flex items-center justify-between gap-4 text-ink-2">
          <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" :style="{ background: s.color }" />{{ s.label }}</span>
          <span class="font-semibold text-ink" style="font-variant-numeric: tabular-nums">{{ s.values[hover] === null || s.values[hover] === undefined ? '—' : format(s.values[hover] as number) }}</span>
        </p>
      </div>
    </div>
    <table class="sr-only">
      <caption>{{ caption }}</caption>
      <thead><tr><th>Dia</th><th v-for="s in series" :key="s.key">{{ s.label }}</th></tr></thead>
      <tbody><tr v-for="(l, i) in labels" :key="l"><td>{{ shortDate(l) }}</td><td v-for="s in series" :key="s.key">{{ s.values[i] === null || s.values[i] === undefined ? '—' : format(s.values[i] as number) }}</td></tr></tbody>
    </table>
  </div>
</template>
