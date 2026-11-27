<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Barras de uma série (ex.: investimento em Ads por dia) do novo layout (27/11/2026): barras finas com 2px de folga,
 * ponta arredondada, grade discreta, tooltip por barra (área de toque maior que a barra) e tabela para leitor de tela.
 */
const props = withDefaults(defineProps<{ labels: string[]; values: number[]; format: (v: number) => string; height?: number; caption: string; color?: string }>(),
  { height: 160, color: 'var(--chart-1)' })

const wrap = ref<HTMLDivElement | null>(null)
const width = ref(360)
let ro: ResizeObserver | undefined
onMounted(() => {
  if (!wrap.value) return
  width.value = wrap.value.clientWidth || 360
  ro = new ResizeObserver((e) => { width.value = Math.max(200, e[0]?.contentRect.width ?? 360) })
  ro.observe(wrap.value)
})
onBeforeUnmount(() => ro?.disconnect())

const PAD = { top: 8, bottom: 22, left: 4, right: 4 }
const innerH = computed(() => props.height - PAD.top - PAD.bottom)
const max = computed(() => Math.max(1, ...props.values))
const slot = computed(() => (width.value - PAD.left - PAD.right) / Math.max(1, props.values.length))
const barW = computed(() => Math.max(2, Math.min(28, slot.value - 2)))
const h = (v: number) => (v / max.value) * innerH.value
const hover = ref<number | null>(null)
const shortDate = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }
const every = computed(() => Math.max(1, Math.ceil(props.values.length / Math.max(2, Math.floor(width.value / 56)))))
function bar(i: number, v: number) {
  const x = PAD.left + i * slot.value + (slot.value - barW.value) / 2
  const top = PAD.top + innerH.value - h(v)
  const r = Math.min(4, barW.value / 2, h(v))
  const bottom = PAD.top + innerH.value
  return `M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW.value - r},${top} Q${x + barW.value},${top} ${x + barW.value},${top + r} L${x + barW.value},${bottom} Z`
}
</script>

<template>
  <div ref="wrap" class="relative w-full" :style="{ height: `${height}px` }">
    <svg :width="width" :height="height" class="block" role="img" :aria-label="caption" @mouseleave="hover = null">
      <line :x1="PAD.left" :x2="width - PAD.right" :y1="PAD.top + innerH" :y2="PAD.top + innerH" class="stroke-chart-grid" />
      <g v-for="(v, i) in values" :key="i">
        <path :d="bar(i, v)" :fill="color" :opacity="hover === null || hover === i ? 1 : 0.45" />
        <rect :x="PAD.left + i * slot" :y="PAD.top" :width="slot" :height="innerH" fill="transparent" @mouseenter="hover = i" />
        <text v-if="i % every === 0 || i === values.length - 1" :x="PAD.left + i * slot + slot / 2" :y="height - 6" text-anchor="middle" class="fill-ink-3 text-[10.5px]">{{ shortDate(labels[i] ?? '') }}</text>
      </g>
    </svg>
    <div
      v-if="hover !== null"
      class="pointer-events-none absolute top-0 z-10 rounded-card border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-lift"
      :style="{ left: `${Math.min(PAD.left + hover * slot, width - 130)}px` }"
    >
      <span class="text-ink-3">{{ shortDate(labels[hover] ?? '') }}</span> · <span class="font-semibold text-ink">{{ format(values[hover] ?? 0) }}</span>
    </div>
    <table class="sr-only"><caption>{{ caption }}</caption><tbody><tr v-for="(v, i) in values" :key="i"><td>{{ shortDate(labels[i] ?? '') }}</td><td>{{ format(v) }}</td></tr></tbody></table>
  </div>
</template>
