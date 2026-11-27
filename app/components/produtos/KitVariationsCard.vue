<script setup lang="ts">
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { computed, reactive, ref, watch } from 'vue'
import { brl } from '../../lib/format'
import { catalogClient, type KitParts } from '../../lib/catalogProducts'

/**
 * Kit = 1 produto com variações + 1 produto simples (pedido do usuário em 26/11/2026). Pergunta acima das Referências;
 * com "Sim", duas colunas: o SKU do produto simples e o SKU pai do produto com variações. O Lunna confere os dois, importa
 * as variações do pai e mostra a prévia dos kits (variação 1 + simples, variação 2 + simples…), com as variações que
 * entram marcadas e o preço sugerido (soma dos preços cheios). "Montar kits" leva tudo para a grade de variações.
 * Sem sugestão de SKU (27/11/2026): o padrão da loja piloto não vale para outras lojas.
 */
export interface KitBuild {
  simple: string; simpleQty: number; parent: string; parentQty: number; axis: string
  rows: { childSku: string; value: string; suggestedPrice: number | null }[]
  simpleName: string | null
}

const props = defineProps<{
  enabled: boolean
  simpleSku: string | null; simpleQty: number; parentSku: string | null; parentQty: number
  builtCount: number; canEdit: boolean
}>()
const emit = defineEmits<{ toggle: [boolean]; build: [KitBuild] }>()

const { $api } = useNuxtApp()
const client = catalogClient($api as never)
const form = reactive({ simple: props.simpleSku ?? '', simpleQty: props.simpleQty || 1, parent: props.parentSku ?? '', parentQty: props.parentQty || 1 })
const parts = ref<KitParts | null>(null)
const loading = ref(false)
const axis = ref('')
const picked = ref<Set<string>>(new Set())
const confirmOff = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function lookup() {
  if (!form.simple.trim() && !form.parent.trim()) { parts.value = null; return }
  loading.value = true
  try {
    const res = await client.kitParts(form.simple.trim(), form.parent.trim())
    parts.value = res
    axis.value = res.axis
    picked.value = new Set(res.children.map((c) => c.sku))
  } catch {
    parts.value = null
  } finally {
    loading.value = false
  }
}
watch(() => [form.simple, form.parent], () => {
  clearTimeout(timer)
  timer = setTimeout(() => void lookup(), 450)
})
if (props.enabled && (form.simple || form.parent)) void lookup()

const ready = computed(() => !!parts.value?.simple.ok && !!parts.value?.parent.ok && picked.value.size > 0 && axis.value.trim() !== '')
const simpleName = computed(() => parts.value?.simple.name ?? null)
const preview = computed(() => (parts.value?.children ?? []).map((c) => ({
  ...c, on: picked.value.has(c.sku), kitPrice: kitPrice(c.price)
})))
// preço cheio da variação × qtd + preço cheio do simples × qtd; sem preço cadastrado em algum dos dois, sem sugestão
function kitPrice(childPrice: number | null) {
  const simple = parts.value?.simple.price
  if (!childPrice || !simple) return null
  return Math.round((childPrice * form.parentQty + simple * form.simpleQty) * 100) / 100
}
const missingPrice = computed(() => {
  const list: string[] = []
  if (parts.value?.simple.ok && !parts.value.simple.price) list.push(parts.value.simple.sku)
  for (const c of parts.value?.children ?? []) if (picked.value.has(c.sku) && !c.price) list.push(c.sku)
  return list
})
const kitCost = (childCost: number | null) => {
  const simple = parts.value?.simple.cost
  if (childCost === null || childCost === undefined || simple === null || simple === undefined) return null
  return Math.round((childCost * form.parentQty + simple * form.simpleQty) * 100) / 100
}

function togglePick(sku: string) {
  const next = new Set(picked.value)
  if (next.has(sku)) next.delete(sku)
  else next.add(sku)
  picked.value = next
}

function build() {
  if (!ready.value || !parts.value) return
  emit('build', {
    simple: form.simple.trim(), simpleQty: form.simpleQty > 0 ? form.simpleQty : 1, parent: form.parent.trim(), parentQty: form.parentQty > 0 ? form.parentQty : 1,
    axis: axis.value.trim(),
    rows: preview.value.filter((r) => r.on).map((r) => ({ childSku: r.sku, value: r.value, suggestedPrice: r.kitPrice })),
    simpleName: simpleName.value
  })
}

function answer(yes: boolean) {
  if (yes === props.enabled) return
  if (!yes && props.builtCount > 0 && !confirmOff.value) { confirmOff.value = true; return }
  confirmOff.value = false
  emit('toggle', yes)
}
</script>

<template>
  <section class="card space-y-4 p-5" data-test="kit-variacoes">
    <div>
      <p class="text-[15px] font-semibold text-ink">Composição do kit</p>
      <p class="mt-1 text-[13px] text-ink">Este kit é <strong>1 produto com variações + 1 produto simples</strong>?</p>
      <p class="text-[12px] text-ink-3">Ex.: Secador 127V/220V + Difusor vira dois kits, "Secador 127V + Difusor" e "Secador 220V + Difusor", cada um com o seu SKU, numa só ficha com variações.</p>
      <div class="mt-2 flex gap-2" role="radiogroup" aria-label="Kit de produto com variações mais produto simples">
        <button type="button" role="radio" :aria-checked="!enabled" class="h-9 rounded-md border px-4 text-[13px]" :class="!enabled ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-line text-ink-2'" :disabled="!canEdit" data-test="kit-variacoes-nao" @click="answer(false)">Não</button>
        <button type="button" role="radio" :aria-checked="enabled" class="h-9 rounded-md border px-4 text-[13px]" :class="enabled ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-line text-ink-2'" :disabled="!canEdit" data-test="kit-variacoes-sim" @click="answer(true)">Sim</button>
      </div>
      <p v-if="confirmOff" class="mt-2 rounded-card border border-warning bg-warning-soft px-3 py-2 text-[12px] text-ink" data-test="kit-variacoes-confirmar">
        Responder "Não" tira os {{ builtCount }} kits montados (SKU, EAN, preço e estoque de cada um). Clique em "Não" de novo para confirmar.
      </p>
    </div>

    <template v-if="enabled">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-1 rounded-card border border-line p-3" data-test="kit-simples">
          <p class="text-[13px] font-semibold text-ink">1. SKU do produto simples</p>
          <p class="text-[12px] text-ink-3">O item que vai igual em todos os kits (ex.: o difusor).</p>
          <div class="flex items-center gap-2">
            <input v-model="form.simple" class="input h-9 flex-1 font-mono" :disabled="!canEdit" placeholder="SKU do produto simples" data-test="kit-simples-sku" />
            <label class="flex items-center gap-1 text-[12px] text-ink-3">qtd<input v-model.number="form.simpleQty" type="number" min="1" step="1" class="input h-9 w-16 text-right" :disabled="!canEdit" data-test="kit-simples-qtd" /></label>
          </div>
          <p v-if="parts?.simple.ok" class="flex items-center gap-1 text-[12px] text-success" data-test="kit-simples-ok"><CheckCircleIcon class="h-4 w-4" />{{ parts.simple.name }}<span v-if="parts.simple.cost" class="text-ink-3">· custo {{ brl(parts.simple.cost) }}</span></p>
          <p v-else-if="parts?.simple.error && form.simple" class="flex items-center gap-1 text-[12px] text-danger" data-test="kit-simples-erro"><ExclamationTriangleIcon class="h-4 w-4" />{{ parts.simple.error }}</p>
        </div>
        <div class="space-y-1 rounded-card border border-line p-3" data-test="kit-pai">
          <p class="text-[13px] font-semibold text-ink">2. SKU pai do produto com variações</p>
          <p class="text-[12px] text-ink-3">O Lunna importa todas as variações dele (ex.: o secador → 127V e 220V).</p>
          <div class="flex items-center gap-2">
            <input v-model="form.parent" class="input h-9 flex-1 font-mono" :disabled="!canEdit" placeholder="SKU pai" data-test="kit-pai-sku" />
            <label class="flex items-center gap-1 text-[12px] text-ink-3">qtd<input v-model.number="form.parentQty" type="number" min="1" step="1" class="input h-9 w-16 text-right" :disabled="!canEdit" data-test="kit-pai-qtd" /></label>
          </div>
          <p v-if="parts?.parent.ok" class="flex items-center gap-1 text-[12px] text-success" data-test="kit-pai-ok"><CheckCircleIcon class="h-4 w-4" />{{ parts.parent.name }} · {{ parts.children.length }} variações</p>
          <p v-else-if="parts?.parent.error && form.parent" class="flex items-center gap-1 text-[12px] text-danger" data-test="kit-pai-erro"><ExclamationTriangleIcon class="h-4 w-4" />{{ parts.parent.error }}</p>
        </div>
      </div>
      <p v-if="loading" class="flex items-center gap-1 text-[12px] text-ink-3"><ArrowPathIcon class="h-4 w-4 animate-spin" /> Conferindo os SKUs…</p>

      <div v-if="parts?.parent.ok && parts.children.length" class="space-y-2" data-test="kit-previa">
        <div class="flex flex-wrap items-center gap-3 text-[13px]">
          <label class="flex items-center gap-2"><span class="font-semibold text-ink">Tipo de variação</span><input v-model="axis" class="input h-8 w-40" :disabled="!canEdit" data-test="kit-eixo" /></label>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] border-collapse text-[13px]">
            <thead class="bg-surface-2 text-left text-ink-2">
              <tr><th class="w-10 px-2 py-2">Entra</th><th class="px-2 py-2">{{ axis || 'Variação' }}</th><th class="px-2 py-2">Variação do pai</th><th class="px-2 py-2">Kit</th><th class="px-2 py-2 text-right">Custo do kit</th><th class="px-2 py-2 text-right" title="Soma do preço cheio (preço de venda cadastrado, não o promocional) dos componentes × quantidade">Preço sugerido</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in preview" :key="r.sku" class="border-b border-line" :class="r.on ? '' : 'opacity-50'" data-test="kit-previa-linha">
                <td class="px-2 py-1"><input type="checkbox" :checked="r.on" :disabled="!canEdit" :aria-label="`Incluir ${r.value}`" data-test="kit-previa-entra" @change="togglePick(r.sku)" /></td>
                <td class="px-2 py-1 font-semibold text-ink">{{ r.value }}</td>
                <td class="px-2 py-1"><span class="font-mono text-[12px]">{{ r.sku }}</span><span class="block truncate text-[12px] text-ink-3">{{ r.name }}</span></td>
                <td class="px-2 py-1 text-ink-2">{{ form.parentQty > 1 ? `${form.parentQty}× ` : '' }}{{ r.value }} + {{ form.simpleQty > 1 ? `${form.simpleQty}× ` : '' }}{{ simpleName ?? form.simple }}</td>
                <td class="px-2 py-1 text-right">{{ kitCost(r.cost) === null ? '—' : brl(kitCost(r.cost)) }}</td>
                <td class="px-2 py-1 text-right" data-test="kit-previa-preco">{{ r.kitPrice === null ? '—' : brl(r.kitPrice) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="btn-primary h-9" :disabled="!canEdit || !ready" data-test="kit-montar" @click="build">{{ builtCount ? 'Montar de novo' : 'Montar kits' }} ({{ picked.size }})</button>
          <span v-if="!parts.simple.ok" class="text-[12px] text-danger">Confira o SKU do produto simples.</span>
          <span v-else class="text-[12px] text-ink-3">Cada kit vira uma variação na grade abaixo: preencha SKU, EAN e estoque; o preço vem sugerido (soma dos preços cheios) e pode ser editado.{{ builtCount ? ' Montar de novo mantém o que você já preencheu nas variações que continuam.' : '' }}</span>
        </div>
        <p v-if="missingPrice.length" class="text-[12px] text-warning" data-test="kit-sem-preco">Sem preço de venda cadastrado: {{ missingPrice.join(', ') }}. O preço desses kits não será sugerido.</p>
      </div>
    </template>
  </section>
</template>
