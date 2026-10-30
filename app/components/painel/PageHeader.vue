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

      <!-- `items-start` (não `items-center`/`flex-wrap`): a bolinha e o texto
           precisam ficar SEMPRE na mesma linha, mesmo com o texto quebrando
           ao lado dela — com `flex-wrap` o texto inteiro pulava de linha no
           celular em vez de só quebrar palavra a palavra. `min-w-0` no
           `<span>` do texto é o que permite ele encolher e quebrar. -->
      <div v-if="header.state.sync" class="mt-2 flex items-start gap-2 text-[13px] text-ink-2">
        <span
          class="mt-[3px] inline-flex h-2 w-2 shrink-0 rounded-full"
          :class="{
            'bg-success': header.state.sync.state === 'ok',
            'bg-warning': header.state.sync.state === 'warn',
            'bg-danger': header.state.sync.state === 'bad'
          }"
          aria-hidden="true"
        />
        <span class="min-w-0">
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
        class="mt-2 max-w-2xl rounded-card border px-3 py-2 text-[13px]"
        :class="header.state.sync.state === 'bad' ? 'border-danger bg-danger-soft text-danger' : 'border-warning bg-warning-soft text-warning'"
      >
        <span class="font-semibold">{{ header.state.sync.notice.title }}</span> — {{ header.state.sync.notice.body }}
      </p>
    </div>

    <div class="flex shrink-0 flex-wrap items-center gap-2">
    <!-- ações extras da página (ex.: "Configurar promoções"), ao lado de "Atualizar agora" -->
    <slot name="actions" />
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
    </div>
  </header>
</template>
