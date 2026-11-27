<script setup lang="ts">
/**
 * Filtros em chips do layout novo (27/11/2026): pílula com contador e bolinha de cor (a cor nunca é o único sinal: o
 * texto diz o que é). Opcionalmente com um rótulo do grupo à esquerda ("Envio", "Logística"...).
 */
export interface NvChip {
  value: string
  label: string
  count?: number | null
  tone?: 'danger' | 'warning' | 'success' | 'accent' | 'info'
  hint?: string
}

defineProps<{ chips: NvChip[]; modelValue: string; label?: string; testPrefix?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const DOT: Record<string, string> = { danger: 'bg-danger', warning: 'bg-warning', success: 'bg-success', accent: 'bg-accent', info: 'bg-primary' }
const fmt = (n: number) => n.toLocaleString('pt-BR')
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="label ?? 'Filtros'">
    <span v-if="label" class="mr-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-3">{{ label }}</span>
    <button
      v-for="c in chips"
      :key="c.value"
      type="button"
      :class="modelValue === c.value ? 'chip-active' : 'chip'"
      :aria-pressed="modelValue === c.value"
      :title="c.hint"
      :data-test="`${testPrefix ?? 'filtro'}-${c.value || 'todos'}`"
      @click="emit('update:modelValue', c.value)"
    >
      <span v-if="c.tone" class="h-2 w-2 rounded-full" :class="DOT[c.tone]" aria-hidden="true" />
      {{ c.label }}
      <span v-if="c.count !== undefined && c.count !== null" class="chip-count" data-numeric>{{ fmt(c.count) }}</span>
    </button>
  </div>
</template>
