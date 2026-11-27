<script setup lang="ts">
/**
 * Barra de ações em massa do layout novo (27/11/2026): aparece fixa embaixo quando há itens marcados, com o número,
 * as ações (slot) e "Desmarcar". A confirmação de cada ação fica com quem usa.
 */
defineProps<{ count: number; noun?: [string, string] }>()
const emit = defineEmits<{ clear: [] }>()
</script>

<template>
  <Transition enter-from-class="translate-y-6 opacity-0" enter-active-class="transition duration-200" leave-to-class="translate-y-6 opacity-0" leave-active-class="transition duration-150">
    <div v-if="count" class="nv sticky bottom-4 z-20 mx-auto flex max-w-4xl flex-wrap items-center gap-3 rounded-panel border border-line bg-surface px-4 py-3 shadow-lift" data-test="barra-lote">
      <span class="flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-[14px] font-bold text-primary-ink" data-numeric>{{ count }}</span>
      <span class="text-[14px] font-semibold text-ink">{{ count === 1 ? (noun?.[0] ?? 'marcado') : (noun?.[1] ?? 'marcados') }}</span>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <slot />
        <button type="button" class="nbtn-ghost" data-test="desmarcar" @click="emit('clear')">Desmarcar</button>
      </div>
      <div v-if="$slots.confirm" class="w-full"><slot name="confirm" /></div>
    </div>
  </Transition>
</template>
