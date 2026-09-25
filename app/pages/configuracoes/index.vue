<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import ContasTab from '../../components/settings/ContasTab.vue'
import EmpresaTab from '../../components/settings/EmpresaTab.vue'
import UsuariosTab from '../../components/settings/UsuariosTab.vue'
import { usePageHeader } from '../../composables/usePageHeader'
import { resolveSettingsTab, settingsTabPath, visibleSettingsTabs, type SettingsTab } from '../../lib/settingsTabs'
import { useSessionStore } from '../../stores/session'

const route = useRoute()
const session = useSessionStore()
const settingsApi = useSettings()

const tabs = computed(() => visibleSettingsTabs(session.user?.role))
const currentTab = computed<SettingsTab | null>(() => resolveSettingsTab(route.query.aba, session.user?.role))

function selectTab(tab: SettingsTab) {
  navigateTo(settingsTabPath(tab))
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
  <div class="page space-y-6">
    <header>
      <h1 class="page-title">Configurações</h1>
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
        {{ tab.label }}
      </button>
    </nav>

    <EmpresaTab v-if="currentTab === 'empresa'" :settings-api="settingsApi" />
    <UsuariosTab v-else-if="currentTab === 'usuarios'" :settings-api="settingsApi" />
    <ContasTab v-else-if="currentTab === 'contas'" :settings-api="settingsApi" :is-admin="session.isAdmin" />
  </div>
</template>
