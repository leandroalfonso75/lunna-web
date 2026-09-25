<script setup lang="ts">
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, ref, type FunctionalComponent } from 'vue'
import { useTheme } from '../composables/useTheme'
import type { ThemeMode } from '../lib/theme'

/**
 * Seletor de tema — Claro/Escuro/Sistema sempre visíveis (não um dropdown:
 * "sistema" também precisa aparecer marcado, não só claro/escuro).
 * `role="radiogroup"`/`role="radio"` é a semântica certa: três opções
 * mutuamente exclusivas, sempre uma selecionada.
 *
 * Pode aparecer em mais de um lugar ao mesmo tempo (cabeçalho, gaveta,
 * Configurações) — todos montam este MESMO componente, que só lê/escreve em
 * `useTheme()` (singleton): mudar num lugar reflete nos outros na hora.
 */
withDefaults(defineProps<{ label?: string; compact?: boolean }>(), { label: 'Tema', compact: false })

const theme = useTheme()

// O servidor não conhece o tema salvo no navegador e a hidratação não corrige
// classe divergente em produção: a opção ativa só é marcada depois de montar.
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const activeMode = computed(() => (mounted.value ? theme.mode.value : null))

const OPTIONS: { value: ThemeMode; label: string; icon: FunctionalComponent }[] = [
  { value: 'claro', label: 'Claro', icon: SunIcon },
  { value: 'escuro', label: 'Escuro', icon: MoonIcon },
  { value: 'sistema', label: 'Sistema', icon: ComputerDesktopIcon }
]
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="inline-flex rounded-card border border-line bg-surface p-0.5">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="activeMode === option.value"
      :data-test="`tema-${option.value}`"
      :title="option.label"
      :aria-label="option.label"
      class="inline-flex items-center gap-1.5 rounded-[8px] py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
      :class="[compact ? 'px-2' : 'px-2.5', activeMode === option.value ? 'bg-primary-soft text-primary hover:text-primary' : '']"
      @click="theme.setTheme(option.value)"
    >
      <component :is="option.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
      <span v-if="!compact">{{ option.label }}</span>
    </button>
  </div>
</template>
