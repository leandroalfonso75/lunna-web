<script setup lang="ts">
import { Dialog, DialogPanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import {
  ArrowPathIcon, ArrowRightOnRectangleIcon, Bars3Icon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ChevronUpDownIcon,
  MagnifyingGlassIcon, MoonIcon, RectangleGroupIcon, SunIcon, XMarkIcon
} from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CommandPalette from '../components/shell/CommandPalette.vue'
import { NAV_GROUPS, SETTINGS_ITEM, isActivePath } from '../components/shell/navigation'
import { useAttention } from '../composables/useAttention'
import { useLayoutPref } from '../composables/useLayoutPref'
import { usePageHeader } from '../composables/usePageHeader'
import { useTheme } from '../composables/useTheme'
import { useToast } from '../composables/useToast'
import { useSessionStore } from '../stores/session'

/**
 * Novo layout (27/11/2026, amostra para o usuário avaliar).
 * - Menu lateral escuro (marinho da marca), agrupado por tarefa, que cabe inteiro em 1366×768 e recolhe para só ícones;
 *   contadores do que espera atendimento (perguntas, mensagens, reclamações) ao lado do item.
 * - Topo fixo: título da página, busca rápida (Ctrl+K), estado da sincronização com "Atualizar", tema e menu do usuário
 *   (inclui "Voltar ao layout atual").
 * - Abaixo de 1024px o menu vira gaveta.
 * O conteúdo das páginas continua o mesmo; as páginas redesenhadas usam as classes novas (`panel`, `page-new`...).
 */
const session = useSessionStore()
const auth = useAuth()
const route = useRoute()
const toast = useToast()
const header = usePageHeader()
const attention = useAttention()
const layout = useLayoutPref()
const theme = useTheme()

const drawerOpen = ref(false)
const searchOpen = ref(false)
const collapsed = computed(() => layout.collapsed.value)

watch(() => route.fullPath, () => { drawerOpen.value = false })

function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchOpen.value = true
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function onAccountChange(event: Event) {
  session.selectAccount((event.target as HTMLSelectElement).value)
}
function initials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase() || '?'
}

const syncLabel = computed(() => {
  const s = header.state.sync
  if (!s) return null
  if (s.minutes_ago === null) return 'Sem sincronização'
  if (s.minutes_ago < 1) return 'Atualizado agora'
  if (s.minutes_ago < 60) return `Atualizado há ${s.minutes_ago} min`
  const h = Math.floor(s.minutes_ago / 60)
  return `Atualizado há ${h} h`
})
const syncTone = computed(() => ({ ok: 'bg-success', warn: 'bg-warning', bad: 'bg-danger' }[header.state.sync?.state ?? 'ok'] ?? 'bg-success'))
const isDark = computed(() => theme.resolved.value === 'escuro')
function toggleTheme() { theme.setTheme(isDark.value ? 'claro' : 'escuro') }
</script>

<template>
  <div class="layout-novo min-h-screen bg-bg text-ink lg:flex">
    <a href="#conteudo" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-card focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-ink">Pular para o conteúdo</a>

    <!-- Menu lateral (>= 1024px) -->
    <aside
      class="nv hidden bg-nav-bg text-nav-ink transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:flex-col"
      :class="collapsed ? 'lg:w-[72px]' : 'lg:w-[248px]'"
      data-test="menu-novo"
    >
      <div class="flex h-16 items-center gap-2.5 px-4" :class="collapsed ? 'flex-col justify-center gap-1 px-0 py-2' : ''">
        <NuxtLink to="/" class="flex items-center gap-2.5" aria-label="Lunna, ir para a Visão geral">
          <img src="/brand/lunna-mark-128.png" alt="" width="32" height="32" class="h-8 w-8 shrink-0" :class="collapsed ? 'h-7 w-7' : ''" />
          <span v-if="!collapsed" class="text-[18px] font-bold tracking-tight">Lunna</span>
        </NuxtLink>
        <button
          type="button"
          class="rounded-card p-1 text-nav-ink-2 hover:bg-nav-hover hover:text-nav-ink"
          :class="collapsed ? '' : 'ml-auto'"
          :aria-label="collapsed ? 'Expandir menu' : 'Recolher menu'"
          :title="collapsed ? 'Expandir menu' : 'Recolher menu'"
          data-test="menu-recolher"
          @click="layout.toggleCollapsed()"
        >
          <ChevronDoubleRightIcon v-if="collapsed" class="h-4 w-4" aria-hidden="true" />
          <ChevronDoubleLeftIcon v-else class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <!-- conta -->
      <div v-if="session.mlAccounts.length && !collapsed" class="px-3 pb-2.5">
        <div class="relative rounded-card bg-white/5 px-3 py-1.5 ring-1 ring-white/10 hover:bg-white/10">
          <p class="text-[10px] font-semibold uppercase tracking-[0.08em] text-nav-ink-2">Conta Mercado Livre</p>
          <div class="pointer-events-none flex items-center justify-between gap-2">
            <p class="truncate text-[13px] font-semibold">{{ session.selectedAccount?.nickname ?? 'Selecionar conta' }}</p>
            <ChevronUpDownIcon class="h-4 w-4 shrink-0 text-nav-ink-2" aria-hidden="true" />
          </div>
          <select :value="session.selectedAccountId ?? ''" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Conta do Mercado Livre" data-test="seletor-conta" @change="onAccountChange">
            <option v-for="acc in session.mlAccounts" :key="acc.id" :value="acc.id">{{ acc.nickname }}</option>
          </select>
        </div>
      </div>

      <nav class="flex-1 space-y-2 overflow-y-auto px-3 pb-2" aria-label="Navegação principal">
        <div v-for="group in NAV_GROUPS" :key="group.label">
          <p v-if="!collapsed" class="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-nav-ink-2">{{ group.label }}</p>
          <div v-else class="mx-auto mb-1 h-px w-6 bg-white/10" />
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="group relative flex items-center gap-3 rounded-card px-2.5 py-[5px] text-[14.5px] font-medium transition-colors"
            :class="[isActivePath(route.path, item.to) ? 'bg-nav-active text-white' : 'text-nav-ink-2 hover:bg-nav-hover hover:text-nav-ink', collapsed ? 'justify-center' : '']"
            :title="collapsed ? item.label : undefined"
            data-test="menu-novo-item"
          >
            <span v-if="isActivePath(route.path, item.to)" class="absolute -left-3 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-r bg-primary" aria-hidden="true" />
            <component :is="item.icon" class="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
            <span
              v-if="attention.pending(item.to)"
              class="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white"
              :class="collapsed ? 'absolute right-1 top-0.5 h-4 min-w-4 px-1 text-[10px]' : 'ml-auto'"
              :aria-label="`${attention.pending(item.to)} a atender`"
              data-test="menu-pendente"
            >{{ attention.pending(item.to) }}</span>
          </NuxtLink>
        </div>
      </nav>

      <div class="border-t border-white/10 p-3">
        <NuxtLink
          :to="SETTINGS_ITEM.to"
          class="flex items-center gap-3 rounded-card px-2.5 py-1.5 text-[13.5px] font-medium"
          :class="[isActivePath(route.path, SETTINGS_ITEM.to) ? 'bg-nav-active text-white' : 'text-nav-ink-2 hover:bg-nav-hover hover:text-nav-ink', collapsed ? 'justify-center' : '']"
          :title="collapsed ? SETTINGS_ITEM.label : undefined"
        >
          <component :is="SETTINGS_ITEM.icon" class="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
          <span v-if="!collapsed">{{ SETTINGS_ITEM.label }}</span>
        </NuxtLink>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Topo -->
      <header class="nv sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 md:px-6" data-test="topo-novo">
        <button type="button" class="btn-ghost w-9 shrink-0 px-0 lg:hidden" aria-label="Abrir menu" @click="drawerOpen = true">
          <Bars3Icon class="h-5 w-5" aria-hidden="true" />
        </button>
        <div class="min-w-0 flex-1 lg:flex-none lg:basis-64">
          <p class="truncate text-[19px] font-bold tracking-tight text-ink">{{ header.state.title || 'Lunna' }}</p>
          <p v-if="header.state.subtitle" class="hidden truncate text-[13px] text-ink-2 sm:block">{{ header.state.subtitle }}</p>
        </div>

        <button
          type="button"
          class="mx-auto hidden h-10 w-full max-w-md items-center gap-2 rounded-card border border-line bg-surface-2 px-3 text-left text-[14px] text-ink-3 transition-colors hover:border-primary hover:bg-surface md:flex"
          data-test="abrir-busca"
          @click="searchOpen = true"
        >
          <MagnifyingGlassIcon class="h-4 w-4" aria-hidden="true" />
          <span class="flex-1">Buscar página ou ação…</span>
          <kbd class="rounded border border-line bg-surface px-1.5 text-[11px]">Ctrl K</kbd>
        </button>

        <div class="ml-auto flex items-center gap-1.5 md:ml-0">
          <button type="button" class="btn-ghost w-9 px-0 md:hidden" aria-label="Buscar" @click="searchOpen = true"><MagnifyingGlassIcon class="h-5 w-5" /></button>
          <div v-if="syncLabel" class="hidden items-center gap-2 whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 xl:flex" role="status" data-test="topo-sync">
            <span class="h-2 w-2 rounded-full" :class="syncTone" aria-hidden="true" />
            {{ syncLabel }}
            <button v-if="header.state.onRefresh" type="button" class="-mr-1 rounded-full p-0.5 text-ink-3 hover:bg-surface-2 hover:text-ink" :disabled="header.state.refreshing" aria-label="Atualizar agora" data-test="topo-atualizar" @click="header.state.onRefresh?.()">
              <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': header.state.refreshing }" aria-hidden="true" />
            </button>
          </div>
          <button type="button" class="btn-ghost w-9 px-0" :aria-label="isDark ? 'Usar tema claro' : 'Usar tema escuro'" data-test="topo-tema" @click="toggleTheme">
            <SunIcon v-if="isDark" class="h-5 w-5" aria-hidden="true" />
            <MoonIcon v-else class="h-5 w-5" aria-hidden="true" />
          </button>

          <Menu as="div" class="relative">
            <MenuButton class="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-surface-2" data-test="menu-usuario">
              <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-ink">{{ initials(session.user?.name) }}</span>
              <span class="hidden max-w-[120px] truncate text-[14px] font-semibold text-ink lg:block">{{ session.user?.name }}</span>
            </MenuButton>
            <MenuItems class="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-panel border border-line bg-surface p-1.5 shadow-lift focus:outline-none">
              <div class="px-3 py-2">
                <p class="truncate text-[14px] font-semibold text-ink">{{ session.user?.name }}</p>
                <p class="truncate text-[12px] text-ink-3">{{ session.company?.name }}</p>
              </div>
              <div class="my-1 h-px bg-line" />
              <MenuItem v-slot="{ active }">
                <button type="button" class="flex w-full items-center gap-2.5 rounded-card px-3 py-2 text-left text-[13px]" :class="active ? 'bg-surface-2 text-ink' : 'text-ink-2'" data-test="voltar-layout-atual" @click="layout.setPref('classico')">
                  <RectangleGroupIcon class="h-4 w-4" aria-hidden="true" /> Voltar ao layout atual
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button type="button" class="flex w-full items-center gap-2.5 rounded-card px-3 py-2 text-left text-[13px]" :class="active ? 'bg-danger-soft text-danger' : 'text-ink-2'" @click="auth.logout()">
                  <ArrowRightOnRectangleIcon class="h-4 w-4" aria-hidden="true" /> Sair
                </button>
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
      </header>

      <!-- Gaveta (< 1024px) -->
      <Dialog :open="drawerOpen" class="relative z-50 lg:hidden" @close="drawerOpen = false">
        <div class="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div class="fixed inset-0 flex">
          <DialogPanel class="nv flex h-full w-72 max-w-[85vw] flex-col bg-nav-bg text-nav-ink">
            <div class="flex h-16 items-center justify-between px-4">
              <span class="flex items-center gap-2.5"><img src="/brand/lunna-mark-128.png" alt="" class="h-8 w-8" /><span class="text-[18px] font-bold">Lunna</span></span>
              <button type="button" class="rounded-card p-2 text-nav-ink-2 hover:bg-nav-hover" aria-label="Fechar menu" @click="drawerOpen = false"><XMarkIcon class="h-5 w-5" /></button>
            </div>
            <nav class="flex-1 space-y-4 overflow-y-auto px-3 pb-4" aria-label="Navegação principal">
              <div v-for="group in [...NAV_GROUPS, { label: 'Conta', items: [SETTINGS_ITEM] }]" :key="group.label">
                <p class="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-nav-ink-2">{{ group.label }}</p>
                <NuxtLink
                  v-for="item in group.items"
                  :key="item.to"
                  :to="item.to"
                  class="flex items-center gap-3 rounded-card px-2.5 py-2 text-[14px] font-medium"
                  :class="isActivePath(route.path, item.to) ? 'bg-nav-active text-white' : 'text-nav-ink-2 hover:bg-nav-hover hover:text-nav-ink'"
                >
                  <component :is="item.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
                  {{ item.label }}
                  <span v-if="attention.pending(item.to)" class="ml-auto rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{{ attention.pending(item.to) }}</span>
                </NuxtLink>
              </div>
            </nav>
          </DialogPanel>
        </div>
      </Dialog>

      <main id="conteudo" class="min-w-0 flex-1">
        <slot />
      </main>
    </div>

    <CommandPalette :open="searchOpen" @close="searchOpen = false" />

    <div class="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 lg:inset-x-auto lg:right-4">
      <div
        v-for="t in toast.toasts"
        :key="t.id"
        role="status"
        class="nv pointer-events-auto w-full max-w-sm rounded-panel border p-3 text-[14px] shadow-lift md:w-auto"
        :class="{
          'border-success bg-success-soft text-success': t.kind === 'success',
          'border-danger bg-danger-soft text-danger': t.kind === 'error',
          'border-info bg-info-soft text-info': t.kind === 'info'
        }"
      >
        <div class="flex items-start justify-between gap-3">
          <span>{{ t.text }}</span>
          <button v-if="t.action" type="button" class="shrink-0 font-semibold underline" data-test="toast-acao" @click="toast.act(t)">{{ t.action.label }}</button>
          <button type="button" class="shrink-0 font-semibold" :aria-label="`Fechar aviso: ${t.text}`" @click="toast.dismiss(t.id)">×</button>
        </div>
      </div>
    </div>
  </div>
</template>
