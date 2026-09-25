<script setup lang="ts">
import { Bars3Icon, ChartBarIcon, Cog6ToothIcon, HomeIcon, ListBulletIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { useToast } from '../composables/useToast'
import { useSessionStore } from '../stores/session'

/**
 * Layout SaaS com menu lateral (substitui a barra superior do W1): sidebar
 * fixa em >= 1024px (`lg:`), gaveta com overlay abaixo disso — mesma
 * mecânica de gaveta do W1 (fecha ao navegar/Esc), só que agora com a
 * navegação de 4 itens (Visão geral/Anúncios/Curva ABC/Configurações) e o
 * seletor de conta no topo da sidebar em vez do cabeçalho.
 *
 * O título/selo de sync da barra compacta (< 1024px) vêm de
 * `usePageHeader()` (singleton escrito por cada página) — a página é dona
 * dos próprios dados; o layout só lê.
 */
const session = useSessionStore()
const auth = useAuth()
const route = useRoute()
const toast = useToast()
const header = usePageHeader()

const NAV_ITEMS = [
  { to: '/', label: 'Visão geral', icon: HomeIcon },
  { to: '/anuncios', label: 'Anúncios', icon: ListBulletIcon },
  { to: '/curva-abc', label: 'Curva ABC', icon: ChartBarIcon },
  { to: '/configuracoes', label: 'Configurações', icon: Cog6ToothIcon }
]

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

const sair = () => auth.logout()

function onAccountChange(event: Event) {
  session.selectAccount((event.target as HTMLSelectElement).value)
}

// --- Gaveta (< 1024px) -------------------------------------------------------
const drawerOpen = ref(false)

function closeDrawer() {
  drawerOpen.value = false
}

watch(() => route.fullPath, closeDrawer)

function onKeydown(event: KeyboardEvent) {
  if (drawerOpen.value && event.key === 'Escape') closeDrawer()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="min-h-screen bg-bg text-ink lg:flex">
    <a
      href="#conteudo"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-card focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-ink"
    >
      Pular para o conteúdo
    </a>

    <!-- Sidebar fixa (>= 1024px) -->
    <aside class="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
      <div class="px-5 py-5">
        <NuxtLink to="/" class="flex items-center gap-2">
          <img src="/brand/lunna-mark-128.png" alt="" width="32" height="32" class="h-8 w-8 shrink-0" />
          <span class="text-[18px] font-bold text-ink">Lunna</span>
        </NuxtLink>
      </div>

      <div v-if="session.mlAccounts.length >= 1" class="px-3 pb-4">
        <label class="field-label" for="conta-sidebar">Conta do Mercado Livre</label>
        <select
          id="conta-sidebar"
          data-test="seletor-conta"
          :value="session.selectedAccountId ?? ''"
          class="input"
          aria-label="Conta do Mercado Livre"
          @change="onAccountChange"
        >
          <option v-for="acc in session.mlAccounts" :key="acc.id" :value="acc.id">{{ acc.nickname }}</option>
        </select>
      </div>
      <div v-else-if="session.isAdmin" class="px-3 pb-4">
        <NuxtLink to="/configuracoes?aba=contas" class="btn-secondary w-full">Conectar conta</NuxtLink>
      </div>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-3" aria-label="Navegação principal">
        <NuxtLink
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 rounded-card px-3 py-2 text-[14px] font-medium transition-colors"
          :class="isActive(item.to) ? 'bg-primary-soft text-primary' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'"
        >
          <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="border-t border-line px-3 py-4">
        <div class="px-3 pb-3">
          <ThemeToggle compact />
        </div>
        <div class="px-3 pb-2">
          <p class="truncate text-[14px] font-medium text-ink">{{ session.user?.name }}</p>
          <p class="truncate text-[13px] text-ink-3">{{ session.company?.name }}</p>
        </div>
        <button
          type="button"
          class="w-full rounded-card px-3 py-2 text-left text-[14px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          @click="sair"
        >
          Sair
        </button>
      </div>
    </aside>

    <div class="min-w-0 flex-1">
      <!-- Barra compacta (< 1024px): menu + título da página + selo de sync -->
      <header class="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button
          type="button"
          data-test="abrir-menu"
          class="btn-ghost w-9 shrink-0 px-0"
          aria-label="Abrir menu"
          aria-controls="menu-lateral"
          :aria-expanded="drawerOpen ? 'true' : 'false'"
          @click="drawerOpen = true"
        >
          <Bars3Icon class="h-5 w-5" aria-hidden="true" />
        </button>

        <p class="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{{ header.state.title || 'Lunna' }}</p>

        <span
          v-if="header.state.sync"
          role="status"
          class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
          :class="{
            'bg-success': header.state.sync.state === 'ok',
            'bg-warning': header.state.sync.state === 'warn',
            'bg-danger': header.state.sync.state === 'bad'
          }"
          :aria-label="`Sincronização: ${header.state.sync.state}`"
        />
      </header>

      <!-- Gaveta (< 1024px) -->
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-50 flex bg-black/30 lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        @click.self="closeDrawer"
      >
        <div id="menu-lateral" class="flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-surface">
          <div class="flex items-center justify-between px-5 py-4">
            <span class="flex items-center gap-2">
              <img src="/brand/lunna-mark-128.png" alt="" width="32" height="32" class="h-8 w-8 shrink-0" />
              <span class="text-[18px] font-bold text-ink">Lunna</span>
            </span>
            <button type="button" data-test="fechar-menu" class="btn-ghost" aria-label="Fechar menu" @click="closeDrawer">
              <XMarkIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div v-if="session.mlAccounts.length >= 1" class="px-3 py-3">
            <label class="field-label" for="conta-gaveta">Conta do Mercado Livre</label>
            <select id="conta-gaveta" :value="session.selectedAccountId ?? ''" class="input" @change="onAccountChange">
              <option v-for="acc in session.mlAccounts" :key="acc.id" :value="acc.id">{{ acc.nickname }}</option>
            </select>
          </div>
          <div v-else-if="session.isAdmin" class="px-3 py-3">
            <NuxtLink to="/configuracoes?aba=contas" class="btn-secondary w-full" @click="closeDrawer">Conectar conta</NuxtLink>
          </div>

          <nav class="flex flex-col gap-1 px-3" aria-label="Navegação principal">
            <NuxtLink
              v-for="item in NAV_ITEMS"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-2.5 rounded-card px-3 py-2 text-[14px] font-medium"
              :class="isActive(item.to) ? 'bg-primary-soft text-primary' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'"
            >
              <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {{ item.label }}
            </NuxtLink>
          </nav>

          <div class="flex-1" />

          <div class="border-t border-line px-3 py-4">
            <div class="px-3 pb-3">
              <ThemeToggle compact />
            </div>
            <div class="px-3 pb-2">
              <p class="truncate text-[14px] font-medium text-ink">{{ session.user?.name }}</p>
              <p class="truncate text-[13px] text-ink-3">{{ session.company?.name }}</p>
            </div>
            <button
              type="button"
              class="w-full rounded-card px-3 py-2 text-left text-[14px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              @click="sair"
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      <main id="conteudo" class="min-w-0">
        <slot />
      </main>
    </div>

    <div class="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 lg:inset-x-auto lg:right-4">
      <div
        v-for="t in toast.toasts"
        :key="t.id"
        role="status"
        class="pointer-events-auto w-full max-w-sm rounded-card border p-3 text-[14px] shadow-card md:w-auto"
        :class="{
          'border-success bg-success-soft text-success': t.kind === 'success',
          'border-danger bg-danger-soft text-danger': t.kind === 'error',
          'border-info bg-info-soft text-info': t.kind === 'info'
        }"
      >
        <div class="flex items-start justify-between gap-3">
          <span>{{ t.text }}</span>
          <button type="button" class="shrink-0 font-semibold" :aria-label="`Fechar aviso: ${t.text}`" @click="toast.dismiss(t.id)">×</button>
        </div>
      </div>
    </div>
  </div>
</template>
