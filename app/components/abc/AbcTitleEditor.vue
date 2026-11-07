<script setup lang="ts">
import { PencilSquareIcon, SparklesIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { useSessionStore } from '../../stores/session'

/**
 * Curva ABC > "Alterar título AGORA" (pedido do usuário em 07/11/2026): mostra o título atual, campo do novo título
 * (até o limite do ML, 60), "Sugerir títulos" (5 pela IA, com SEO) e "Publicar título" (muda no Mercado Livre na hora,
 * com confirmação). No modelo User Products o texto vira o nome da família e o ML monta o título com as variações.
 */
const props = defineProps<{ itemId: string }>()
const emit = defineEmits<{ close: []; changed: [] }>()

interface Info { title: string; family_name: string | null; mode: 'family_name' | 'title'; editable: boolean; reason?: string; max_length: number; sold: number }
interface Suggestion { title: string; why: string; length: number; trimmed: boolean }

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()
const query = () => ({ account_id: session.selectedAccountId })

const loading = ref(true)
const info = ref<Info | null>(null)
const text = ref('')
const suggesting = ref(false)
const suggestions = ref<Suggestion[]>([])
const confirming = ref(false)
const publishing = ref(false)

const max = computed(() => info.value?.max_length ?? 60)
const tooLong = computed(() => text.value.trim().length > max.value)
const canPublish = computed(() => !!info.value?.editable && session.isAdmin && !!text.value.trim() && !tooLong.value && text.value.trim() !== (info.value?.mode === 'family_name' ? info.value?.family_name : info.value?.title))

onMounted(async () => {
  try {
    info.value = await $api<Info>(`/api/items/${props.itemId}/title`, { query: query() })
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível ler o anúncio no Mercado Livre.'))
  } finally {
    loading.value = false
  }
})

async function suggest() {
  suggesting.value = true
  try {
    const res = await $api<{ titles: Suggestion[] }>(`/api/items/${props.itemId}/title/suggest`, { method: 'POST', query: query() })
    suggestions.value = res.titles
    if (!res.titles.length) toast.error('A IA não devolveu sugestões. Tente de novo.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível sugerir títulos agora.'))
  } finally {
    suggesting.value = false
  }
}

async function publish() {
  publishing.value = true
  try {
    const res = await $api<{ message: string }>(`/api/items/${props.itemId}/title`, { method: 'POST', query: query(), body: { text: text.value.trim(), confirm: true } })
    toast.success(res.message)
    emit('changed')
    emit('close')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'O Mercado Livre não aceitou o novo título.'))
  } finally {
    publishing.value = false
    confirming.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" data-test="alterar-titulo" @click.self="emit('close')">
    <div class="card my-6 w-full max-w-3xl space-y-4 p-5 text-[13px]">
      <header class="flex items-start gap-3">
        <PencilSquareIcon class="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-[17px] font-semibold text-ink">Alterar título</p>
          <p class="text-ink-3">{{ itemId }}</p>
        </div>
        <button type="button" class="btn-link" aria-label="Fechar" @click="emit('close')"><XMarkIcon class="h-5 w-5" /></button>
      </header>

      <p v-if="loading" class="text-ink-3">Lendo o anúncio no Mercado Livre…</p>

      <template v-else-if="info">
        <div class="rounded-card bg-surface-2 p-3">
          <p class="text-[11px] font-medium uppercase tracking-wide text-ink-3">Título atual</p>
          <p class="font-medium text-ink" data-test="titulo-atual">{{ info.title }}</p>
          <p v-if="info.mode === 'family_name' && info.family_name" class="mt-1 text-[12px] text-ink-3">Nome da família no ML: {{ info.family_name }}</p>
        </div>

        <p v-if="!info.editable" class="rounded-card border border-warning bg-warning-soft p-3 text-ink" data-test="titulo-bloqueado">{{ info.reason }}</p>

        <template v-else>
          <div>
            <div class="flex flex-wrap items-end gap-2">
              <label class="min-w-0 flex-1">
                <span class="mb-1 block font-semibold text-ink">Novo título</span>
                <input v-model="text" type="text" class="input w-full" :maxlength="max + 20" placeholder="Escreva ou aplique uma sugestão" data-test="titulo-novo">
              </label>
              <button type="button" class="btn-secondary h-9" :disabled="suggesting" data-test="titulo-sugerir" @click="suggest">
                <SparklesIcon class="h-4 w-4" aria-hidden="true" /> {{ suggesting ? 'Sugerindo…' : 'Sugerir títulos' }}
              </button>
            </div>
            <p class="mt-1 text-[12px]" :class="tooLong ? 'text-danger' : 'text-ink-3'" data-numeric>{{ text.trim().length }}/{{ max }} caracteres</p>
            <p v-if="info.mode === 'family_name'" class="mt-1 text-[12px] text-ink-3">
              Este anúncio está no modelo novo do Mercado Livre: o texto vira o nome da família e o ML pode acrescentar a variação (ex.: cor, voltagem) no título exibido.
            </p>
          </div>

          <ul v-if="suggestions.length" class="space-y-2" data-test="titulo-sugestoes">
            <li v-for="(s, i) in suggestions" :key="i" class="flex items-start gap-3 rounded-card border border-line p-3">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-ink">{{ s.title }}</p>
                <p class="text-[12px] text-ink-3">{{ s.length }} caracteres<template v-if="s.why"> · {{ s.why }}</template></p>
              </div>
              <button type="button" class="btn-secondary h-8 shrink-0 text-[12px]" data-test="titulo-aplicar" @click="text = s.title">Aplicar sugestão</button>
            </li>
          </ul>

          <footer class="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <template v-if="!confirming">
              <button type="button" class="btn-primary h-9" :disabled="!canPublish" data-test="titulo-publicar" @click="confirming = true">Publicar título</button>
              <span v-if="!session.isAdmin" class="text-[12px] text-ink-3">Só administradores publicam no Mercado Livre.</span>
            </template>
            <template v-else>
              <span class="text-ink">O título muda no Mercado Livre agora. Confirmar?</span>
              <button type="button" class="btn-primary h-9" :disabled="publishing" data-test="titulo-confirmar" @click="publish">{{ publishing ? 'Publicando…' : 'Sim, publicar' }}</button>
              <button type="button" class="btn-secondary h-9" :disabled="publishing" @click="confirming = false">Cancelar</button>
            </template>
          </footer>
        </template>
      </template>
    </div>
  </div>
</template>
