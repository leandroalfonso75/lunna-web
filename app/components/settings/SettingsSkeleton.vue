<script setup lang="ts">
/** Placeholder de carregamento das listas de Configurações (usuários/contas). */
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>

<template>
  <div class="space-y-3" role="status" aria-label="Carregando">
    <div v-for="i in rows" :key="i" class="card animate-pulse space-y-3 p-5">
      <div class="flex items-center gap-3">
        <div class="h-9 w-9 shrink-0 rounded-full bg-surface-2" />
        <div class="space-y-2">
          <div class="h-3.5 w-32 rounded bg-surface-2" />
          <div class="h-3 w-48 rounded bg-surface-2" />
        </div>
      </div>
    </div>
  </div>
</template>
