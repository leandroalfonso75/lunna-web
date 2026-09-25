<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ContasTab from '../../components/settings/ContasTab.vue'
import EmpresaTab from '../../components/settings/EmpresaTab.vue'
import UsuariosTab from '../../components/settings/UsuariosTab.vue'
import { mlCallbackMessage } from '../../lib/mlCallback'
import { resolveSettingsTab, settingsTabPath, visibleSettingsTabs, type SettingsTab } from '../../lib/settingsTabs'
import { useSessionStore } from '../../stores/session'

const route = useRoute()
const session = useSessionStore()
const auth = useAuth()
const settingsApi = useSettings()

const tabs = computed(() => visibleSettingsTabs(session.user?.role))
const currentTab = computed<SettingsTab | null>(() => resolveSettingsTab(route.query.aba, session.user?.role))

function selectTab(tab: SettingsTab) {
  navigateTo(settingsTabPath(tab))
}

/**
 * Banner do retorno do OAuth do Mercado Livre (`?ml=...`, DECISOES.md §5).
 * Capturado uma vez, na montagem — a URL é limpa logo em seguida, então o
 * banner precisa guardar o texto antes disso.
 */
const oauthBanner = ref(mlCallbackMessage(route.query.ml))

onMounted(async () => {
  if (!route.query.ml) return

  // A conta só entra em `session.mlAccounts` depois de recarregar /api/me.
  await auth.me().catch(() => {
    // 401 aqui já é tratado pelo interceptor global (plugins/api.ts).
  })

  const { ml: _ml, ...rest } = route.query
  await navigateTo({ path: '/configuracoes', query: rest }, { replace: true })
})
</script>

<template>
  <div class="page space-y-6">
    <header>
      <h1 class="page-title">Configurações</h1>
    </header>

    <div
      v-if="oauthBanner"
      role="status"
      class="card p-4 text-[15px]"
      :class="oauthBanner.kind === 'success' ? 'border-success bg-success-soft text-success' : 'border-danger bg-danger-soft text-danger'"
    >
      {{ oauthBanner.text }}
    </div>

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
