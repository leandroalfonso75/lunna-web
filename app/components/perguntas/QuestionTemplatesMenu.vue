<script setup lang="ts">
import { ChatBubbleBottomCenterTextIcon, EllipsisHorizontalIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { useSessionStore } from '../../stores/session'
import type { QuestionTemplate } from '../../types/questions'

/**
 * Botão "Respostas padrão" (pedido do usuário em 08/11/2026): lista as respostas padrão da empresa com "Aplicar"
 * (quando usado numa pergunta) e o menu "…" de cada uma (Editar, Excluir); no topo, "Incluir resposta padrão".
 * `draft`: texto já escrito na pergunta, oferecido como corpo ao incluir uma nova.
 */
const props = withDefaults(defineProps<{ templates: QuestionTemplate[]; canApply?: boolean; draft?: string; kind?: 'pergunta' | 'mensagem' }>(), {
  canApply: false, draft: '', kind: 'pergunta'
})
const emit = defineEmits<{ apply: [t: QuestionTemplate]; changed: [] }>()

// limite do Mercado Livre: resposta de pergunta 2000, mensagem de pós-venda 350
const MAX = props.kind === 'mensagem' ? 350 : 2000
const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()
const query = () => ({ account_id: session.selectedAccountId, kind: props.kind })

const open = ref(false)
const menuFor = ref<number | null>(null)
const editing = ref<{ id: number | null; title: string; body: string } | null>(null)
const saving = ref(false)

function apply(t: QuestionTemplate) {
  open.value = false
  menuFor.value = null
  emit('apply', t)
}

function startEdit(t: QuestionTemplate | null) {
  menuFor.value = null
  editing.value = t ? { id: t.id, title: t.title, body: t.body } : { id: null, title: '', body: (props.draft ?? '').trim() }
}

async function save() {
  if (!editing.value) return
  saving.value = true
  try {
    const { id, title, body } = editing.value
    if (id) await $api(`/api/question_templates/${id}`, { method: 'PATCH', query: query(), body: { title, body } })
    else await $api('/api/question_templates', { method: 'POST', query: query(), body: { title, body, kind: props.kind } })
    toast.success(id ? 'Resposta padrão atualizada.' : 'Resposta padrão incluída.')
    editing.value = null
    emit('changed')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível salvar a resposta padrão.'))
  } finally {
    saving.value = false
  }
}

async function remove(t: QuestionTemplate) {
  menuFor.value = null
  if (!window.confirm(`Excluir a resposta padrão "${t.title}"?`)) return
  try {
    await $api(`/api/question_templates/${t.id}`, { method: 'DELETE', query: query() })
    toast.success('Resposta padrão excluída.')
    emit('changed')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível excluir a resposta padrão.'))
  }
}
</script>

<template>
  <div class="relative">
    <button type="button" class="btn-secondary h-9" data-test="respostas-padrao" @click="open = !open; menuFor = null">
      <ChatBubbleBottomCenterTextIcon class="h-4 w-4" aria-hidden="true" /> Respostas padrão
    </button>
    <div v-if="open" class="absolute left-0 z-20 mt-1 w-[min(32rem,90vw)] space-y-1 rounded-card border border-line bg-surface p-2 text-[13px] shadow-lg" data-test="respostas-padrao-lista">
      <button v-if="session.isAdmin" type="button" class="btn-link flex items-center gap-1 px-1 py-1 text-[12px]" data-test="resposta-incluir" @click="startEdit(null)">
        <PlusIcon class="h-4 w-4" aria-hidden="true" /> Incluir resposta padrão
      </button>
      <p v-if="!templates.length" class="px-1 py-2 text-ink-3">Nenhuma resposta padrão ainda.</p>
      <div v-for="t in templates" :key="t.id" class="flex items-start gap-2 rounded px-1 py-1.5 hover:bg-surface-2">
        <div class="min-w-0 flex-1">
          <p class="font-medium text-ink">{{ t.title }}</p>
          <p class="line-clamp-2 text-[12px] text-ink-3">{{ t.body }}</p>
        </div>
        <button v-if="canApply" type="button" class="btn-primary h-7 shrink-0 px-2 text-[11px]" data-test="resposta-aplicar" @click="apply(t)">Aplicar</button>
        <div v-if="session.isAdmin" class="relative shrink-0">
          <button type="button" class="btn-link h-7 px-1" aria-label="Mais opções" data-test="resposta-menu" @click="menuFor = menuFor === t.id ? null : t.id">
            <EllipsisHorizontalIcon class="h-5 w-5" />
          </button>
          <div v-if="menuFor === t.id" class="absolute right-0 z-30 mt-1 w-32 rounded-card border border-line bg-surface py-1 shadow-lg">
            <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-2" data-test="resposta-editar" @click="startEdit(t)">
              <PencilSquareIcon class="h-4 w-4" aria-hidden="true" /> Editar
            </button>
            <button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-danger hover:bg-surface-2" data-test="resposta-excluir" @click="remove(t)">
              <TrashIcon class="h-4 w-4" aria-hidden="true" /> Excluir
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="editing" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" @click.self="editing = null">
      <div class="card my-10 w-full max-w-xl space-y-3 p-5 text-[13px]">
        <p class="text-[16px] font-semibold text-ink">{{ editing.id ? 'Editar resposta padrão' : 'Incluir resposta padrão' }}</p>
        <label class="block">
          <span class="mb-1 block font-semibold text-ink">Nome</span>
          <input v-model="editing.title" type="text" class="input w-full" maxlength="80" placeholder="ex.: Produto original" data-test="resposta-titulo">
        </label>
        <label class="block">
          <span class="mb-1 block font-semibold text-ink">Resposta</span>
          <textarea v-model="editing.body" rows="5" class="input w-full py-2" :maxlength="MAX" data-test="resposta-corpo" />
          <span class="text-[11px] text-ink-3" data-numeric>{{ editing.body.length }}/{{ MAX }}</span>
        </label>
        <div class="flex gap-2">
          <button type="button" class="btn-primary h-9" :disabled="saving || !editing.title.trim() || !editing.body.trim()" data-test="resposta-salvar" @click="save">Salvar</button>
          <button type="button" class="btn-secondary h-9" @click="editing = null">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>
