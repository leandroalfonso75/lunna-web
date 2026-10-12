<script setup lang="ts">
import { Dialog, DialogPanel } from '@headlessui/vue'
import {
  Bars3Icon,
  ChartBarIcon,
  ChevronUpDownIcon,
  Cog6ToothIcon,
  HomeIcon,
  ListBulletIcon,
  SignalIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { ref, watch } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { useToast } from '../composables/useToast'
import { useSessionStore } from '../stores/session'

/**
 * Layout SaaS com menu lateral (substitui a barra superior do W1): sidebar
 * fixa em >= 1024px (`lg:`), gaveta com overlay abaixo disso. A gaveta usa
 * `Dialog`/`DialogPanel` do headlessui — foco preso, fecha com Esc/clique
 * fora e devolve o foco ao botão que abriu, tudo de graça (nenhum código de
 * focus-trap escrito à mão aqui).
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

const NAV_SECTIONS = [
  {
    label: 'Painel',
    items: [
      { to: '/', label: 'Visão geral', icon: HomeIcon },
      { to: '/anuncios', label: 'Anúncios', icon: ListBulletIcon },
      { to: '/curva-abc', label: 'Curva ABC', icon: ChartBarIcon },
      { to: '/radar-ml', label: 'Radar Mercado Livre', icon: SignalIcon }
    ]
  },
  {
    label: 'Conta',
    items: [{ to: '/configuracoes', label: 'Configurações', icon: Cog6ToothIcon }]
  }
]

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

const sair = () => auth.logout()

function onAccountChange(event: Event) {
  session.selectAccount((event.target as HTMLSelectElement).value)
}

/** Iniciais do nome (até 2 letras) para o avatar do rodapé da sidebar. */
function initials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

// --- Gaveta (< 1024px) -------------------------------------------------------
const drawerOpen = ref(false)

function closeDrawer() {
  drawerOpen.value = false
}

watch(() => route.fullPath, closeDrawer)
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
    <aside class="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
      <div class="px-5 py-5">
        <NuxtLink to="/" class="flex items-center gap-2">
          <img src="/brand/lunna-mark-128.png" alt="" width="32" height="32" class="h-8 w-8 shrink-0" />
          <span class="text-[18px] font-bold text-ink">Lunna</span>
        </NuxtLink>
      </div>

      <div v-if="session.mlAccounts.length >= 1" class="px-3 pb-4">
        <div class="relative">
          <label for="conta-sidebar" class="field-label">Conta do Mercado Livre</label>
          <div class="pointer-events-none flex items-center justify-between gap-2 rounded-card border border-line bg-surface px-3 py-2">
            <div class="min-w-0">
              <p class="truncate text-[14px] font-semibold text-ink">{{ session.selectedAccount?.nickname ?? 'Selecionar conta' }}</p>
              <p class="truncate text-[12px] text-ink-3">Seller ID {{ session.selectedAccount?.seller_id }}</p>
            </div>
            <ChevronUpDownIcon class="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
          </div>
          <select
            id="conta-sidebar"
            data-test="seletor-conta"
            :value="session.selectedAccountId ?? ''"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Conta do Mercado Livre"
            @change="onAccountChange"
          >
            <option v-for="acc in session.mlAccounts" :key="acc.id" :value="acc.id">{{ acc.nickname }}</option>
          </select>
        </div>
      </div>
      <div v-else-if="session.isAdmin" class="px-3 pb-4">
        <NuxtLink to="/configuracoes?aba=contas" class="btn-secondary w-full">Conectar conta</NuxtLink>
      </div>

      <nav class="flex flex-1 flex-col gap-5 overflow-y-auto px-3" aria-label="Navegação principal">
        <div v-for="section in NAV_SECTIONS" :key="section.label">
          <p class="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{{ section.label }}</p>
          <div class="flex flex-col gap-1">
            <NuxtLink
              v-for="item in section.items"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-2.5 rounded-card border-l-[3px] px-3 py-2 text-[14px] font-medium transition-colors"
              :class="isActive(item.to) ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink'"
            >
              <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {{ item.label }}
            </NuxtLink>
          </div>
        </div>
      </nav>

      <div class="border-t border-line px-3 py-4">
        <div class="px-3 pb-3">
          <ThemeToggle compact />
        </div>
        <div class="flex items-center gap-2.5 px-3 pb-2">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary">
            {{ initials(session.user?.name) }}
          </div>
          <div class="min-w-0">
            <p class="truncate text-[14px] font-medium text-ink">{{ session.user?.name }}</p>
            <p class="truncate text-[13px] text-ink-3">{{ session.company?.name }}</p>
          </div>
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

      <!-- Gaveta (< 1024px) — headlessui Dialog: foco preso, Esc/clique fora fecha, foco volta ao botão que abriu. -->
      <Dialog :open="drawerOpen" aria-label="Menu" class="relative z-50 lg:hidden" @close="closeDrawer">
        <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div class="fixed inset-0 flex">
          <DialogPanel id="menu-lateral" class="flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-surface">
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
              <div class="relative">
                <label for="conta-gaveta" class="field-label">Conta do Mercado Livre</label>
                <div class="pointer-events-none flex items-center justify-between gap-2 rounded-card border border-line bg-surface px-3 py-2">
                  <div class="min-w-0">
                    <p class="truncate text-[14px] font-semibold text-ink">{{ session.selectedAccount?.nickname ?? 'Selecionar conta' }}</p>
                    <p class="truncate text-[12px] text-ink-3">Seller ID {{ session.selectedAccount?.seller_id }}</p>
                  </div>
                  <ChevronUpDownIcon class="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                </div>
                <select
                  id="conta-gaveta"
                  :value="session.selectedAccountId ?? ''"
                  class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Conta do Mercado Livre"
                  @change="onAccountChange"
                >
                  <option v-for="acc in session.mlAccounts" :key="acc.id" :value="acc.id">{{ acc.nickname }}</option>
                </select>
              </div>
            </div>
            <div v-else-if="session.isAdmin" class="px-3 py-3">
              <NuxtLink to="/configuracoes?aba=contas" class="btn-secondary w-full" @click="closeDrawer">Conectar conta</NuxtLink>
            </div>

            <nav class="flex flex-col gap-5 px-3" aria-label="Navegação principal">
              <div v-for="section in NAV_SECTIONS" :key="section.label">
                <p class="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{{ section.label }}</p>
                <div class="flex flex-col gap-1">
                  <NuxtLink
                    v-for="item in section.items"
                    :key="item.to"
                    :to="item.to"
                    class="flex items-center gap-2.5 rounded-card border-l-[3px] px-3 py-2 text-[14px] font-medium"
                    :class="isActive(item.to) ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink'"
                  >
                    <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    {{ item.label }}
                  </NuxtLink>
                </div>
              </div>
            </nav>

            <div class="flex-1" />

            <div class="border-t border-line px-3 py-4">
              <div class="px-3 pb-3">
                <ThemeToggle compact />
              </div>
              <div class="flex items-center gap-2.5 px-3 pb-2">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary">
                  {{ initials(session.user?.name) }}
                </div>
                <div class="min-w-0">
                  <p class="truncate text-[14px] font-medium text-ink">{{ session.user?.name }}</p>
                  <p class="truncate text-[13px] text-ink-3">{{ session.company?.name }}</p>
                </div>
              </div>
              <button
                type="button"
                class="w-full rounded-card px-3 py-2 text-left text-[14px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                @click="sair"
              >
                Sair
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

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
