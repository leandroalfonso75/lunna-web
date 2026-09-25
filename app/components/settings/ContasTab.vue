<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { dateTimeShort, int } from '../../lib/format'
import { connectErrorMessage, mlCallbackMessage, type MlCallbackMessage } from '../../lib/mlCallback'
import type { SettingsClient } from '../../lib/settingsClient'
import type { MlAccount } from '../../types/api'

const props = defineProps<{ settingsApi: SettingsClient; isAdmin: boolean }>()
const toast = useToast()
const route = useRoute()
const auth = useAuth()

const accounts = ref<MlAccount[]>([])
const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { ml_accounts } = await props.settingsApi.listMlAccounts()
    accounts.value = ml_accounts
  } catch {
    loadError.value = 'Não foi possível carregar as contas agora. Tente de novo.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// --- Retorno do OAuth (DECISOES.md §5) --------------------------------------
// O callback da API redireciona para cá com `code`+`state` (fluxo normal,
// completado por `POST /api/ml_accounts/connect` abaixo) ou `ml=cancelada`/
// `ml=link_invalido` (erro que o callback já resolve sozinho, sem chamada).
const oauthBanner = ref<MlCallbackMessage | null>(null)
const connectingAccount = ref(false)

onMounted(async () => {
  const { code, state, ml } = route.query

  if (typeof ml === 'string') {
    oauthBanner.value = mlCallbackMessage(ml)
    stripOauthQuery()
    return
  }

  if (typeof code !== 'string' || typeof state !== 'string') return

  // Tira `code`/`state` da URL ANTES de chamar a API: nunca deixa o code de
  // autorização visível na barra de endereço, e garante que isto só roda
  // uma vez mesmo que algo dispare uma nova leitura da rota depois.
  stripOauthQuery()
  connectingAccount.value = true
  try {
    const result = await props.settingsApi.connectMlAccount(code, state)
    oauthBanner.value = mlCallbackMessage(result.code) ?? { kind: 'success', text: 'Conta do Mercado Livre conectada.' }
    await auth.me()
    await load()
  } catch (err) {
    oauthBanner.value = connectErrorMessage(err)
  } finally {
    connectingAccount.value = false
  }
})

function stripOauthQuery() {
  const { code: _code, state: _state, ml: _ml, ...rest } = route.query
  navigateTo({ path: '/configuracoes', query: rest }, { replace: true })
}

// --- Conectar / reconectar (mesmo fluxo OAuth) ------------------------------
const connecting = ref(false)

async function connect() {
  connecting.value = true
  try {
    const { url } = await props.settingsApi.authorizeMlAccount()
    window.location.href = url
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível iniciar a conexão agora. Tente de novo.'))
    connecting.value = false
  }
}

// --- Sincronizar agora -------------------------------------------------------
const syncingId = ref<string | null>(null)

async function syncNow(account: MlAccount) {
  syncingId.value = account.id
  try {
    await props.settingsApi.syncNow(account.id)
    toast.success('Sincronização iniciada.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível iniciar a sincronização agora.'))
  } finally {
    syncingId.value = null
  }
}

// --- Desconectar (confirmação inline, sem window.confirm) -------------------
const confirmingRemoveId = ref<string | null>(null)
const removingId = ref<string | null>(null)

async function confirmDisconnect(account: MlAccount) {
  removingId.value = account.id
  try {
    await props.settingsApi.deleteMlAccount(account.id)
    accounts.value = accounts.value.filter((a) => a.id !== account.id)
    toast.success('Conta desconectada.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível desconectar agora. Tente de novo.'))
  } finally {
    removingId.value = null
    confirmingRemoveId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="connectingAccount" role="status" class="card p-4 text-[15px] text-ink-2">Conectando conta do Mercado Livre…</div>

    <div
      v-else-if="oauthBanner"
      role="status"
      class="card p-4 text-[15px]"
      :class="oauthBanner.kind === 'success' ? 'border-success bg-success-soft text-success' : 'border-danger bg-danger-soft text-danger'"
    >
      {{ oauthBanner.text }}
    </div>

    <div v-if="isAdmin" class="flex justify-end">
      <button type="button" data-test="conectar-conta" :disabled="connecting" class="btn-primary" @click="connect">
        {{ connecting ? 'Conectando...' : 'Conectar conta do Mercado Livre' }}
      </button>
    </div>

    <div v-if="loading" role="status" class="text-[15px] text-ink-2">Carregando...</div>

    <div v-else-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="load">Tentar de novo</button>
    </div>

    <div v-else-if="!accounts.length" class="empty-state">
      <p class="text-[15px] text-ink-2">Nenhuma conta do Mercado Livre conectada ainda.</p>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="account in accounts" :key="account.id" class="card space-y-3 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="section-title">{{ account.nickname }}</p>
            <p class="text-[15px] text-ink-2">Seller ID {{ account.seller_id }}</p>
          </div>

          <span v-if="account.status === 'active'" class="pill-success">Conectada</span>
          <span v-else class="pill-warning">Reautorização necessária</span>
        </div>

        <p v-if="account.status === 'reauth_required' && account.last_error" class="text-[15px] text-danger">
          {{ account.last_error }}
        </p>

        <div v-if="account.last_sync" class="text-[13px] text-ink-3">
          Última sincronização: {{ dateTimeShort(account.last_sync.finished_at ?? account.last_sync.started_at) }} —
          <span :class="account.last_sync.ok ? 'text-success' : 'text-danger'">{{ account.last_sync.ok ? 'ok' : 'falha' }}</span>
          · {{ int(account.last_sync.items) }} itens · {{ int(account.last_sync.orders) }} pedidos
          <span v-if="account.last_sync.detail"> — {{ account.last_sync.detail }}</span>
        </div>
        <p v-else class="text-[13px] text-ink-3">Ainda sem sincronização.</p>

        <div v-if="isAdmin" class="flex flex-wrap items-center gap-4 border-t border-line pt-3">
          <button
            type="button"
            :disabled="syncingId === account.id"
            class="btn-secondary"
            @click="syncNow(account)"
          >
            {{ syncingId === account.id ? 'Sincronizando...' : 'Sincronizar agora' }}
          </button>

          <button v-if="account.status === 'reauth_required'" type="button" class="btn-secondary" :disabled="connecting" @click="connect">
            Reconectar
          </button>

          <template v-if="confirmingRemoveId !== account.id">
            <button type="button" class="ml-auto text-[13px] font-semibold text-danger hover:underline" @click="confirmingRemoveId = account.id">
              Desconectar
            </button>
          </template>
          <template v-else>
            <span class="ml-auto text-[15px] text-ink">Desconectar {{ account.nickname }}? Isso apaga os dados desta conta no Lunna.</span>
            <button type="button" class="text-[13px] font-semibold text-ink-2 hover:text-ink" @click="confirmingRemoveId = null">
              Cancelar
            </button>
            <button type="button" :disabled="removingId === account.id" class="btn-danger-solid" @click="confirmDisconnect(account)">
              {{ removingId === account.id ? 'Desconectando...' : 'Sim, desconectar' }}
            </button>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>
