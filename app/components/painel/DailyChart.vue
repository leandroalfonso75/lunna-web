<script setup lang="ts">
import { computed, ref } from 'vue'
import { brl, int } from '../../lib/format'
import type { DailyPoint, DailyScale } from '../../types/painel'

const props = defineProps<{ daily: DailyPoint[]; scale: DailyScale }>()

const activeIndex = ref<number | null>(null)
const activePoint = computed(() => (activeIndex.value === null ? undefined : props.daily[activeIndex.value]))

function dayLabel(day: string): string {
  // `day` é "AAAA-MM-DD" (SPEC §6); "DD/MM" é só um recorte, sem
  // reinterpretar fuso — o dia já vem calculado no back.
  const [, month, d] = day.split('-')
  return `${d}/${month}`
}

function unitsHeight(point: DailyPoint): number {
  if (props.scale.units_max <= 0) return 0
  return Math.min(100, (point.units / props.scale.units_max) * 100)
}

function visitsHeight(point: DailyPoint): number {
  if (props.scale.visits_max <= 0) return 0
  return Math.min(100, (point.visits / props.scale.visits_max) * 100)
}

function tooltip(point: DailyPoint): string {
  // `dateTimeShort`/`timeShort` (lib/format.ts) reinterpretam o valor num
  // fuso — errado aqui, `day` já é só a data ("AAAA-MM-DD"), sem hora.
  return `${dayLabel(point.day)}${point.is_today ? ' (hoje)' : ''} · ${int(point.units)} un. · ${brl(point.revenue)} · ${int(point.orders)} pedidos · ${int(point.visits)} visitas`
}
</script>

<template>
  <div class="card p-4">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title">Últimos 15 dias</h2>
      <div class="flex items-center gap-4 text-[13px] text-ink-2">
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-primary" /> Unidades</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-info" /> Visitas</span>
      </div>
    </div>

    <p class="mb-2 h-5 text-[13px] text-ink-2" role="status">
      {{ activePoint ? tooltip(activePoint) : '\u00a0' }}
    </p>

    <div class="flex items-end gap-1" style="height: 96px">
      <button
        v-for="(point, i) in daily"
        :key="`u-${point.day}`"
        type="button"
        class="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-t-[3px] outline-none"
        :aria-label="tooltip(point)"
        @mouseenter="activeIndex = i"
        @mouseleave="activeIndex = null"
        @focus="activeIndex = i"
        @blur="activeIndex = null"
      >
        <span v-if="point.units > 0" class="text-[11px] leading-none text-ink-3" data-numeric>{{ int(point.units) }}</span>
        <span
          class="w-full rounded-t-[3px] transition-colors"
          :class="point.is_today ? 'bg-primary' : 'bg-primary/60 group-hover:bg-primary group-focus-visible:bg-primary'"
          :style="{ height: `${Math.max(unitsHeight(point), point.units > 0 ? 2 : 0)}%` }"
        />
      </button>
    </div>

    <div class="mt-1 flex items-start gap-1" style="height: 64px">
      <button
        v-for="(point, i) in daily"
        :key="`v-${point.day}`"
        type="button"
        class="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-b-[3px] outline-none"
        :aria-label="tooltip(point)"
        @mouseenter="activeIndex = i"
        @mouseleave="activeIndex = null"
        @focus="activeIndex = i"
        @blur="activeIndex = null"
      >
        <span
          class="w-full rounded-b-[3px] transition-colors"
          :class="point.is_today ? 'bg-info' : 'bg-info/50 group-hover:bg-info group-focus-visible:bg-info'"
          :style="{ height: `${Math.max(visitsHeight(point), point.visits > 0 ? 2 : 0)}%` }"
        />
        <span class="text-[11px] leading-none text-ink-3" :class="{ 'font-semibold text-ink': point.is_today }">{{ dayLabel(point.day) }}</span>
      </button>
    </div>
  </div>
</template>
