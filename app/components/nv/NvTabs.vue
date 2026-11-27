<script setup lang="ts">
/**
 * Guias principais do layout novo (27/11/2026, padrão aprovado em Promoções): trilho com pílulas grandes, contador e
 * uma linha de explicação da guia aberta. Um nível só; o segundo nível vira chips (NvChips).
 */
export interface NvTab {
  key: string
  label: string
  count?: number | null
  /** Contador em vermelho (pede atenção). */
  alert?: boolean
  hint?: string
}

const props = defineProps<{ tabs: NvTab[]; modelValue: string; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [key: string] }>()
const fmt = (n: number) => n.toLocaleString('pt-BR')
const active = () => props.tabs.find((t) => t.key === props.modelValue)
</script>

<template>
  <div class="space-y-2">
    <div class="ntabs" role="tablist" :aria-label="label ?? 'Guias'">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        role="tab"
        :aria-selected="modelValue === t.key"
        :class="modelValue === t.key ? 'ntab-active' : 'ntab'"
        :data-test="`guia-${t.key}`"
        @click="emit('update:modelValue', t.key)"
      >
        {{ t.label }}
        <span v-if="t.count !== undefined && t.count !== null" class="ntab-count" :class="t.alert && modelValue !== t.key && t.count > 0 ? 'ntab-count-alert' : ''" data-numeric>{{ fmt(t.count) }}</span>
      </button>
    </div>
    <p v-if="active()?.hint" class="px-1 text-[14px] text-ink-2" data-test="explica-guia">{{ active()?.hint }}</p>
  </div>
</template>
