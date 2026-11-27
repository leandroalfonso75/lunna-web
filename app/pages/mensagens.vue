<script setup lang="ts">
import NvTabs from '../components/nv/NvTabs.vue'
import { useLayoutPref } from '../composables/useLayoutPref'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import ConversationCard from '../components/mensagens/ConversationCard.vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import QuestionTemplatesMenu from '../components/perguntas/QuestionTemplatesMenu.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { useToast } from '../composables/useToast'
import { apiErrorMessage } from '../lib/apiErrors'
import { int } from '../lib/format'
import { useSessionStore } from '../stores/session'
import type { Conversation, MessagesResponse } from '../types/messages'
import type { QuestionTemplate } from '../types/questions'

/**
 * `/mensagens` (pedido do usuário em 08/11/2026): só as mensagens de pós-venda com os compradores (as reclamações
 * ficam em Reclamações). As que aguardam o vendedor primeiro; resposta pelo Lunna e respostas padrão próprias.
 */
const { $api } = useNuxtApp()
const session = useSessionStore()
const header = usePageHeader()
const toast = useToast()

const filters = reactive({ view: 'aguardando' as MessagesResponse['view'], q: '', page: 1 })
const response = ref<MessagesResponse | null>(null)
const templates = ref<QuestionTemplate[]>([])
const loading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const VIEWS = [
  { value: 'aguardando', label: 'Aguardando você' },
  { value: 'todas', label: 'Todas' }
] as const

/** Layout novo (27/11/2026): situações como guias com contador e explicação ("Aguardando você" primeiro). */
const layoutPref = useLayoutPref()
const isNew = computed(() => layoutPref.pref.value === 'novo')
const M_HINT: Record<string, string> = {
  aguardando: 'Conversas pós-venda em que o comprador escreveu por último e espera a sua resposta.',
  todas: 'Todas as conversas pós-venda lidas do Mercado Livre.'
}
const newTabs = computed(() => VIEWS.map((v) => ({ key: v.value, label: v.label, count: response.value ? response.value.counts[v.value] : null, alert: v.value === 'aguardando', hint: M_HINT[v.value] })))

async function load() {
  if (!session.selectedAccountId) return
  loading.value = true
  try {
    response.value = await $api<MessagesResponse>('/api/messages', {
      query: { account_id: session.selectedAccountId, view: filters.view, q: filters.q || undefined, page: filters.page }
    })
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível carregar as mensagens.'))
  } finally {
    loading.value = false
  }
}

async function loadTemplates() {
  if (!session.selectedAccountId) return
  try {
    const res = await $api<{ templates: QuestionTemplate[] }>('/api/question_templates', { query: { account_id: session.selectedAccountId, kind: 'mensagem' } })
    templates.value = res.templates
  } catch {
    // sem respostas padrão nesta carga
  }
}

function onSent(c: Conversation) {
  if (!response.value) return
  const i = response.value.conversations.findIndex((x) => x.pack_id === c.pack_id)
  if (i >= 0) response.value.conversations[i] = c
  if (!c.awaiting && response.value.counts.aguardando > 0) response.value.counts.aguardando--
}

function onDeleted(pack: number) {
  if (!response.value) return
  const c = response.value.conversations.find((x) => x.pack_id === pack)
  response.value.conversations = response.value.conversations.filter((x) => x.pack_id !== pack)
  response.value.total--
  response.value.counts.todas--
  if (c?.awaiting && c.can_send) response.value.counts.aguardando--
}

watch(() => [filters.view, filters.page], load)
watch(() => filters.q, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { filters.page = 1; void load() }, 350)
})
watch(() => session.selectedAccountId, () => { void load(); void loadTemplates() })
onMounted(() => { void load(); void loadTemplates() })

watchEffect(() => {
  header.state.title = 'Mensagens'
  header.state.subtitle = session.selectedAccount ? `Mercado Livre · ${session.selectedAccount.nickname}` : 'Mercado Livre'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = loading.value
  header.state.onRefresh = () => { void load(); void loadTemplates() }
})
</script>

<template>
  <EmptyAccountState v-if="!session.selectedAccount" />
  <div v-else class="page space-y-5">
    <PageHeader />

    <template v-if="isNew">
      <NvTabs :tabs="newTabs" :model-value="filters.view" label="Situação" data-test="mensagens-filtro" @update:model-value="(v) => Object.assign(filters, { view: v, page: 1 })" />
      <div class="flex flex-wrap items-center gap-2">
        <QuestionTemplatesMenu kind="mensagem" :templates="templates" @changed="loadTemplates" />
        <label class="relative ml-auto w-full max-w-md">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input v-model="filters.q" type="search" class="input h-10 w-full pl-10" placeholder="Buscar na mensagem, comprador ou nº da venda" data-test="mensagens-busca">
        </label>
      </div>
    </template>
    <div v-else class="flex flex-wrap items-center gap-2" role="group" aria-label="Situação" data-test="mensagens-filtro">
      <button
        v-for="v in VIEWS" :key="v.value" type="button"
        class="rounded-full border px-3 py-1 text-[13px]"
        :class="filters.view === v.value ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'"
        :aria-pressed="filters.view === v.value"
        @click="Object.assign(filters, { view: v.value, page: 1 })"
      >{{ v.label }}<template v-if="response"> ({{ int(response.counts[v.value]) }})</template></button>

      <QuestionTemplatesMenu kind="mensagem" :templates="templates" @changed="loadTemplates" />

      <label class="relative ml-auto w-full max-w-sm">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input v-model="filters.q" type="search" class="input h-9 w-full pl-8 text-[13px]" placeholder="Buscar na mensagem, comprador ou nº da venda" data-test="mensagens-busca">
      </label>
    </div>

    <p class="text-[12px] text-ink-3">Mensagens de pós-venda das vendas dos últimos 60 dias, lidas a cada sincronização sem marcar como lidas no Mercado Livre. As reclamações ficam em Reclamações.</p>

    <div v-if="loading && !response" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-32 animate-pulse rounded-card bg-surface-2" />
    </div>

    <template v-else-if="response">
      <p v-if="!response.conversations.length" class="card p-6 text-center text-ink-3" data-test="mensagens-vazio">
        {{ filters.view === 'aguardando' && !filters.q ? 'Nenhuma conversa aguardando resposta.' : 'Nenhuma conversa encontrada.' }}
      </p>
      <div v-else class="space-y-3">
        <ConversationCard
          v-for="c in response.conversations" :key="c.pack_id" :conversation="c" :templates="templates"
          @sent="onSent" @templates-changed="loadTemplates" @deleted="onDeleted"
        />
      </div>

      <nav v-if="response.total > response.per_page" class="flex items-center justify-center gap-3 text-[13px]">
        <button type="button" class="btn-secondary h-8" :disabled="filters.page <= 1" @click="filters.page--">Anterior</button>
        <span class="text-ink-2">Página {{ filters.page }} de {{ Math.ceil(response.total / response.per_page) }}</span>
        <button type="button" class="btn-secondary h-8" :disabled="filters.page * response.per_page >= response.total" @click="filters.page++">Próxima</button>
      </nav>
    </template>
  </div>
</template>
