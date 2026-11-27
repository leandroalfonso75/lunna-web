<script setup lang="ts">
import { CalendarDaysIcon } from '@heroicons/vue/24/outline'

/**
 * Escolha de período do layout novo (27/11/2026): atalhos em chips, lista de meses e intervalo de datas, numa linha.
 * Só apresenta: quem usa decide o que cada valor significa (mesmos valores do layout atual).
 */
defineProps<{
  periods: { value: string; label: string }[]
  period: string
  months?: { value: string; label: string; current?: boolean; partial?: boolean }[]
  from?: string
  to?: string
  /** Prefixo do valor de mês no `period` (ex.: "month:"). */
  monthPrefix?: string
}>()
const emit = defineEmits<{ period: [value: string]; range: [which: 'from' | 'to', value: string] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 rounded-panel border border-line bg-surface px-3 py-2.5 shadow-card" role="group" aria-label="Período">
    <CalendarDaysIcon class="h-5 w-5 shrink-0 text-ink-3" aria-hidden="true" />
    <button
      v-for="p in periods"
      :key="p.value"
      type="button"
      :class="period === p.value ? 'chip-active' : 'chip'"
      :aria-pressed="period === p.value"
      :data-test="`periodo-${p.value}`"
      @click="emit('period', p.value)"
    >{{ p.label }}</button>
    <select
      v-if="months?.length"
      class="input h-9 w-auto rounded-full text-[14px]"
      :class="period.startsWith(monthPrefix ?? 'month:') ? '!border-primary !bg-primary-soft font-semibold !text-primary' : ''"
      aria-label="Mês"
      data-test="periodo-mes"
      :value="period.startsWith(monthPrefix ?? 'month:') ? period : ''"
      @change="emit('period', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled>Mês</option>
      <option v-for="m in months" :key="m.value" :value="`${monthPrefix ?? 'month:'}${m.value}`">
        {{ m.label }}{{ m.current ? ' (até hoje)' : m.partial ? ' (parcial)' : '' }}
      </option>
    </select>
    <template v-if="from !== undefined">
      <span class="text-[13px] text-ink-3">ou</span>
      <input type="date" class="input h-9 w-auto text-[14px]" :value="from" aria-label="Data inicial" @change="emit('range', 'from', ($event.target as HTMLInputElement).value)" />
      <span class="text-[13px] text-ink-3">até</span>
      <input type="date" class="input h-9 w-auto text-[14px]" :value="to" aria-label="Data final" @change="emit('range', 'to', ($event.target as HTMLInputElement).value)" />
    </template>
    <div class="ml-auto flex items-center gap-2"><slot /></div>
  </div>
</template>
