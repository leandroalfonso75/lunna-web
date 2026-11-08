<script setup lang="ts">
import { SparklesIcon } from '@heroicons/vue/24/outline'
import { computed, ref } from 'vue'
import QuestionTemplatesMenu from './QuestionTemplatesMenu.vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl, dateTimeShort } from '../../lib/format'
import { useSessionStore } from '../../stores/session'
import type { Question, QuestionTemplate } from '../../types/questions'

/**
 * Uma pergunta do Mercado Livre (pedido do usuário em 08/11/2026): campo de resposta, "Respostas padrão" (com
 * "Aplicar", que preenche o campo) e "Enviar resposta" (vai ao ML, que entrega ao comprador; com confirmação).
 */
const props = defineProps<{ question: Question; templates: QuestionTemplate[] }>()
const emit = defineEmits<{ answered: [q: Question]; templatesChanged: []; deleted: [id: number] }>()

const MAX = 2000
const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()

const text = ref('')
const confirming = ref(false)
const sending = ref(false)
const tooLong = computed(() => text.value.length > MAX)
const confirmingDelete = ref(false)
const suggesting = ref(false)
const suggestion = ref<{ answer: string; sources: string[]; confidence: string | null; used: { same_item: number; same_sku: number; sku_items: number; skus: string[] } } | null>(null)

/** Resposta sugerida pela IA (dados do anúncio + respostas do mesmo anúncio e do mesmo SKU); preenche o campo para revisar. */
async function suggest() {
  suggesting.value = true
  try {
    const res = await $api<NonNullable<typeof suggestion.value>>(`/api/questions/${props.question.id}/suggest`, {
      method: 'POST', query: { account_id: session.selectedAccountId }
    })
    suggestion.value = res
    text.value = res.answer
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível sugerir uma resposta agora.'))
  } finally {
    suggesting.value = false
  }
}
const deleting = ref(false)

/** Apaga a pergunta no Mercado Livre (some do anúncio para todos; não dá para desfazer). */
async function remove() {
  deleting.value = true
  try {
    const res = await $api<{ message: string }>(`/api/questions/${props.question.id}`, {
      method: 'DELETE', query: { account_id: session.selectedAccountId, confirm: true }
    })
    toast.success(res.message)
    emit('deleted', props.question.id)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível apagar a pergunta.'))
  } finally {
    deleting.value = false
    confirmingDelete.value = false
  }
}

async function send() {
  sending.value = true
  try {
    const res = await $api<{ message: string; question: Question }>(`/api/questions/${props.question.id}/answer`, {
      method: 'POST', query: { account_id: session.selectedAccountId }, body: { text: text.value.trim(), confirm: true }
    })
    toast.success(res.message)
    text.value = ''
    emit('answered', res.question)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'O Mercado Livre não aceitou a resposta.'))
  } finally {
    sending.value = false
    confirming.value = false
  }
}
</script>

<template>
  <article class="card space-y-3 p-4 text-[13px]" data-test="pergunta">
    <header class="flex items-start gap-3">
      <img v-if="question.item?.thumbnail" :src="question.item.thumbnail" alt="" class="h-12 w-12 shrink-0 rounded object-contain">
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-ink" :title="question.item?.title ?? ''">{{ question.item?.title ?? question.item_id }}</p>
        <p class="text-ink-3">
          {{ question.item_id }}<template v-if="question.item?.price"> · {{ brl(question.item.price) }}</template>
          <template v-if="question.item?.stock !== null && question.item?.stock !== undefined"> · estoque {{ question.item.stock }}</template>
          <a v-if="question.item?.permalink" :href="question.item.permalink" target="_blank" rel="noopener" class="btn-link ml-1">ver anúncio</a>
        </p>
      </div>
      <span
        class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        :class="{ 'bg-warning-soft text-warning': question.status_tone === 'warn', 'bg-success-soft text-success': question.status_tone === 'success',
                  'bg-danger-soft text-danger': question.status_tone === 'danger', 'bg-surface-2 text-ink-2': question.status_tone === 'neutral' }"
      >{{ question.status_label }}</span>
    </header>

    <div class="rounded-card bg-surface-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <p class="text-[11px] text-ink-3">Pergunta · {{ dateTimeShort(question.date_created) }}</p>
        <template v-if="session.isAdmin">
          <button v-if="!confirmingDelete" type="button" class="btn-link text-[12px] text-danger" data-test="pergunta-excluir" @click="confirmingDelete = true">Excluir pergunta</button>
          <span v-else class="flex flex-wrap items-center justify-end gap-2 text-[12px]">
            <span class="text-ink">Apaga no Mercado Livre para todos e não dá para desfazer. Confirmar?</span>
            <button type="button" class="btn-danger h-7 px-2 text-[11px]" :disabled="deleting" data-test="pergunta-excluir-confirmar" @click="remove">{{ deleting ? 'Apagando…' : 'Sim, apagar' }}</button>
            <button type="button" class="btn-secondary h-7 px-2 text-[11px]" :disabled="deleting" @click="confirmingDelete = false">Cancelar</button>
          </span>
        </template>
      </div>
      <p class="whitespace-pre-line text-ink" data-test="pergunta-texto">{{ question.text }}</p>
    </div>

    <div v-if="question.answer" class="rounded-card border border-line p-3">
      <p class="text-[11px] text-ink-3">Sua resposta<template v-if="question.answer.date"> · {{ dateTimeShort(question.answer.date) }}</template></p>
      <p class="whitespace-pre-line text-ink">{{ question.answer.text }}</p>
    </div>

    <template v-if="question.answerable">
      <div>
        <textarea
          v-model="text" rows="3" class="input w-full py-2" :maxlength="MAX + 100"
          placeholder="Escreva a resposta ou aplique uma resposta padrão" data-test="pergunta-resposta"
        />
        <p class="mt-1 text-[11px]" :class="tooLong ? 'text-danger' : 'text-ink-3'" data-numeric>{{ text.length }}/{{ MAX }}</p>
        <p v-if="suggestion" class="mt-1 text-[11px] text-ink-3" data-test="pergunta-sugestao-base">
          Sugestão da IA (confiança {{ suggestion.confidence ?? '—' }}) com base em: dados do anúncio
          · {{ suggestion.used.same_item }} resposta(s) deste anúncio
          · {{ suggestion.used.same_sku }} de outros anúncios do mesmo SKU<template v-if="suggestion.used.skus.length"> ({{ suggestion.used.skus.join(', ') }})</template>.
          <template v-if="suggestion.sources.length"> Fontes: {{ suggestion.sources.join('; ') }}.</template>
          Revise antes de enviar.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn-secondary h-9" :disabled="suggesting" data-test="pergunta-sugerir" @click="suggest">
          <SparklesIcon class="h-4 w-4" aria-hidden="true" /> {{ suggesting ? 'Sugerindo…' : 'Sugerir resposta' }}
        </button>
        <QuestionTemplatesMenu :templates="templates" can-apply :draft="text" @apply="(t) => (text = t.body)" @changed="emit('templatesChanged')" />

        <template v-if="!confirming">
          <button type="button" class="btn-primary h-9" :disabled="!text.trim() || tooLong || !session.isAdmin" data-test="pergunta-enviar" @click="confirming = true">Enviar resposta</button>
          <span v-if="!session.isAdmin" class="text-[12px] text-ink-3">Só administradores respondem no Mercado Livre.</span>
        </template>
        <template v-else>
          <span class="text-ink">A resposta vai para o comprador agora. Confirmar?</span>
          <button type="button" class="btn-primary h-9" :disabled="sending" data-test="pergunta-confirmar" @click="send">{{ sending ? 'Enviando…' : 'Sim, enviar' }}</button>
          <button type="button" class="btn-secondary h-9" :disabled="sending" @click="confirming = false">Cancelar</button>
        </template>
      </div>
    </template>
  </article>
</template>
