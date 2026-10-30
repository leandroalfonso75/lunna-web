<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import ContasTab from '../../components/settings/ContasTab.vue'
import EmpresaTab from '../../components/settings/EmpresaTab.vue'
import PromocoesTab from '../../components/settings/PromocoesTab.vue'
import UsuariosTab from '../../components/settings/UsuariosTab.vue'
import { usePageHeader } from '../../composables/usePageHeader'
import { resolveSettingsTab, settingsTabPath, visibleSettingsTabs, type SettingsTab, type SettingsTabDef } from '../../lib/settingsTabs'
import { useSessionStore } from '../../stores/session'

const route = useRoute()
const session = useSessionStore()
const settingsApi = useSettings()

const tabs = computed(() => visibleSettingsTabs(session.user?.role))
const currentTab = computed<SettingsTab | null>(() => resolveSettingsTab(route.query.aba, session.user?.role))

function selectTab(tab: SettingsTab) {
  navigateTo(settingsTabPath(tab))
}

// Contagem nas abas ("Usuários (N)", "Contas (N)") — preenchida pelo evento
// `loaded` de cada aba na primeira vez que ela carrega (evita duplicar a
// busca que a própria aba já faz).
const usersCount = ref<number | null>(null)
const accountsCount = ref<number | null>(null)

function withCount(tab: SettingsTabDef, base: string): string {
  if (tab.value === 'usuarios' && usersCount.value !== null) return `${base} (${usersCount.value})`
  if (tab.value === 'contas' && accountsCount.value !== null) return `${base} (${accountsCount.value})`
  return base
}

function tabLabel(tab: SettingsTabDef): string {
  return withCount(tab, tab.label)
}

/** Abaixo de `sm` a barra de abas rola horizontalmente; "Contas do Mercado
 * Livre" ainda assim é o rótulo mais longo — usar o curto evita depender só
 * do scroll para ler a aba mais importante para quem não é admin. */
function tabShortLabel(tab: SettingsTabDef): string {
  return withCount(tab, tab.shortLabel ?? tab.label)
}

// O banner do retorno do OAuth do Mercado Livre (`?code`/`?state`/`?ml=...`,
// DECISOES.md §5) é tratado inteiro dentro de `ContasTab.vue` — o redirect
// do callback sempre chega com `aba=contas`, então é lá que a conexão
// acontece (POST /api/ml_accounts/connect) e o banner aparece.

// A barra compacta do layout (< 1024px) lê usePageHeader() — sem isto ela
// ficaria mostrando o título/selo de sync da última página do painel
// visitada (o estado é module-scope, ver composables/usePageHeader.ts).
const header = usePageHeader()
watchEffect(() => {
  header.state.title = 'Configurações'
  header.state.subtitle = ''
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = false
  header.state.onRefresh = null
})
</script>

<template>
  <div class="page max-w-4xl space-y-6">
    <header>
      <h1 class="page-title">Configurações</h1>
      <p class="page-subtitle">Gerencie sua empresa, equipe e contas do Mercado Livre.</p>
    </header>

    <nav class="tab-bar" aria-label="Abas de configurações">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        :data-test="`aba-${tab.value}`"
        :aria-current="currentTab === tab.value ? 'page' : undefined"
        :class="currentTab === tab.value ? 'tab-active' : 'tab'"
        @click="selectTab(tab.value)"
      >
        <span class="sm:hidden">{{ tabShortLabel(tab) }}</span>
        <span class="hidden sm:inline">{{ tabLabel(tab) }}</span>
      </button>
    </nav>

    <EmpresaTab v-if="currentTab === 'empresa'" :settings-api="settingsApi" />
    <PromocoesTab v-else-if="currentTab === 'promocoes'" :settings-api="settingsApi" />
    <UsuariosTab v-else-if="currentTab === 'usuarios'" :settings-api="settingsApi" @loaded="usersCount = $event" />
    <ContasTab v-else-if="currentTab === 'contas'" :settings-api="settingsApi" :is-admin="session.isAdmin" @loaded="accountsCount = $event" />
  </div>
</template>
