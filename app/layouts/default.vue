<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { Bars3Icon, ChevronDownIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { useToast } from '../composables/useToast'
import { useSessionStore } from '../stores/session'

/**
 * Barra superior (não lateral — a navegação do Lunna é curta: Painel e
 * Configurações). Em <= 767px a navegação/seletor de conta/tema/usuário
 * viram uma gaveta atrás de um hambúrguer; a barra em si nunca rola na
 * horizontal (`.page`/`max-w-content` seguram a largura).
 */
const session = useSessionStore()
const auth = useAuth()
const route = useRoute()
const toast = useToast()

const NAV_ITEMS = [
  { to: '/', label: 'Painel' },
  { to: '/configuracoes', label: 'Configurações' }
]

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

const sair = () => auth.logout()

function onAccountChange(event: Event) {
  session.selectAccount((event.target as HTMLSelectElement).value)
}

// --- Gaveta do celular -------------------------------------------------------
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
  <div class="min-h-screen bg-bg text-ink">
    <a
      href="#conteudo"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-card focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-ink"
    >
      Pular para o conteúdo
    </a>

    <header class="sticky top-0 z-40 border-b border-line bg-surface">
      <div class="mx-auto flex h-14 w-full max-w-content items-center justify-between gap-4 px-4 md:px-8">
        <div class="flex items-center gap-6 min-w-0">
          <NuxtLink to="/" class="shrink-0 text-[18px] font-semibold text-ink">Lunna</NuxtLink>

          <nav class="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
            <NuxtLink
              v-for="item in NAV_ITEMS"
              :key="item.to"
              :to="item.to"
              class="rounded-card px-3 py-1.5 text-[14px] font-medium transition-colors"
              :class="isActive(item.to) ? 'bg-primary-soft text-primary' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <div class="hidden items-center gap-3 md:flex">
          <select
            v-if="session.mlAccounts.length >= 1"
            :value="session.selectedAccountId ?? ''"
            data-test="seletor-conta"
            class="input h-9 w-auto"
            aria-label="Conta do Mercado Livre"
            @change="onAccountChange"
          >
            <option v-for="acc in session.mlAccounts" :key="acc.id" :value="acc.id">{{ acc.nickname }}</option>
          </select>

          <ThemeToggle compact />

          <Menu as="div" class="relative">
            <MenuButton class="btn-ghost gap-1.5" data-test="menu-usuario">
              <span class="max-w-[140px] truncate text-[14px] font-medium text-ink">{{ session.user?.name }}</span>
              <ChevronDownIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
            </MenuButton>
            <transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
            >
              <MenuItems class="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-card border border-line bg-surface p-1 shadow-card focus:outline-none">
                <div class="px-3 py-2">
                  <p class="truncate text-[14px] font-medium text-ink">{{ session.user?.name }}</p>
                  <p class="truncate text-[13px] text-ink-3">{{ session.company?.name }}</p>
                </div>
                <div class="my-1 border-t border-line" />
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="w-full rounded-card px-3 py-2 text-left text-[14px] font-medium text-ink-2"
                    :class="active ? 'bg-surface-2 text-ink' : ''"
                    @click="sair"
                  >
                    Sair
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>

        <button
          type="button"
          data-test="abrir-menu"
          class="btn-secondary w-9 px-0 md:hidden"
          aria-label="Abrir menu"
          aria-controls="menu-lateral"
          :aria-expanded="drawerOpen ? 'true' : 'false'"
          @click="drawerOpen = true"
        >
          <Bars3Icon class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>

    <!-- Gaveta (< md) -->
    <div
      v-if="drawerOpen"
      class="fixed inset-0 z-50 flex justify-end bg-black/30 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      @click.self="closeDrawer"
    >
      <div id="menu-lateral" class="flex h-full w-72 max-w-[85vw] flex-col border-l border-line bg-surface">
        <div class="flex items-center justify-between px-5 py-4">
          <span class="text-[18px] font-semibold text-ink">Lunna</span>
          <button type="button" data-test="fechar-menu" class="btn-ghost" aria-label="Fechar menu" @click="closeDrawer">
            <XMarkIcon class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav class="flex flex-col gap-1 px-3" aria-label="Navegação principal">
          <NuxtLink
            v-for="item in NAV_ITEMS"
            :key="item.to"
            :to="item.to"
            class="rounded-card px-3 py-2 text-[14px] font-medium"
            :class="isActive(item.to) ? 'bg-primary-soft text-primary' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div v-if="session.mlAccounts.length >= 1" class="px-3 py-3">
          <label class="field-label" for="conta-gaveta">Conta do Mercado Livre</label>
          <select id="conta-gaveta" :value="session.selectedAccountId ?? ''" class="input" @change="onAccountChange">
            <option v-for="acc in session.mlAccounts" :key="acc.id" :value="acc.id">{{ acc.nickname }}</option>
          </select>
        </div>

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

    <div class="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 md:inset-x-auto md:right-4">
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
