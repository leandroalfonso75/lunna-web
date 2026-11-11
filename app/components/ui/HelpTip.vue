<script setup lang="ts">
/**
 * Ponto de interrogação com explicação: ao passar o mouse (ou focar pelo teclado/tocar), mostra um card com o texto.
 * Cada item de `text` vira um parágrafo.
 */
defineProps<{ text: string[]; label?: string }>()
</script>

<template>
  <span class="group relative inline-flex align-middle">
    <button
      type="button"
      class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] font-semibold leading-none text-ink-3 hover:border-primary hover:text-primary focus:border-primary focus:text-primary focus:outline-none"
      :aria-label="label ?? 'O que é isto?'"
    >?</button>
    <span
      role="tooltip"
      class="invisible absolute left-0 top-full z-30 mt-1 w-[340px] max-w-[80vw] space-y-1.5 rounded-card border border-line bg-surface p-3 text-left text-[12px] font-normal leading-snug text-ink-2 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
    >
      <span v-for="(p, i) in text" :key="i" class="block">{{ p }}</span>
    </span>
  </span>
</template>
