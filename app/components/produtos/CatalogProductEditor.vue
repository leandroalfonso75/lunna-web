<script setup lang="ts">
import { ArrowPathIcon, ExclamationTriangleIcon, PhotoIcon, SparklesIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue'
import SkuPicker from './SkuPicker.vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl, dateTimeShort } from '../../lib/format'
import { useSessionStore } from '../../stores/session'
import {
  AXIS_SUGGESTIONS, ICMS_ORIGINS, KIND_LABELS, SPED_TYPES, STATUS_LABELS, TITLE_MAX, buildGrid, catalogClient, compositionCost, importVariationsSheet, validGtin, variationsSheet,
  type CatalogProduct, type ComponentInfo, type SkuHit, type Variation
} from '../../lib/catalogProducts'

/**
 * "Criar Produto com IA" (26/11/2026): cadastro do produto no Lunna em etapas — referências (no Kit, os SKUs que o
 * compõem ou "Não tenho / não quero SKUs de referência"), variações (cada uma pode ser um kit, com itens comuns a todas),
 * rascunho pela IA e revisão por seção, com "Para conferir". Campos fiscais: a IA só sugere, o usuário confirma.
 * Promoção, tipo de anúncio e envio ficam para a publicação do anúncio. Exportar para o ERP vem na próxima etapa.
 */
const props = defineProps<{ product: CatalogProduct }>()
const emit = defineEmits<{ saved: [CatalogProduct]; deleted: [] }>()

const { $api } = useNuxtApp()
const client = catalogClient($api as never)
const session = useSessionStore()
const toast = useToast()
const canEdit = computed(() => session.isAdmin)

const form = reactive<CatalogProduct>(structuredClone(toRaw(props.product)))
const links = ref((form.references.links ?? []).join('\n'))
const axisValues = reactive<Record<string, string>>({})
const newAxis = ref('')
const tab = ref<'gerais' | 'conteudo' | 'ficha' | 'fiscal' | 'estoque' | 'outros'>('gerais')
const saving = ref(false)
const generating = ref(false)
const dirty = ref(false)
const openKitRow = ref<string | null>(null)
const found = reactive<Record<string, SkuHit>>({})
const thumbs = reactive<Record<number, string>>({})

const info = computed<Record<string, ComponentInfo | SkuHit>>(() => ({ ...form.components_info, ...found }))
const refImages = computed(() => form.assets.filter((a) => a.kind === 'referencia'))
const hasKitRows = computed(() => form.variations.some((v) => v.kit))
const kitCost = computed(() => compositionCost(form.kit_components, info.value))
const fiscalSuggestion = computed(() => form.ai_suggestions?.fiscal ?? {})
const kept = computed(() => (form.ai_suggestions?.kept ?? {}) as Record<string, unknown>)

function loadAxisValues() {
  for (const axis of form.variation_axes) {
    axisValues[axis] = [...new Set(form.variations.map((v) => v.attrs[axis]).filter(Boolean))].join(', ')
  }
}
loadAxisValues()

function reset(p: CatalogProduct) {
  Object.assign(form, structuredClone(toRaw(p)))
  links.value = (form.references.links ?? []).join('\n')
  loadAxisValues()
  dirty.value = false
}
watch(() => props.product, (p) => reset(p))
watch(form, () => { dirty.value = true }, { deep: true })
watch(links, () => { dirty.value = true })

// ----- imagens de referência
async function loadThumb(id: number) {
  if (thumbs[id]) return
  const blob = await client.assetBlob(id).catch(() => null)
  if (blob) thumbs[id] = URL.createObjectURL(blob)
}
watch(refImages, (list) => list.forEach((a) => void loadThumb(a.id)), { immediate: true })
onBeforeUnmount(() => Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u)))

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
function uploadImage(file: Blob, name: string) {
  if (!IMAGE_TYPES.includes(file.type)) { toast.error('Use imagens PNG, JPG ou WEBP.'); return }
  if (refImages.value.length >= 6) { toast.error('No máximo 6 fotos de referência.'); return }
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const asset = await client.addAsset(form.id, String(reader.result), name)
      form.assets = [...form.assets, asset]
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível anexar a imagem.'))
    }
  }
  reader.readAsDataURL(file)
}
function onFiles(e: Event) {
  Array.from((e.target as HTMLInputElement).files ?? []).slice(0, 6 - refImages.value.length).forEach((f) => uploadImage(f, f.name))
  ;(e.target as HTMLInputElement).value = ''
}
// Colar (Ctrl+V) um print ou imagem copiada (26/11/2026), além do upload de arquivo; texto colado segue normal.
function onPaste(e: ClipboardEvent) {
  if (!canEdit.value) return
  const files = Array.from(e.clipboardData?.items ?? []).filter((it) => it.kind === 'file' && it.type.startsWith('image/')).map((it) => it.getAsFile()).filter((f): f is File => !!f)
  if (!files.length) return
  e.preventDefault()
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  files.forEach((f, i) => uploadImage(f, f.name && f.name !== 'image.png' ? f.name : `colada-${stamp}-${i + 1}.png`))
}

// Planilha das variações (26/11/2026): modelo com as variações já preenchidas e envio da planilha preenchida.
const sheetResult = ref<string | null>(null)
function downloadSheet() {
  if (!form.variations.length) makeGrid()
  if (!form.variations.length) { toast.error('Digite os valores das variações (ex.: Cor: azul, verde, preto) antes de baixar o modelo.'); return }
  const blob = new Blob([variationsSheet(form.variation_axes, form.variations)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `variacoes-${(form.name || 'produto').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'produto'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
async function onSheet(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!/\.(csv|txt)$/i.test(file.name)) { toast.error('Envie a planilha em CSV (no Excel: Salvar como › CSV).'); return }
  const res = importVariationsSheet(await file.text(), form.variation_axes, form.variations)
  form.variations = res.variations
  loadAxisValues()
  sheetResult.value = `Planilha lida: ${res.updated} variação(ões) atualizada(s)${res.added ? `, ${res.added} nova(s)` : ''}.${res.problems.length ? ` ${res.problems.join(' ')}` : ''}`
  if (res.problems.length) toast.error(res.problems[0]!)
  else toast.success('Planilha aplicada. Confira a grade e clique em Salvar.')
}
async function removeImage(id: number) {
  await client.removeAsset(id).catch(() => null)
  form.assets = form.assets.filter((a) => a.id !== id)
}

// ----- variações
function addAxis(name: string) {
  const axis = name.trim()
  if (!axis || form.variation_axes.includes(axis) || form.variation_axes.length >= 3) return
  form.variation_axes = [...form.variation_axes, axis]
  axisValues[axis] = ''
  newAxis.value = ''
}
function removeAxis(axis: string) {
  form.variation_axes = form.variation_axes.filter((a) => a !== axis)
  Reflect.deleteProperty(axisValues, axis)
  form.variations = form.variations.map((v) => ({ ...v, attrs: Object.fromEntries(Object.entries(v.attrs).filter(([k]) => k !== axis)) }))
}
function makeGrid() {
  const values: Record<string, string[]> = {}
  for (const axis of form.variation_axes) values[axis] = (axisValues[axis] ?? '').split(/[,;\n]/)
  form.variations = buildGrid(form.variation_axes, values, form.variations)
}
function removeVariation(i: number) {
  form.variations = form.variations.filter((_, k) => k !== i)
}
const rowKey = (v: Variation, i: number) => v.key ?? `nova-${i}`
const variationLabel = (v: Variation) => form.variation_axes.map((a) => v.attrs[a]).filter(Boolean).join(' / ')

function rememberHit(hit: SkuHit) { found[hit.sku] = hit }

// ----- salvar / IA
function payload(): Partial<CatalogProduct> {
  const { id: _id, assets: _a, components_info: _c, ai_suggestions: _s, ai_review: _r, ai_generated_at: _g, ai_error: _e, erp_exports: _x, created_at: _ca, updated_at: _ua, kind: _k, ...rest } = toRaw(form)
  return { ...rest, references: { ...form.references, links: links.value.split('\n').map((l) => l.trim()).filter(Boolean) } }
}

const problems = computed(() => {
  const list: string[] = []
  if (form.gtin && !validGtin(form.gtin)) list.push('EAN do produto inválido')
  form.variations.forEach((v) => { if (v.gtin && !validGtin(v.gtin)) list.push(`EAN inválido em ${variationLabel(v)}`) })
  form.titles.forEach((t, i) => { if (t.length > TITLE_MAX) list.push(`Título ${i + 1} com ${t.length} caracteres (máx. ${TITLE_MAX})`) })
  return list
})

async function save(status?: CatalogProduct['status']) {
  saving.value = true
  try {
    const saved = await client.update(form.id, { ...payload(), ...(status ? { status } : {}) })
    reset(saved)
    emit('saved', saved)
    toast.success(status === 'pronto' ? 'Produto marcado como pronto.' : 'Produto salvo.')
    return true
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível salvar o produto.'))
    return false
  } finally {
    saving.value = false
  }
}

async function generate(replace = false) {
  if (dirty.value && !(await save())) return
  generating.value = true
  try {
    const p = await client.generate(form.id, replace)
    reset(p)
    emit('saved', p)
    tab.value = 'gerais'
    toast.success('Rascunho preenchido pela IA. Revise as seções e o "Para conferir".')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'A IA não conseguiu preencher agora.'))
  } finally {
    generating.value = false
  }
}

function useFiscal(field: 'ncm' | 'cest' | 'icms_origin' | 'sped_item_type') {
  const value = fiscalSuggestion.value[field]
  if (value === undefined || value === null) return
  ;(form as unknown as Record<string, unknown>)[field] = value
}
function useKept(field: string) {
  const value = kept.value[field]
  ;(form as unknown as Record<string, unknown>)[field] = Array.isArray(value) ? structuredClone(value) : value
  const next = Object.fromEntries(Object.entries(kept.value).filter(([k]) => k !== field))
  form.ai_suggestions = { ...form.ai_suggestions, kept: next }
}
const KEPT_LABELS: Record<string, string> = { name: 'Nome', brand: 'Marca', line: 'Linha', model: 'Modelo', category: 'Categoria', description: 'Descrição', keywords: 'Palavras-chave', seo_title: 'Título SEO', seo_description: 'Descrição SEO', titles: 'Títulos', technical_sheet: 'Ficha técnica', condition: 'Condição', sale_format: 'Formato de venda' }

function addTitle() { form.titles = [...form.titles, ''] }
function addSheetRow() { form.technical_sheet = [...form.technical_sheet, { name: '', value: '' }] }

const confirmDelete = ref(false)
async function destroy() {
  if (!confirmDelete.value) { confirmDelete.value = true; return }
  await client.remove(form.id).catch((err) => toast.error(apiErrorMessage(err, 'Não foi possível excluir.')))
  emit('deleted')
}

const hasReferences = computed(() => !!(links.value.trim() || form.references.text?.trim() || refImages.value.length || form.kit_components.length ||
  form.common_components.length || form.variations.some((v) => v.components.length)))
const TABS = [
  { key: 'gerais', label: 'Dados gerais' }, { key: 'conteudo', label: 'Títulos e descrição' }, { key: 'ficha', label: 'Ficha técnica' },
  { key: 'fiscal', label: 'Fiscal' }, { key: 'estoque', label: 'Embalagem e estoque' }, { key: 'outros', label: 'Outros' }
] as const
</script>

<template>
  <div class="space-y-5" data-test="produto-ia">
    <!-- cabeçalho -->
    <div class="card flex flex-wrap items-center gap-3 p-4">
      <SparklesIcon class="h-6 w-6 text-primary" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-[17px] font-semibold text-ink">{{ form.name || 'Novo produto' }}</p>
        <p class="text-[13px] text-ink-3">
          {{ KIND_LABELS[form.kind] }} · <span data-test="produto-status">{{ STATUS_LABELS[form.status] }}</span>
          <template v-if="form.ai_generated_at"> · rascunho da IA em {{ dateTimeShort(form.ai_generated_at) }}</template>
        </p>
      </div>
      <template v-if="canEdit">
        <button type="button" class="btn-secondary h-9" :disabled="saving" data-test="produto-salvar" @click="save()">{{ saving ? 'Salvando…' : 'Salvar' }}</button>
        <button type="button" class="btn-primary h-9" :disabled="saving || problems.length > 0 || !form.name" data-test="produto-pronto" @click="save('pronto')">Marcar como pronto</button>
        <button type="button" class="btn-secondary h-9" disabled title="Próxima etapa: exportar o produto para o ERP conectado (Olist hoje)" data-test="produto-exportar">Exportar para o ERP</button>
      </template>
    </div>
    <p v-if="problems.length" class="rounded-card border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger" data-test="produto-problemas">{{ problems.join(' · ') }}</p>

    <!-- 1. referências -->
    <section class="card space-y-4 p-5" data-test="produto-referencias">
      <div>
        <p class="text-[15px] font-semibold text-ink">1. Referências</p>
        <p class="text-[12px] text-ink-3">A IA usa só o que estiver aqui. Links de anúncios do Mercado Livre são lidos pela API; outros sites, pelo texto da página.</p>
      </div>

      <div v-if="form.kind === 'kit'" class="space-y-2 rounded-card border border-line p-3" data-test="kit-componentes">
        <p class="text-[13px] font-semibold text-ink">SKUs que compõem o kit</p>
        <p class="text-[12px] text-ink-3">Textos, ficha técnica e imagens do kit partem dos dados desses produtos.</p>
        <SkuPicker v-model="form.kit_components" :info="info" :disabled="!canEdit || form.no_reference_skus" test-id="kit" @found="rememberHit" />
        <p v-if="kitCost !== null" class="text-[12px] text-ink-2">Custo somado dos componentes: <strong>{{ brl(kitCost) }}</strong></p>
        <label class="flex items-center gap-2 text-[13px] text-ink-2">
          <input v-model="form.no_reference_skus" type="checkbox" :disabled="!canEdit" data-test="kit-sem-skus" />
          Não tenho / não quero SKUs de referência (seguir com as referências abaixo)
        </label>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <label class="text-[13px]">
          <span class="mb-1 block font-semibold text-ink">Links (um por linha)</span>
          <textarea v-model="links" rows="4" class="input h-auto py-2" :disabled="!canEdit" placeholder="https://www.mercadolivre.com.br/... ou site do fabricante" data-test="produto-links" />
        </label>
        <label class="text-[13px]">
          <span class="mb-1 block font-semibold text-ink">Texto (manual, especificações, descrição do fornecedor…)</span>
          <textarea v-model="form.references.text" rows="4" class="input h-auto py-2" :disabled="!canEdit" data-test="produto-texto" />
          <span class="mt-1 block text-[12px] text-ink-3" data-test="produto-texto-dica">Sugerimos colar aqui a ficha técnica, descrição, perguntas e respostas e avaliações do(s) anúncio(s) utilizado(s) como referência no campo anterior.</span>
        </label>
      </div>
      <div>
        <p class="mb-1 text-[13px] font-semibold text-ink">Fotos do produto <span class="font-normal text-ink-3">(até 6)</span></p>
        <div class="flex flex-wrap items-center gap-2" @paste="onPaste">
          <div v-for="a in refImages" :key="a.id" class="relative h-20 w-20 overflow-hidden rounded border border-line" data-test="produto-foto-ref">
            <img v-if="thumbs[a.id]" :src="thumbs[a.id]" alt="" class="h-full w-full object-cover" />
            <PhotoIcon v-else class="m-auto h-8 w-8 text-ink-3" />
            <button v-if="canEdit" type="button" class="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5" aria-label="Tirar foto" @click="removeImage(a.id)"><XMarkIcon class="h-3.5 w-3.5" /></button>
          </div>
          <label v-if="canEdit && refImages.length < 6" class="btn-secondary h-9 cursor-pointer">
            Anexar fotos
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple class="hidden" data-test="produto-anexar" @change="onFiles" />
          </label>
          <div
            v-if="canEdit && refImages.length < 6"
            tabindex="0"
            role="button"
            class="flex h-20 min-w-[220px] flex-1 items-center justify-center rounded border-2 border-dashed border-line px-3 text-center text-[12px] text-ink-3 outline-none focus:border-primary focus:text-primary"
            aria-label="Área para colar imagem: clique e pressione Ctrl+V"
            data-test="produto-colar"
          >
            Clique aqui e cole (Ctrl+V) um print ou uma imagem copiada
          </div>
        </div>
      </div>
      <label class="block text-[13px]">
        <span class="mb-1 block font-semibold text-ink">Observações para a IA</span>
        <textarea v-model="form.notes" rows="2" class="input h-auto py-2" :disabled="!canEdit" placeholder="Ex.: produto sem garantia de fábrica; destacar que vem com difusor." />
      </label>
    </section>

    <!-- 2. variações -->
    <section v-if="form.kind === 'variations'" class="card space-y-4 p-5" data-test="produto-variacoes">
      <div>
        <p class="text-[15px] font-semibold text-ink">2. Variações</p>
        <p class="text-[12px] text-ink-3">Escolha o que varia (até 3), digite os valores separados por vírgula e monte a grade. Uma variação pode ser um kit: marque "É kit" e escolha o item dela; o que vai em todas fica em "Itens em todas as variações-kit".</p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <div v-for="axis in form.variation_axes" :key="axis" class="min-w-[220px] flex-1">
          <div class="mb-1 flex items-center justify-between text-[13px] font-semibold text-ink">
            {{ axis }}
            <button v-if="canEdit" type="button" class="btn-link p-0 text-[12px]" @click="removeAxis(axis)">remover</button>
          </div>
          <input v-model="axisValues[axis]" class="input h-9" :disabled="!canEdit" :placeholder="axis === 'Voltagem' ? '127V, 220V' : 'Vermelho, Preto'" :data-test="`eixo-${axis}`" />
        </div>
        <div v-if="canEdit && form.variation_axes.length < 3" class="flex items-center gap-1">
          <input v-model="newAxis" class="input h-9 w-36" placeholder="Outro eixo" list="eixos" data-test="eixo-novo" @keydown.enter.prevent="addAxis(newAxis)" />
          <datalist id="eixos"><option v-for="s in AXIS_SUGGESTIONS" :key="s" :value="s" /></datalist>
          <button type="button" class="btn-secondary h-9" data-test="eixo-adicionar" @click="addAxis(newAxis)">Adicionar</button>
        </div>
        <button v-if="canEdit && form.variation_axes.length" type="button" class="btn-primary h-9" data-test="montar-grade" @click="makeGrid">Montar grade</button>
      </div>
      <div v-if="canEdit && form.variation_axes.length" class="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface-2 px-3 py-2 text-[13px]" data-test="variacoes-planilha">
        <span class="text-ink-2">SKU, EAN, preço e estoque também por planilha:</span>
        <button type="button" class="btn-secondary h-8 px-3 text-[13px]" data-test="planilha-baixar" @click="downloadSheet">Baixar modelo de planilha</button>
        <label class="btn-secondary h-8 cursor-pointer px-3 text-[13px]">
          Enviar planilha preenchida
          <input type="file" accept=".csv,text/csv" class="hidden" data-test="planilha-enviar" @change="onSheet" />
        </label>
        <span class="w-full text-[11px] text-ink-3">O modelo vem com as variações da grade já preenchidas (uma linha por variação). Preencha SKU, EAN, preço e estoque no Excel, salve em CSV e envie.</span>
        <span v-if="sheetResult" class="w-full text-[12px] text-ink" data-test="planilha-resultado">{{ sheetResult }}</span>
      </div>
      <div v-if="canEdit && !form.variation_axes.length" class="flex flex-wrap gap-2">
        <button v-for="s in AXIS_SUGGESTIONS" :key="s" type="button" class="btn-secondary h-8 px-3 text-[13px]" @click="addAxis(s)">+ {{ s }}</button>
      </div>

      <div v-if="form.variations.length" class="overflow-x-auto">
        <table class="w-full min-w-[820px] border-collapse text-[13px]">
          <thead class="bg-surface-2 text-left text-ink-2">
            <tr><th class="px-2 py-2">Variação</th><th class="px-2 py-2">SKU</th><th class="px-2 py-2">EAN</th><th class="px-2 py-2">Preço</th><th class="px-2 py-2">Estoque inicial</th><th class="px-2 py-2">É kit</th><th class="px-2 py-2" /></tr>
          </thead>
          <tbody>
            <template v-for="(v, i) in form.variations" :key="rowKey(v, i)">
              <tr class="border-b border-line" data-test="variacao-linha">
                <td class="px-2 py-1 font-semibold text-ink">{{ variationLabel(v) }}</td>
                <td class="px-2 py-1"><input v-model="v.sku" class="input h-8" :disabled="!canEdit" data-test="variacao-sku" /></td>
                <td class="px-2 py-1"><input v-model="v.gtin" class="input h-8" :class="v.gtin && !validGtin(v.gtin) ? 'border-danger' : ''" :disabled="!canEdit" data-test="variacao-ean" /></td>
                <td class="px-2 py-1"><input v-model.number="v.price" type="number" step="0.01" min="0" class="input h-8 w-28" :disabled="!canEdit" /></td>
                <td class="px-2 py-1"><input v-model.number="v.stock" type="number" step="1" min="0" class="input h-8 w-24" :disabled="!canEdit" placeholder="opcional" /></td>
                <td class="px-2 py-1">
                  <label class="flex items-center gap-1">
                    <input v-model="v.kit" type="checkbox" :disabled="!canEdit" data-test="variacao-kit" @change="v.kit && (openKitRow = rowKey(v, i))" />
                    <button v-if="v.kit" type="button" class="btn-link p-0 text-[12px]" @click="openKitRow = openKitRow === rowKey(v, i) ? null : rowKey(v, i)">{{ v.components.length ? `${v.components.length} item(ns)` : 'escolher' }}</button>
                  </label>
                </td>
                <td class="px-2 py-1 text-right"><button v-if="canEdit" type="button" class="btn-link p-0.5" aria-label="Tirar variação" @click="removeVariation(i)"><TrashIcon class="h-4 w-4" /></button></td>
              </tr>
              <tr v-if="v.kit && openKitRow === rowKey(v, i)" class="border-b border-line bg-surface-2">
                <td colspan="7" class="px-3 py-2">
                  <p class="mb-1 text-[12px] text-ink-2">Item próprio de <strong>{{ variationLabel(v) }}</strong> (o que muda nesta variação). Os itens comuns entram sozinhos.</p>
                  <SkuPicker v-model="v.components" :info="info" :disabled="!canEdit" test-id="variacao-componente" @found="rememberHit" />
                  <p v-if="compositionCost([...form.common_components, ...v.components], info) !== null" class="mt-1 text-[12px] text-ink-3">Custo da composição: {{ brl(compositionCost([...form.common_components, ...v.components], info)) }}</p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-if="hasKitRows" class="space-y-2 rounded-card border border-line p-3" data-test="itens-comuns">
        <p class="text-[13px] font-semibold text-ink">Itens em todas as variações-kit</p>
        <p class="text-[12px] text-ink-3">Ex.: o Pó Solto que vai junto de cada tom de base, ou o difusor que vai com o secador de 127V e de 220V.</p>
        <SkuPicker v-model="form.common_components" :info="info" :disabled="!canEdit" test-id="comum" @found="rememberHit" />
      </div>
    </section>

    <!-- 3. IA -->
    <section class="card flex flex-wrap items-center gap-3 p-5" data-test="produto-ia-gerar">
      <div class="min-w-0 flex-1">
        <p class="text-[15px] font-semibold text-ink">{{ form.kind === 'variations' ? '3' : '2' }}. Rascunho com IA</p>
        <p class="text-[12px] text-ink-3">Preenche nome, marca, modelo, categoria, títulos (até {{ TITLE_MAX }} caracteres), descrição, ficha técnica e SEO só com o que está nas referências, e sugere os campos fiscais. O que você já digitou não é trocado.</p>
        <p v-if="form.ai_error" class="mt-1 text-[12px] text-danger">{{ form.ai_error }}</p>
      </div>
      <template v-if="canEdit">
        <button type="button" class="btn-primary h-10 px-5" :disabled="generating || !hasReferences" data-test="produto-gerar" @click="generate(false)">
          <ArrowPathIcon v-if="generating" class="h-4 w-4 animate-spin" />
          <SparklesIcon v-else class="h-4 w-4" />
          {{ generating ? 'Gerando… (até 1 minuto)' : form.ai_generated_at ? 'Completar com a IA' : 'Gerar rascunho com IA' }}
        </button>
        <button v-if="form.ai_generated_at" type="button" class="btn-secondary h-10" :disabled="generating" title="Gera de novo e troca nome, títulos, descrição, ficha e SEO; preço, SKU, EAN, estoque e medidas digitadas ficam" data-test="produto-regerar" @click="generate(true)">Gerar de novo substituindo os textos</button>
      </template>
    </section>

    <!-- 4. revisão -->
    <section class="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div class="card space-y-4 p-5" data-test="produto-revisao">
        <p class="text-[15px] font-semibold text-ink">{{ form.kind === 'variations' ? '4' : '3' }}. Revisão do cadastro</p>
        <nav class="flex flex-wrap gap-1 border-b border-line">
          <button v-for="t in TABS" :key="t.key" type="button" class="-mb-px border-b-2 px-3 py-2 text-[13px]" :class="tab === t.key ? 'border-primary font-semibold text-primary' : 'border-transparent text-ink-2'" :data-test="`aba-${t.key}`" @click="tab = t.key">{{ t.label }}</button>
        </nav>

        <fieldset :disabled="!canEdit" class="space-y-3">
          <div v-if="tab === 'gerais'" class="grid gap-3 md:grid-cols-2">
            <label class="text-[13px] md:col-span-2"><span class="mb-1 block font-semibold">Nome do produto</span><input v-model="form.name" class="input" maxlength="120" data-test="campo-nome" /></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">SKU{{ form.kind === 'variations' ? ' do produto pai' : '' }}</span><input v-model="form.sku" class="input" data-test="campo-sku" /></label>
            <label v-if="form.kind !== 'variations'" class="text-[13px]"><span class="mb-1 block font-semibold">EAN / GTIN</span><input v-model="form.gtin" class="input" :class="form.gtin && !validGtin(form.gtin) ? 'border-danger' : ''" data-test="campo-ean" /></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Marca</span><input v-model="form.brand" class="input" /></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Linha</span><input v-model="form.line" class="input" /></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Modelo</span><input v-model="form.model" class="input" /></label>
            <label class="text-[13px] md:col-span-2"><span class="mb-1 block font-semibold">Categoria (caminho completo)</span><input v-model="form.category" class="input" /></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Condição</span>
              <select v-model="form.condition" class="input"><option value="novo">Novo</option><option value="usado">Usado</option><option value="recondicionado">Recondicionado</option></select></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Formato de venda</span>
              <select v-model="form.sale_format" class="input"><option value="unidade">Unidade</option><option value="kit">Kit</option><option value="pack">Pack</option></select></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Unidade</span><input v-model="form.unit" class="input" placeholder="UN" /></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Preço de venda (R$)</span><input v-model="form.price" type="number" step="0.01" min="0" class="input" data-test="campo-preco" /></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Custo (R$) <span class="font-normal text-ink-3">· opcional</span></span><input v-model="form.cost_price" type="number" step="0.01" min="0" class="input" data-test="campo-custo" />
              <span class="mt-1 block text-[11px] text-ink-3" data-test="custo-dica">O custo será atualizado pelo valor de custo informado no lançamento do seu estoque, pelo método PEPS (Primeiro que entra, primeira que sai)</span>
              <span v-if="form.kind === 'kit' && kitCost !== null" class="mt-1 block text-[11px] text-ink-3">componentes somam {{ brl(kitCost) }} · <button type="button" class="btn-link p-0 text-[11px]" @click="form.cost_price = kitCost">usar</button></span></label>
          </div>

          <div v-else-if="tab === 'conteudo'" class="space-y-3">
            <div>
              <p class="mb-1 text-[13px] font-semibold">Títulos sugeridos <span class="font-normal text-ink-3">(até {{ TITLE_MAX }} caracteres, diferentes entre si: o ML inativa anúncios com o mesmo título)</span></p>
              <div v-for="(_, i) in form.titles" :key="i" class="mb-1 flex items-center gap-2">
                <input v-model="form.titles[i]" class="input h-9 flex-1" :class="(form.titles[i]?.length ?? 0) > TITLE_MAX ? 'border-danger' : ''" data-test="campo-titulo" />
                <span class="w-12 text-right text-[12px]" :class="(form.titles[i]?.length ?? 0) > TITLE_MAX ? 'text-danger' : 'text-ink-3'">{{ form.titles[i]?.length ?? 0 }}/{{ TITLE_MAX }}</span>
                <button type="button" class="btn-link p-0.5" aria-label="Tirar título" @click="form.titles = form.titles.filter((_, k) => k !== i)"><XMarkIcon class="h-4 w-4" /></button>
              </div>
              <button type="button" class="btn-link text-[13px]" @click="addTitle">+ título</button>
            </div>
            <label class="block text-[13px]"><span class="mb-1 block font-semibold">Descrição <span class="font-normal text-ink-3">(texto simples, sem links, contatos ou emojis)</span></span>
              <textarea v-model="form.description" rows="12" class="input h-auto py-2 font-mono text-[12px]" data-test="campo-descricao" /></label>
            <div class="grid gap-3 md:grid-cols-2">
              <label class="text-[13px] md:col-span-2"><span class="mb-1 block font-semibold">Palavras-chave</span><input v-model="form.keywords" class="input" /></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Título SEO</span><input v-model="form.seo_title" class="input" /></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Link do vídeo</span><input v-model="form.video_url" class="input" /></label>
              <label class="text-[13px] md:col-span-2"><span class="mb-1 block font-semibold">Descrição SEO</span><textarea v-model="form.seo_description" rows="2" class="input h-auto py-2" /></label>
            </div>
          </div>

          <div v-else-if="tab === 'ficha'" class="space-y-1">
            <div v-for="(row, i) in form.technical_sheet" :key="i" class="flex items-center gap-2" data-test="ficha-linha">
              <input v-model="row.name" class="input h-9 w-1/3" placeholder="Atributo" />
              <input v-model="row.value" class="input h-9 flex-1" placeholder="Valor" />
              <button type="button" class="btn-link p-0.5" aria-label="Tirar linha" @click="form.technical_sheet = form.technical_sheet.filter((_, k) => k !== i)"><XMarkIcon class="h-4 w-4" /></button>
            </div>
            <button type="button" class="btn-link text-[13px]" @click="addSheetRow">+ atributo</button>
          </div>

          <div v-else-if="tab === 'fiscal'" class="space-y-3" data-test="aba-fiscal-conteudo">
            <p class="flex items-start gap-2 rounded-card border border-warning bg-warning-soft px-3 py-2 text-[13px] text-ink">
              <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              Campos fiscais vão para a nota fiscal: a IA só sugere. Confira com a sua contabilidade antes de usar.
            </p>
            <p v-if="fiscalSuggestion.why" class="text-[12px] text-ink-3">Sugestão da IA: {{ fiscalSuggestion.why }}</p>
            <div class="grid gap-3 md:grid-cols-2">
              <label class="text-[13px]"><span class="mb-1 block font-semibold">NCM</span><input v-model="form.ncm" class="input border-warning" data-test="campo-ncm" />
                <span v-if="fiscalSuggestion.ncm && fiscalSuggestion.ncm !== form.ncm" class="mt-1 block text-[12px] text-ink-3">sugerido: {{ fiscalSuggestion.ncm }} · <button type="button" class="btn-link p-0 text-[12px]" data-test="usar-ncm" @click="useFiscal('ncm')">usar</button></span></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">CEST</span><input v-model="form.cest" class="input border-warning" />
                <span v-if="fiscalSuggestion.cest && fiscalSuggestion.cest !== form.cest" class="mt-1 block text-[12px] text-ink-3">sugerido: {{ fiscalSuggestion.cest }} · <button type="button" class="btn-link p-0 text-[12px]" @click="useFiscal('cest')">usar</button></span></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Origem (ICMS)</span>
                <select v-model="form.icms_origin" class="input border-warning"><option :value="null">Selecione</option><option v-for="(o, i) in ICMS_ORIGINS" :key="i" :value="i">{{ o }}</option></select>
                <span v-if="fiscalSuggestion.icms_origin !== undefined && fiscalSuggestion.icms_origin !== form.icms_origin" class="mt-1 block text-[12px] text-ink-3">sugerido: {{ ICMS_ORIGINS[fiscalSuggestion.icms_origin] }} · <button type="button" class="btn-link p-0 text-[12px]" @click="useFiscal('icms_origin')">usar</button></span></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Tipo do item (SPED)</span>
                <select v-model="form.sped_item_type" class="input border-warning"><option :value="null">Selecione</option><option v-for="s in SPED_TYPES" :key="s" :value="s">{{ s }}</option></select>
                <span v-if="fiscalSuggestion.sped_item_type && fiscalSuggestion.sped_item_type !== form.sped_item_type" class="mt-1 block text-[12px] text-ink-3">sugerido: {{ fiscalSuggestion.sped_item_type }} · <button type="button" class="btn-link p-0 text-[12px]" @click="useFiscal('sped_item_type')">usar</button></span></label>
            </div>
          </div>

          <div v-else-if="tab === 'estoque'" class="space-y-3">
            <p class="text-[12px] text-ink-3">
              Embalagem pronta para envio: largura × altura × comprimento em cm inteiros e peso bruto em kg.
              <span v-if="form.package_source === 'ia'" class="font-semibold text-ink-2">Medidas tiradas das referências pela IA: confira.</span>
              <span v-else-if="form.package_source === 'nao_encontrado'" class="font-semibold text-danger">Não encontradas nas referências: informe.</span>
            </p>
            <div class="grid gap-3 md:grid-cols-4">
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Largura (cm)</span><input v-model.number="form.package_width" type="number" min="0" step="1" class="input" /></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Altura (cm)</span><input v-model.number="form.package_height" type="number" min="0" step="1" class="input" /></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Comprimento (cm)</span><input v-model.number="form.package_length" type="number" min="0" step="1" class="input" /></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Peso bruto (kg)</span><input v-model="form.weight_gross" type="number" min="0" step="0.001" class="input" /></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Peso líquido (kg)</span><input v-model="form.weight_net" type="number" min="0" step="0.001" class="input" /></label>
            </div>
            <div class="grid gap-3 border-t border-line pt-3 md:grid-cols-3">
              <label class="flex items-center gap-2 text-[13px] md:col-span-3"><input v-model="form.stock_control" type="checkbox" /> Controlar estoque</label>
              <label v-if="form.kind !== 'variations'" class="text-[13px]"><span class="mb-1 block font-semibold">Estoque inicial</span><input v-model="form.initial_stock" type="number" min="0" step="1" class="input" placeholder="opcional" data-test="campo-estoque" />
                <span class="mt-1 block text-[11px] text-ink-3">Pode deixar em branco e lançar depois na seção Estoque.</span></label>
              <p v-else class="text-[12px] text-ink-3 md:col-span-3">O estoque inicial de cada variação fica na grade de variações (opcional; pode lançar depois na seção Estoque).</p>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Estoque mínimo</span><input v-model="form.min_stock" type="number" min="0" step="1" class="input" /></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Estoque máximo</span><input v-model="form.max_stock" type="number" min="0" step="1" class="input" /></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Localização</span><input v-model="form.location" class="input" /></label>
              <label class="text-[13px]"><span class="mb-1 block font-semibold">Dias para preparação</span><input v-model.number="form.preparation_days" type="number" min="0" step="1" class="input" /></label>
            </div>
          </div>

          <div v-else class="grid gap-3 md:grid-cols-2">
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Garantia</span><input v-model="form.warranty" class="input" placeholder="Ex.: 90 dias pelo vendedor" /></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Fornecedor</span><input v-model="form.supplier" class="input" /></label>
            <label class="text-[13px]"><span class="mb-1 block font-semibold">Registro Anvisa</span><input v-model="form.regulatory.anvisa" class="input" placeholder="só se houver" /></label>
          </div>
        </fieldset>
      </div>

      <!-- para conferir -->
      <aside class="space-y-3">
        <div class="card space-y-2 p-4" data-test="para-conferir">
          <p class="text-[14px] font-semibold text-ink">Para conferir</p>
          <ul v-if="form.ai_review.length" class="list-disc space-y-1 pl-4 text-[12px] text-ink-2">
            <li v-for="(r, i) in form.ai_review" :key="i">{{ r }}</li>
          </ul>
          <p v-else class="text-[12px] text-ink-3">{{ form.ai_generated_at ? 'Nada pendente apontado pela IA.' : 'Aparece aqui depois do rascunho da IA: o que foi omitido por falta de evidência, divergências e o que você precisa confirmar.' }}</p>
        </div>
        <div v-if="Object.keys(kept).length" class="card space-y-2 p-4" data-test="sugestoes-guardadas">
          <p class="text-[14px] font-semibold text-ink">Sugestões da IA não aplicadas</p>
          <p class="text-[12px] text-ink-3">Estes campos já tinham valor seu; a IA sugeriu outro.</p>
          <div v-for="(value, field) in kept" :key="field" class="rounded border border-line p-2 text-[12px]">
            <p class="font-semibold text-ink">{{ KEPT_LABELS[field] ?? field }}</p>
            <p class="line-clamp-3 text-ink-2">{{ Array.isArray(value) ? value.map((x) => typeof x === 'string' ? x : `${(x as { name: string }).name}: ${(x as { value: string }).value}`).join(' · ') : value }}</p>
            <button v-if="canEdit" type="button" class="btn-link p-0 text-[12px]" @click="useKept(String(field))">usar esta</button>
          </div>
        </div>
        <div v-if="canEdit" class="card p-4">
          <button type="button" class="btn-link text-[12px] text-danger" data-test="produto-excluir" @click="destroy">{{ confirmDelete ? 'Clique de novo para excluir este rascunho' : 'Excluir este rascunho' }}</button>
        </div>
      </aside>
    </section>
  </div>
</template>
