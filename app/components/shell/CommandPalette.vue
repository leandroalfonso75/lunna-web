<script setup lang="ts">
import { Dialog, DialogPanel } from '@headlessui/vue'
import { ArrowRightIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, nextTick, ref, watch } from 'vue'
import { NAV_GROUPS, QUICK_ACTIONS, SETTINGS_ITEM, matches, type NavItem } from './navigation'

/**
 * Busca rápida (Ctrl+K ou o campo do topo): digite parte do nome e Enter para ir à página ou à ação. Setas mudam a
 * seleção, Esc fecha. Economiza cliques para quem já sabe aonde quer ir.
 */
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const query = ref('')
const index = ref(0)
const input = ref<HTMLInputElement | null>(null)

const sections = computed(() => {
  const pages = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM].filter((i) => matches(i, query.value))
  const actions = QUICK_ACTIONS.filter((i) => matches(i, query.value))
  return [
    ...(actions.length ? [{ label: 'Ações', items: actions }] : []),
    ...(pages.length ? [{ label: 'Ir para', items: pages }] : [])
  ]
})
const flat = computed(() => sections.value.flatMap((s) => s.items))

watch(() => props.open, async (open) => {
  if (!open) return
  query.value = ''
  index.value = 0
  await nextTick()
  input.value?.focus()
})
watch(query, () => { index.value = 0 })

function go(item: NavItem | undefined) {
  if (!item) return
  emit('close')
  void router.push(item.to)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); index.value = Math.min(index.value + 1, flat.value.length - 1) }
  if (e.key === 'ArrowUp') { e.preventDefault(); index.value = Math.max(index.value - 1, 0) }
  if (e.key === 'Enter') { e.preventDefault(); go(flat.value[index.value]) }
}
const position = (item: NavItem) => flat.value.indexOf(item)
</script>

<template>
  <Dialog :open="open" class="relative z-[150]" @close="emit('close')">
    <div class="fixed inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden="true" />
    <div class="fixed inset-0 flex items-start justify-center p-4 pt-[12vh]">
      <DialogPanel class="w-full max-w-xl overflow-hidden rounded-panel border border-line bg-surface shadow-lift" data-test="busca-rapida">
        <div class="flex items-center gap-3 border-b border-line px-4">
          <MagnifyingGlassIcon class="h-5 w-5 shrink-0 text-ink-3" aria-hidden="true" />
          <input
            ref="input"
            v-model="query"
            class="h-14 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
            placeholder="Buscar página ou ação… (ex.: vendas, criar produto)"
            aria-label="Buscar página ou ação"
            data-test="busca-rapida-campo"
            @keydown="onKey"
          />
          <kbd class="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-3">Esc</kbd>
        </div>
        <div class="max-h-[60vh] overflow-y-auto p-2">
          <p v-if="!flat.length" class="px-3 py-8 text-center text-[13px] text-ink-3">Nada encontrado para "{{ query }}".</p>
          <div v-for="s in sections" :key="s.label" class="py-1">
            <p class="eyebrow px-3 py-1.5">{{ s.label }}</p>
            <button
              v-for="item in s.items"
              :key="item.label"
              type="button"
              class="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left text-[14px]"
              :class="position(item) === index ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-surface-2'"
              data-test="busca-rapida-item"
              @mouseenter="index = position(item)"
              @click="go(item)"
            >
              <component :is="item.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
              <span class="flex-1">{{ item.label }}</span>
              <ArrowRightIcon v-if="position(item) === index" class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-ink-3">
          <span><kbd class="rounded border border-line px-1">↑</kbd> <kbd class="rounded border border-line px-1">↓</kbd> navegar</span>
          <span><kbd class="rounded border border-line px-1">Enter</kbd> abrir</span>
          <span class="ml-auto">Atalho: <kbd class="rounded border border-line px-1">Ctrl</kbd> + <kbd class="rounded border border-line px-1">K</kbd></span>
        </div>
      </DialogPanel>
    </div>
  </Dialog>
</template>
