<script setup lang="ts">
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { onMounted, reactive, ref, watch, watchEffect } from 'vue'
import EmptyAccountState from '../components/painel/EmptyAccountState.vue'
import PageHeader from '../components/painel/PageHeader.vue'
import QuestionCard from '../components/perguntas/QuestionCard.vue'
import QuestionTemplatesMenu from '../components/perguntas/QuestionTemplatesMenu.vue'
import { usePageHeader } from '../composables/usePageHeader'
import { useToast } from '../composables/useToast'
import { apiErrorMessage } from '../lib/apiErrors'
import { dateTimeShort, int } from '../lib/format'
import { useSessionStore } from '../stores/session'
import type { Question, QuestionsResponse, QuestionTemplate } from '../types/questions'

/**
 * `/perguntas` (pedido do usuário em 08/11/2026): perguntas dos compradores nos anúncios do Mercado Livre, as sem
 * resposta primeiro. Cada uma tem o campo de resposta (enviada ao ML, que entrega ao comprador) e as respostas padrão
 * da empresa (aplicar, incluir, editar, excluir). A lista é importada a cada sincronização.
 */
const { $api } = useNuxtApp()
const session = useSessionStore()
const header = usePageHeader()
const toast = useToast()

const filters = reactive({ view: 'sem_resposta' as QuestionsResponse['view'], q: '', page: 1 })
const response = ref<QuestionsResponse | null>(null)
const templates = ref<QuestionTemplate[]>([])
const loading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const VIEWS = [
  { value: 'sem_resposta', label: 'Sem resposta' },
  { value: 'respondidas', label: 'Respondidas' },
  { value: 'todas', label: 'Todas' }
] as const

async function load() {
  if (!session.selectedAccountId) return
  loading.value = true
  try {
    response.value = await $api<QuestionsResponse>('/api/questions', {
      query: { account_id: session.selectedAccountId, view: filters.view, q: filters.q || undefined, page: filters.page }
    })
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível carregar as perguntas.'))
  } finally {
    loading.value = false
  }
}

async function loadTemplates() {
  if (!session.selectedAccountId) return
  try {
    const res = await $api<{ templates: QuestionTemplate[] }>('/api/question_templates', { query: { account_id: session.selectedAccountId } })
    templates.value = res.templates
  } catch {
    // sem respostas padrão nesta carga; o botão mostra a lista vazia
  }
}

function onAnswered(q: Question) {
  if (!response.value) return
  const i = response.value.questions.findIndex((x) => x.id === q.id)
  if (i >= 0) response.value.questions[i] = q
  if (response.value.counts.sem_resposta > 0) { response.value.counts.sem_resposta--; response.value.counts.respondidas++ }
}

function onDeleted(id: number) {
  if (!response.value) return
  const q = response.value.questions.find((x) => x.id === id)
  response.value.questions = response.value.questions.filter((x) => x.id !== id)
  response.value.total--
  response.value.counts.todas--
  if (q?.status === 'UNANSWERED') response.value.counts.sem_resposta--
  else if (q?.status === 'ANSWERED') response.value.counts.respondidas--
}

function setView(v: QuestionsResponse['view']) {
  Object.assign(filters, { view: v, page: 1 })
}

watch(() => [filters.view, filters.page], load)
watch(() => filters.q, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { filters.page = 1; void load() }, 350)
})
watch(() => session.selectedAccountId, () => { void load(); void loadTemplates() })
onMounted(() => { void load(); void loadTemplates() })

watchEffect(() => {
  header.state.title = 'Perguntas'
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

    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Situação" data-test="perguntas-filtro">
      <button
        v-for="v in VIEWS" :key="v.value" type="button"
        class="rounded-full border px-3 py-1 text-[13px]"
        :class="filters.view === v.value ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'"
        :aria-pressed="filters.view === v.value"
        @click="setView(v.value)"
      >{{ v.label }}<template v-if="response"> ({{ int(response.counts[v.value]) }})</template></button>

      <QuestionTemplatesMenu :templates="templates" @changed="loadTemplates" />

      <label class="relative ml-auto w-full max-w-sm">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input v-model="filters.q" type="search" class="input h-9 w-full pl-8 text-[13px]" placeholder="Buscar na pergunta, resposta, anúncio ou MLB" data-test="perguntas-busca">
      </label>
    </div>

    <p v-if="response?.synced_at" class="text-[12px] text-ink-3">Perguntas lidas do Mercado Livre a cada sincronização · lista completa relida em {{ dateTimeShort(response.synced_at) }}</p>

    <div v-if="loading && !response" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-32 animate-pulse rounded-card bg-surface-2" />
    </div>

    <template v-else-if="response">
      <p v-if="!response.questions.length" class="card p-6 text-center text-ink-3" data-test="perguntas-vazio">
        {{ filters.view === 'sem_resposta' && !filters.q ? 'Nenhuma pergunta aguardando resposta.' : 'Nenhuma pergunta encontrada.' }}
      </p>
      <div v-else class="space-y-3">
        <QuestionCard
          v-for="q in response.questions" :key="q.id" :question="q" :templates="templates"
          @answered="onAnswered" @templates-changed="loadTemplates" @deleted="onDeleted"
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
