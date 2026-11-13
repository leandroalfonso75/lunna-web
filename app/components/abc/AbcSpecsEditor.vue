<script setup lang="ts">
import { ClipboardDocumentListIcon, SparklesIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, reactive, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { useSessionStore } from '../../stores/session'

/**
 * Curva ABC > "Alterar ficha técnica AGORA" (pedido do usuário em 07/11/2026): os campos que faltam na ficha técnica
 * (obrigatórios e principais da categoria). "Sugerir características" preenche pela IA o que der para afirmar pelo
 * anúncio; cada campo sugerido tem "Aplicar sugestão". "Publicar alterações" grava no Mercado Livre (com confirmação).
 * Anúncio com variações (11/11/2026): cor e voltagem já ficam nas variações e não são pedidas; campo de variação vale
 * para todas (per_variation "same"), menos o código universal (GTIN), que tem um campo por variação ("each").
 */
const props = defineProps<{ itemId: string; variations?: number }>()
const emit = defineEmits<{ close: []; changed: [] }>()

interface Field { id: string; name: string; value_type: string; required: boolean; hint: string | null; values: { id: string; name: string }[]; free_text: boolean; units: { id: string; name: string }[]; default_unit: string | null; max_length: number | null; not_applicable: boolean; multivalued?: boolean; per_variation?: 'same' | 'each' | null }
interface Info { title: string; fields: Field[]; variations?: { id: number; label: string }[] }
interface Suggestion { value_id: string | null; value_name: string; why: string }

const { $api } = useNuxtApp()
const session = useSessionStore()
const toast = useToast()
const query = () => ({ account_id: session.selectedAccountId })

const loading = ref(true)
const info = ref<Info | null>(null)
type Value = { value_id: string | null; value_name: string; not_applicable?: boolean; variations?: Record<string, { value_name: string }> }
const values = reactive<Record<string, Value>>({})
const suggestions = ref<Record<string, Suggestion>>({})
const suggesting = ref(false)
const confirming = ref(false)
const publishing = ref(false)
/** Completar também as outras variações do anúncio pai, só com o que é comum (pedido do usuário em 13/11/2026). */
const allVariations = ref(false)

const isFilled = (v: Value) => !!(v.not_applicable || v.value_id || v.value_name.trim() || Object.values(v.variations ?? {}).some((x) => x.value_name.trim()))
const filledCount = computed(() => Object.values(values).filter(isFilled).length)

/** GTIN de uma variação (um campo por variação). */
function onVariationText(f: Field, variationId: number, text: string) {
  const cur = values[f.id] ?? { value_id: null, value_name: '' }
  values[f.id] = { ...cur, not_applicable: false, variations: { ...(cur.variations ?? {}), [String(variationId)]: { value_name: text } } }
}
const missingCount = computed(() => (info.value?.fields.length ?? 0) - filledCount.value)

onMounted(async () => {
  try {
    info.value = await $api<Info>(`/api/items/${props.itemId}/specs`, { query: query() })
    for (const f of info.value.fields) values[f.id] = { value_id: null, value_name: '' }
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível ler a ficha técnica no Mercado Livre.'))
  } finally {
    loading.value = false
  }
})

/** Campo com lista fechada: escolhe pelo id; com lista aberta ou texto: digita (e a lista vira sugestão). */
const isSelect = (f: Field) => f.values.length > 0 && !f.free_text

function unitHint(f: Field): string {
  return f.units.length ? `ex.: 10 ${f.default_unit ?? f.units[0]?.id ?? ''}` : ''
}

function onSelect(f: Field, id: string) {
  const v = f.values.find((x) => x.id === id)
  values[f.id] = { value_id: v?.id ?? null, value_name: v?.name ?? '' }
}

function onText(f: Field, text: string) {
  const v = f.values.find((x) => x.name.toLowerCase() === text.trim().toLowerCase())
  values[f.id] = { value_id: v?.id ?? null, value_name: text }
}

async function suggest() {
  suggesting.value = true
  try {
    const res = await $api<{ values: Record<string, Suggestion> }>(`/api/items/${props.itemId}/specs/suggest`, { method: 'POST', query: query() })
    suggestions.value = res.values
    // já preenche os campos vazios com as sugestões
    for (const [id, s] of Object.entries(res.values)) {
      const cur = values[id]
      if (cur && !cur.not_applicable && !cur.value_id && !cur.value_name.trim()) values[id] = { value_id: s.value_id, value_name: s.value_name }
    }
    const n = Object.keys(res.values).length
    if (n) toast.success(`${n} característica(s) sugerida(s). Confira antes de publicar.`)
    else toast.info('A IA não encontrou nada seguro para sugerir com os dados do anúncio.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível sugerir características agora.'))
  } finally {
    suggesting.value = false
  }
}

/** "Não se aplica" (o ML guarda como value_id -1): limpa e trava o campo. */
function toggleNA(f: Field, on: boolean) {
  values[f.id] = { value_id: null, value_name: '', not_applicable: on }
}

function apply(id: string) {
  const s = suggestions.value[id]
  if (s) values[id] = { value_id: s.value_id, value_name: s.value_name }
}

async function publish() {
  publishing.value = true
  try {
    const res = await $api<{ message: string; variations?: { ok: boolean }[] | null }>(`/api/items/${props.itemId}/specs`, {
      method: 'POST', query: query(), body: { values, confirm: true, apply_to_variations: allVariations.value }
    })
    if (res.variations?.some((v) => !v.ok)) toast.error(res.message)
    else toast.success(res.message)
    emit('changed')
    emit('close')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'O Mercado Livre não aceitou as alterações.'))
  } finally {
    publishing.value = false
    confirming.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" data-test="alterar-ficha" @click.self="emit('close')">
    <div class="card my-6 w-full max-w-3xl space-y-4 p-5 text-[13px]">
      <header class="flex items-start gap-3">
        <ClipboardDocumentListIcon class="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-[17px] font-semibold text-ink">Alterar ficha técnica</p>
          <p class="truncate text-ink-3">{{ itemId }}<template v-if="info"> · {{ info.title }}</template></p>
        </div>
        <button type="button" class="btn-link" aria-label="Fechar" @click="emit('close')"><XMarkIcon class="h-5 w-5" /></button>
      </header>

      <p v-if="loading" class="text-ink-3">Lendo a ficha técnica no Mercado Livre…</p>

      <template v-else-if="info">
        <p v-if="!info.fields.length" class="text-ink-2">A ficha técnica já está completa no Mercado Livre.</p>

        <template v-else>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn-secondary h-9" :disabled="suggesting" data-test="ficha-sugerir" @click="suggest">
              <SparklesIcon class="h-4 w-4" aria-hidden="true" /> {{ suggesting ? 'Sugerindo…' : 'Sugerir características' }}
            </button>
            <span class="text-ink-3">{{ info.fields.length }} campo(s) faltando · {{ filledCount }} preenchido(s)</span>
          </div>

          <ul class="space-y-3" data-test="ficha-campos">
            <li v-for="f in info.fields" :key="f.id" class="rounded-card border border-line p-3">
              <div class="flex flex-wrap items-end gap-2">
                <label class="min-w-0 flex-1">
                  <span class="mb-1 block font-semibold text-ink">{{ f.name }}<span v-if="f.required" class="ml-1 text-danger" title="Obrigatório">*</span></span>
                  <span v-if="f.per_variation === 'same' && info.variations?.length" class="mb-1 block text-[12px] text-ink-3">Vale para as {{ info.variations.length }} variações ({{ info.variations.map((v) => v.label).join(', ') }}).</span>
                  <span v-if="f.per_variation === 'each'" class="block space-y-1.5" data-test="ficha-por-variacao">
                    <span v-for="v in info.variations ?? []" :key="v.id" class="flex items-center gap-2">
                      <span class="w-40 shrink-0 truncate text-[12px] text-ink-2" :title="v.label">{{ v.label }}</span>
                      <input class="input w-full" type="text" :disabled="values[f.id]?.not_applicable" :value="values[f.id]?.variations?.[String(v.id)]?.value_name ?? ''"
                        @input="onVariationText(f, v.id, ($event.target as HTMLInputElement).value)">
                    </span>
                  </span>
                  <select v-else-if="isSelect(f)" class="input w-full" :disabled="values[f.id]?.not_applicable" :value="values[f.id]?.value_id ?? ''" @change="onSelect(f, ($event.target as HTMLSelectElement).value)">
                    <option value="">— escolha —</option>
                    <option v-for="v in f.values" :key="v.id" :value="v.id">{{ v.name }}</option>
                  </select>
                  <template v-else>
                    <input
                      class="input w-full" type="text" :disabled="values[f.id]?.not_applicable" :list="f.values.length ? `opts-${f.id}` : undefined"
                      :value="values[f.id]?.value_name ?? ''"
                      :placeholder="unitHint(f)"
                      @input="onText(f, ($event.target as HTMLInputElement).value)"
                    >
                    <datalist v-if="f.values.length" :id="`opts-${f.id}`"><option v-for="v in f.values" :key="v.id" :value="v.name" /></datalist>
                  </template>
                </label>
                <button
                  v-if="suggestions[f.id] && !values[f.id]?.not_applicable" type="button" class="btn-secondary h-9 shrink-0 text-[12px]" data-test="ficha-aplicar"
                  @click="apply(f.id)"
                >Aplicar sugestão</button>
              </div>
              <p v-if="suggestions[f.id]" class="mt-1 text-[12px] text-ink-3">Sugestão: <strong class="text-ink">{{ suggestions[f.id]?.value_name }}</strong><template v-if="suggestions[f.id]?.why"> · {{ suggestions[f.id]?.why }}</template></p>
              <label v-if="f.not_applicable" class="mt-2 inline-flex items-center gap-2 text-ink-2" data-test="ficha-nao-se-aplica">
                <input type="checkbox" :checked="!!values[f.id]?.not_applicable" @change="toggleNA(f, ($event.target as HTMLInputElement).checked)">
                Não se aplica
              </label>
              <p v-if="f.multivalued && f.per_variation !== 'each'" class="mt-1 text-[12px] text-ink-3">Aceita mais de um valor: separe por vírgula.</p>
              <p v-if="f.hint" class="mt-1 text-[12px] text-ink-3">{{ f.hint }}</p>
              <p v-if="f.units.length" class="mt-1 text-[12px] text-ink-3">Unidades: {{ f.units.map((u) => u.id).join(', ') }}</p>
            </li>
          </ul>

          <footer class="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <template v-if="!confirming">
              <button type="button" class="btn-primary h-9" :disabled="!filledCount || !session.isAdmin" data-test="ficha-publicar" @click="confirming = true">Publicar alterações</button>
              <span v-if="missingCount > 0 && filledCount" class="text-[12px] text-ink-3">{{ missingCount }} campo(s) continuam vazios e ficam como estão.</span>
              <span v-if="!session.isAdmin" class="text-[12px] text-ink-3">Só administradores publicam no Mercado Livre.</span>
              <label v-if="variations && session.isAdmin" class="inline-flex w-full items-start gap-2 text-[12px] text-ink-2" data-test="ficha-todas-variacoes">
                <input v-model="allVariations" type="checkbox" class="mt-0.5">
                <span>Aplicar também às outras {{ variations }} variações deste anúncio (só os campos comuns que faltarem em cada uma; cor, tom, voltagem e código de cada variação não são copiados)</span>
              </label>
            </template>
            <template v-else>
              <span class="text-ink">{{ filledCount }} característica(s) mudam no Mercado Livre agora{{ allVariations && variations ? `, neste anúncio e nas outras ${variations} variações` : '' }}. Confirmar?</span>
              <button type="button" class="btn-primary h-9" :disabled="publishing" data-test="ficha-confirmar" @click="publish">{{ publishing ? 'Publicando…' : 'Sim, publicar' }}</button>
              <button type="button" class="btn-secondary h-9" :disabled="publishing" @click="confirming = false">Cancelar</button>
            </template>
          </footer>
        </template>
      </template>
    </div>
  </div>
</template>
