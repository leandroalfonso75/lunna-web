<script setup lang="ts">
import { computed, ref } from 'vue'
import QuestionTemplatesMenu from '../perguntas/QuestionTemplatesMenu.vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl, dateTimeShort } from '../../lib/format'
import { useSessionStore } from '../../stores/session'
import type { Conversation } from '../../types/messages'
import type { QuestionTemplate } from '../../types/questions'

/**
 * Uma conversa de pós-venda (pedido do usuário em 08/11/2026): as mensagens com o comprador, o campo de resposta (até
 * 350 caracteres, regra do Mercado Livre), "Respostas padrão" (mesmo sistema das Perguntas) e "Enviar mensagem"
 * (com confirmação). Conversa bloqueada pelo ML (pedido cancelado, reclamação, prazo) mostra o motivo e não envia.
 */
const props = defineProps<{ conversation: Conversation; templates: QuestionTemplate[] }>()
const emit = defineEmits<{ sent: [c: Conversation]; templatesChanged: [] }>()

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()

const text = ref('')
const confirming = ref(false)
const sending = ref(false)
const expanded = ref(false)
const max = computed(() => props.conversation.max_length || 350)
const tooLong = computed(() => text.value.length > max.value)
const shown = computed(() => (expanded.value ? props.conversation.messages : props.conversation.messages.slice(-4)))

async function send() {
  sending.value = true
  try {
    const res = await $api<{ message: string; conversation: Conversation }>(`/api/messages/${props.conversation.pack_id}/send`, {
      method: 'POST', query: { account_id: session.selectedAccountId }, body: { text: text.value.trim(), confirm: true }
    })
    toast.success(res.message)
    text.value = ''
    emit('sent', res.conversation)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'O Mercado Livre não aceitou a mensagem.'))
  } finally {
    sending.value = false
    confirming.value = false
  }
}
</script>

<template>
  <article class="card space-y-3 p-4 text-[13px]" data-test="conversa">
    <header class="flex flex-wrap items-start gap-3">
      <div class="min-w-0 flex-1">
        <p class="font-medium text-ink">
          {{ conversation.buyer?.name || conversation.buyer?.nickname || `Comprador ${conversation.buyer_id ?? ''}` }}
          <span v-if="conversation.buyer?.nickname && conversation.buyer?.name" class="font-normal text-ink-3">· {{ conversation.buyer.nickname }}</span>
        </p>
        <p class="text-ink-3">
          Venda #{{ conversation.order?.order_id ?? conversation.pack_id }}
          <template v-if="conversation.order"> · {{ dateTimeShort(conversation.order.date) }} · {{ brl(conversation.order.total) }}</template>
        </p>
        <p v-if="conversation.order?.items.length" class="truncate text-ink-2" :title="conversation.order.items.map((i) => i.title).join(' · ')">
          {{ conversation.order.items.map((i) => `${i.quantity}× ${i.title}`).join(' · ') }}
        </p>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1">
        <span v-if="conversation.awaiting" class="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">Aguardando você</span>
        <span v-else class="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">Respondida</span>
        <span v-if="!conversation.can_send" class="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">Bloqueada: {{ conversation.block_reason }}</span>
        <span v-if="conversation.claim_ids.length" class="text-[11px] text-ink-3">tem reclamação (veja em Reclamações)</span>
      </div>
    </header>

    <div class="space-y-2 rounded-card bg-surface-2 p-3" data-test="conversa-mensagens">
      <button v-if="conversation.messages.length > 4 && !expanded" type="button" class="btn-link text-[12px]" @click="expanded = true">
        Ver as {{ conversation.messages.length - 4 }} mensagens anteriores
      </button>
      <div v-for="m in shown" :key="m.id" class="flex" :class="m.mine ? 'justify-end' : 'justify-start'">
        <div class="max-w-[80%] rounded-card px-3 py-2" :class="m.mine ? 'bg-primary text-white' : m.from === 'mercado_livre' ? 'border border-line bg-warning-soft text-ink' : 'bg-surface text-ink'">
          <p class="whitespace-pre-line break-words">{{ m.text }}</p>
          <p v-if="m.attachments?.length" class="mt-1 text-[11px] opacity-80">📎 {{ m.attachments.map((a) => a.original_filename || a.filename).join(', ') }}</p>
          <p class="mt-1 text-[10px] opacity-70">{{ m.mine ? 'Você' : m.from === 'mercado_livre' ? 'Mercado Livre' : 'Comprador' }} · {{ dateTimeShort(m.date) }}</p>
        </div>
      </div>
    </div>

    <template v-if="conversation.can_send">
      <div>
        <textarea v-model="text" rows="2" class="input w-full py-2" :maxlength="max + 50" placeholder="Escreva a mensagem ou aplique uma resposta padrão" data-test="conversa-resposta" />
        <p class="mt-1 text-[11px]" :class="tooLong ? 'text-danger' : 'text-ink-3'" data-numeric>{{ text.length }}/{{ max }} (limite do Mercado Livre)</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <QuestionTemplatesMenu kind="mensagem" :templates="templates" can-apply :draft="text" @apply="(t) => (text = t.body)" @changed="emit('templatesChanged')" />
        <template v-if="!confirming">
          <button type="button" class="btn-primary h-9" :disabled="!text.trim() || tooLong || !session.isAdmin" data-test="conversa-enviar" @click="confirming = true">Enviar mensagem</button>
          <span v-if="!session.isAdmin" class="text-[12px] text-ink-3">Só administradores enviam mensagens no Mercado Livre.</span>
        </template>
        <template v-else>
          <span class="text-ink">A mensagem vai para o comprador agora. Confirmar?</span>
          <button type="button" class="btn-primary h-9" :disabled="sending" data-test="conversa-confirmar" @click="send">{{ sending ? 'Enviando…' : 'Sim, enviar' }}</button>
          <button type="button" class="btn-secondary h-9" :disabled="sending" @click="confirming = false">Cancelar</button>
        </template>
      </div>
    </template>
  </article>
</template>
