<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { usePageHeader } from '../../composables/usePageHeader'
import { timeShort } from '../../lib/format'

/**
 * Cabeçalho de página padronizado, reutilizado nas três páginas do painel:
 * título, subtítulo, selo de sync (cor por `sync.state`, "Sincronizado às
 * HH:MM (há N min) · consultado às HH:MM") e "Atualizar agora". Lê tudo de
 * `usePageHeader()` (module-scope) — quem escreve é a página (`watchEffect`
 * ligado ao composable de dados dela).
 */
const header = usePageHeader()
</script>

<template>
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="page-title">{{ header.state.title }}</h1>
      <p v-if="header.state.subtitle" class="page-subtitle">{{ header.state.subtitle }}</p>

      <div v-if="header.state.sync" class="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <span
          class="inline-flex h-2 w-2 shrink-0 rounded-full"
          :class="{
            'bg-success': header.state.sync.state === 'ok',
            'bg-warning': header.state.sync.state === 'warn',
            'bg-danger': header.state.sync.state === 'bad'
          }"
          aria-hidden="true"
        />
        <span>
          <template v-if="header.state.sync.last_ok_at">
            Sincronizado às {{ timeShort(header.state.sync.last_ok_at) }}
            <template v-if="header.state.sync.minutes_ago !== null">(há {{ header.state.sync.minutes_ago }} min)</template>
          </template>
          <template v-else>Ainda sem sincronização</template>
          <template v-if="header.state.generatedAt"> · consultado às {{ timeShort(header.state.generatedAt) }}</template>
        </span>
      </div>

      <p
        v-if="header.state.sync?.notice"
        class="mt-1 max-w-2xl text-[13px]"
        :class="header.state.sync.state === 'bad' ? 'text-danger' : 'text-warning'"
      >
        {{ header.state.sync.notice.title }} — {{ header.state.sync.notice.body }}
      </p>
    </div>

    <button
      type="button"
      data-test="atualizar-agora"
      class="btn-secondary shrink-0"
      :disabled="header.state.refreshing"
      @click="header.state.onRefresh?.()"
    >
      <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': header.state.refreshing }" aria-hidden="true" />
      Atualizar agora
    </button>
  </header>
</template>
