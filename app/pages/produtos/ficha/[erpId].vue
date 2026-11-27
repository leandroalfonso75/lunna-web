<script setup lang="ts">
import { ArrowLeftIcon, ArrowPathIcon, ExclamationTriangleIcon, PhotoIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { usePageHeader } from '../../../composables/usePageHeader'
import { apiErrorMessage } from '../../../lib/apiErrors'
import { KIND_LABELS, catalogClient, type ErpCatalogProduct, type ErpStockInfo } from '../../../lib/catalogProducts'
import { brl, dateTimeShort } from '../../../lib/format'
import { useToast } from '../../../composables/useToast'
import { useSessionStore } from '../../../stores/session'

/**
 * `/produtos/ficha/:erpId` — ficha completa de um produto vindo do ERP (migração de 27/11/2026), aberta pelo id dele (ou
 * de uma variação) no ERP. Só leitura: o ERP manda nos dados. Estoque e custo vêm da cópia sincronizada: o custo é o
 * PEPS do histórico de entradas e o estoque do kit é o do componente que acaba primeiro.
 */
const route = useRoute()
const { $api } = useNuxtApp()
const client = catalogClient($api as never)
const header = usePageHeader()

const product = ref<ErpCatalogProduct | null>(null)
const error = ref('')
const loading = ref(true)
const thumbs = ref<Record<number, string>>({})
const big = ref<number | null>(null)
const session = useSessionStore()
const toast = useToast()
const reimporting = ref(false)

/** "Reimportar do ERP": relê agora a ficha (dados, fotos, variações e kit); a atualização automática também roda sozinha. */
async function reimport() {
  if (!product.value || reimporting.value) return
  reimporting.value = true
  try {
    product.value = await client.reimport(product.value.id)
    Object.values(thumbs.value).forEach((u) => URL.revokeObjectURL(u))
    thumbs.value = {}
    for (const a of product.value.assets.filter((x) => x.kind === 'foto')) {
      client.assetBlob(a.id).then((b) => { thumbs.value = { ...thumbs.value, [a.id]: URL.createObjectURL(b) } }).catch(() => {})
    }
    toast.success('Ficha relida do ERP.')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Não foi possível reimportar agora.'))
  } finally {
    reimporting.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    product.value = await client.byErp(String(route.params.erpId))
    for (const a of product.value.assets.filter((x) => x.kind === 'foto')) {
      client.assetBlob(a.id).then((b) => { thumbs.value = { ...thumbs.value, [a.id]: URL.createObjectURL(b) } }).catch(() => {})
    }
  } catch (e) {
    error.value = apiErrorMessage(e, 'Não foi possível abrir a ficha.')
  } finally {
    loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => Object.values(thumbs.value).forEach((u) => URL.revokeObjectURL(u)))

watchEffect(() => {
  header.state.title = product.value?.name ?? 'Ficha do produto'
  header.state.subtitle = product.value ? `Produtos · ficha do ${product.value.erp_name ?? 'ERP'}` : 'Produtos'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = loading.value
  header.state.onRefresh = load
})

const p = computed(() => product.value)
const photos = computed(() => (p.value?.assets ?? []).filter((a) => a.kind === 'foto' && !a.variation_key))
const variationPhotos = (key?: string) => (p.value?.assets ?? []).filter((a) => a.kind === 'foto' && a.variation_key === key)
const stockOf = (key?: string): ErpStockInfo | null => (key && p.value?.erp_stock?.variations[key]) || null
const qty = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }))
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
const ORIGIN: Record<number, string> = {
  0: '0 · Nacional', 1: '1 · Estrangeira (importação direta)', 2: '2 · Estrangeira (mercado interno)', 3: '3 · Nacional, conteúdo importado > 40%',
  4: '4 · Nacional (processos básicos)', 5: '5 · Nacional, conteúdo importado ≤ 40%', 6: '6 · Estrangeira sem similar (importação direta)',
  7: '7 · Estrangeira sem similar (mercado interno)', 8: '8 · Nacional, conteúdo importado > 70%'
}
/** O componente que limita o kit (o que acaba primeiro). */
const limiting = (s: ErpStockInfo | null) => (s?.parts.length ? [...s.parts].sort((a, b) => a.kits - b.kits)[0] : null)

const facts = computed(() => {
  const x = p.value
  if (!x) return []
  const dims = x.package_width || x.package_height || x.package_length ? `${x.package_width ?? '—'} × ${x.package_height ?? '—'} × ${x.package_length ?? '—'} cm (L × A × C)` : null
  return [
    ['SKU', x.sku], ['GTIN / EAN', x.gtin], ['Unidade', x.unit], ['NCM', x.ncm], ['CEST', x.cest],
    ['Origem', x.icms_origin !== null && x.icms_origin !== undefined ? ORIGIN[x.icms_origin] ?? String(x.icms_origin) : null],
    ['Marca', x.brand], ['Categoria', x.category], ['Garantia', x.warranty], ['Fornecedor', x.supplier],
    ['Peso líquido', num(x.weight_net) ? `${qty(num(x.weight_net))} kg` : null], ['Peso bruto', num(x.weight_gross) ? `${qty(num(x.weight_gross))} kg` : null],
    ['Embalagem', dims], ['Controla estoque', x.stock_control ? 'Sim' : 'Não'],
    ['Estoque mínimo', num(x.min_stock) ? qty(num(x.min_stock)) : null], ['Estoque máximo', num(x.max_stock) ? qty(num(x.max_stock)) : null],
    ['Localização', x.location], ['Dias para preparar', x.preparation_days], ['Vídeo', x.video_url],
    ['Título SEO', x.seo_title], ['Descrição SEO', x.seo_description], ['Palavras-chave', x.keywords], ['Observações', x.notes]
  ] as [string, string | number | null][]
})

/** A descrição do ERP às vezes vem em HTML (copiada de editor): a ficha mostra o texto, com as quebras dos parágrafos. */
const descriptionText = computed(() => {
  const d = p.value?.description ?? ''
  if (!/<[a-z][\s\S]*>/i.test(d)) return d
  const withBreaks = d.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
  if (typeof DOMParser === 'undefined') return withBreaks.replace(/<[^>]+>/g, '')
  const text = new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent ?? ''
  return text.replace(/\n{3,}/g, '\n\n').trim()
})

/** Campos do ERP sem lugar próprio na ficha (para conferência). */
const extras = computed(() => {
  const raw = p.value?.erp_payload ?? {}
  const pick: [string, string][] = [['unidadePorCaixa', 'Unidades por caixa'], ['tags', 'Tags'], ['tributacao', 'Tributação'], ['codigoListaServicos', 'Código de serviço']]
  return pick.map(([k, label]) => [label, JSON.stringify(raw[k] ?? null)] as [string, string]).filter(([, v]) => v !== 'null' && v !== '""' && v !== '[]')
})
</script>

<template>
  <div class="page space-y-5" data-test="ficha-erp">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <NuxtLink to="/produtos" class="btn-link inline-flex items-center gap-1"><ArrowLeftIcon class="h-4 w-4" aria-hidden="true" /> Produtos</NuxtLink>
        <h1 class="page-title mt-2">{{ p?.name ?? 'Ficha do produto' }}</h1>
        <div v-if="p" class="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          <span class="pill-primary">{{ KIND_LABELS[p.kind] }}</span>
          <span class="pill-neutral font-mono">{{ p.sku }}</span>
          <span>Copiado do {{ p.erp_name ?? 'ERP' }} (id {{ p.erp_id }})<template v-if="p.erp_synced_at"> em {{ dateTimeShort(p.erp_synced_at) }}</template> · o ERP manda nos dados; atualiza sozinha quando o produto muda lá</span>
        </div>
      </div>
      <button v-if="p && session.isAdmin" type="button" class="btn-secondary shrink-0" :disabled="reimporting" data-test="reimportar-erp" @click="reimport">
        <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': reimporting }" aria-hidden="true" />
        {{ reimporting ? 'Relendo no ERP…' : `Reimportar do ${p.erp_name ?? 'ERP'}` }}
      </button>
    </header>

    <p v-if="loading && !p" class="card p-8 text-center text-ink-3">Carregando a ficha…</p>
    <div v-else-if="error" class="card p-8 text-center" role="alert">
      <p class="text-[15px] font-semibold text-ink">{{ error }}</p>
      <NuxtLink to="/produtos" class="btn-secondary mt-4 inline-flex">Voltar para Produtos</NuxtLink>
    </div>

    <template v-else-if="p">
      <!-- indicadores -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="card p-4"><p class="text-[13px] font-semibold text-ink-2">Preço de venda</p><p class="mt-1 text-[24px] font-bold text-ink" data-numeric>{{ p.price !== null ? brl(Number(p.price)) : '—' }}</p><p class="text-[13px] text-ink-3">no {{ p.erp_name ?? 'ERP' }}</p></div>
        <div class="card p-4" data-test="ficha-estoque">
          <p class="text-[13px] font-semibold text-ink-2">{{ p.kind === 'kit' ? 'Estoque do kit' : 'Estoque disponível' }}</p>
          <p class="mt-1 text-[24px] font-bold text-ink" data-numeric>{{ qty(p.kind === 'variations' ? p.erp_stock?.total_stock : p.erp_stock?.stock) }}</p>
          <p class="text-[13px] text-ink-3">{{ p.kind === 'kit' ? 'o do componente que acaba primeiro' : p.kind === 'variations' ? 'somando as variações (kits pelo componente)' : 'no depósito do ERP' }}</p>
        </div>
        <div class="card p-4" data-test="ficha-custo">
          <p class="text-[13px] font-semibold text-ink-2">Custo (PEPS)</p>
          <p class="mt-1 text-[24px] font-bold text-ink" data-numeric>{{ p.erp_stock?.cost !== null && p.erp_stock?.cost !== undefined ? brl(p.erp_stock.cost) : '—' }}</p>
          <p class="text-[13px] text-ink-3">{{ p.kind === 'kit' ? 'soma dos componentes' : p.kind === 'variations' ? 'por variação, na tabela abaixo' : 'custo das entradas de estoque' }}</p>
        </div>
        <div class="card p-4"><p class="text-[13px] font-semibold text-ink-2">Fotos</p><p class="mt-1 text-[24px] font-bold text-ink" data-numeric>{{ p.assets.filter((a) => a.kind === 'foto').length }}</p><p class="text-[13px] text-ink-3">baixadas para o Lunna, na ordem do ERP</p></div>
      </div>

      <div v-if="p.erp_warnings?.length" class="flex gap-3 rounded-panel border border-warning bg-warning-soft px-4 py-3 text-[14px] text-ink" data-test="ficha-avisos">
        <ExclamationTriangleIcon class="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div><p class="font-semibold">Pontos para conferir no cadastro do ERP</p><ul class="mt-1 list-disc pl-5"><li v-for="w in p.erp_warnings" :key="w">{{ w }}</li></ul></div>
      </div>

      <!-- fotos -->
      <section class="card p-5" data-test="ficha-fotos">
        <h2 class="section-title mb-3">Fotos do produto</h2>
        <div v-if="photos.length" class="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          <button v-for="(a, i) in photos" :key="a.id" type="button" class="relative aspect-square overflow-hidden rounded-[10px] border border-line bg-surface-2" :title="`Foto ${i + 1}`" @click="big = a.id">
            <img v-if="thumbs[a.id]" :src="thumbs[a.id]" :alt="`Foto ${i + 1} de ${p.name}`" class="h-full w-full object-contain" />
            <PhotoIcon v-else class="m-auto h-8 w-8 text-ink-3" aria-hidden="true" />
            <span class="absolute left-1 top-1 rounded bg-surface px-1.5 text-[11px] font-semibold text-ink-2">{{ i + 1 }}</span>
          </button>
        </div>
        <p v-else class="text-[14px] text-ink-3">O ERP não tem fotos deste produto.</p>
      </section>

      <!-- kit -->
      <section v-if="p.kind === 'kit'" class="card overflow-hidden" data-test="ficha-kit">
        <div class="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
          <h2 class="section-title">Componentes do kit</h2>
          <p class="text-[14px] text-ink-2">Estoque do kit: <strong class="text-ink">{{ qty(p.erp_stock?.stock) }}</strong><template v-if="limiting(p.erp_stock)"> · limitado por {{ limiting(p.erp_stock)?.sku }}</template></p>
        </div>
        <table class="mt-3 w-full text-[13px]">
          <thead><tr class="border-b border-line text-left text-ink-2"><th class="px-4 py-2">SKU</th><th class="px-4 py-2">Produto</th><th class="px-4 py-2 text-right">Qtd. no kit</th><th class="px-4 py-2 text-right">Disponível</th><th class="px-4 py-2 text-right">Dá para montar</th><th class="px-4 py-2 text-right">Custo (PEPS)</th></tr></thead>
          <tbody>
            <tr v-for="c in p.erp_stock?.parts ?? []" :key="c.sku" class="border-b border-line">
              <td class="px-4 py-2 font-mono">{{ c.sku }}</td><td class="px-4 py-2">{{ c.name ?? (c.found ? '' : 'não está ativo no ERP') }}</td>
              <td class="px-4 py-2 text-right">{{ qty(c.quantity) }}</td><td class="px-4 py-2 text-right">{{ qty(c.available) }}</td>
              <td class="px-4 py-2 text-right font-semibold">{{ qty(c.kits) }}</td><td class="px-4 py-2 text-right">{{ c.cost !== null ? brl(c.cost) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- variações -->
      <section v-if="p.kind === 'variations'" class="card overflow-hidden" data-test="ficha-variacoes">
        <div class="px-5 pt-4"><h2 class="section-title">Variações ({{ p.variations.length }})</h2><p class="text-[13px] text-ink-3">Tipos de variação: {{ p.variation_axes.join(', ') || '—' }}. Variação que é kit: estoque do componente que acaba primeiro.</p></div>
        <table class="mt-3 w-full text-[13px]">
          <thead>
            <tr class="border-b border-line text-left text-ink-2">
              <th v-for="ax in p.variation_axes" :key="ax" class="px-4 py-2">{{ ax }}</th>
              <th class="px-4 py-2">SKU</th><th class="px-4 py-2">GTIN</th><th class="px-4 py-2 text-right">Preço</th>
              <th class="px-4 py-2 text-right">Estoque</th><th class="px-4 py-2 text-right">Estoque no ERP</th><th class="px-4 py-2 text-right">Custo (PEPS)</th><th class="px-4 py-2">Fotos</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in p.variations" :key="v.key" class="border-b border-line align-top">
              <td v-for="ax in p.variation_axes" :key="ax" class="px-4 py-2 font-semibold">{{ v.attrs[ax] || '—' }}</td>
              <td class="px-4 py-2 font-mono">{{ v.sku }}<span v-if="v.kit" class="pill-primary ml-1 !py-0">kit</span>
                <span v-if="v.kit" class="mt-1 block text-[12px] text-ink-3">{{ (stockOf(v.key)?.parts ?? []).map((c) => `${qty(c.quantity)}× ${c.sku} (${qty(c.available)} disp.)`).join(' + ') }}</span>
              </td>
              <td class="px-4 py-2">{{ v.gtin || '—' }}</td>
              <td class="px-4 py-2 text-right">{{ v.price !== null ? brl(Number(v.price)) : '—' }}</td>
              <td class="px-4 py-2 text-right font-semibold" :title="v.kit && limiting(stockOf(v.key)) ? `limitado por ${limiting(stockOf(v.key))?.sku}` : ''">{{ qty(stockOf(v.key)?.stock) }}</td>
              <td class="px-4 py-2 text-right text-ink-3">{{ qty(v.stock) }}</td>
              <td class="px-4 py-2 text-right">{{ stockOf(v.key)?.cost !== null && stockOf(v.key)?.cost !== undefined ? brl(stockOf(v.key)!.cost!) : '—' }}</td>
              <td class="px-4 py-2">
                <div class="flex gap-1">
                  <img v-for="a in variationPhotos(v.key).slice(0, 4)" :key="a.id" :src="thumbs[a.id]" alt="" class="h-9 w-9 rounded border border-line object-contain" />
                  <span v-if="variationPhotos(v.key).length > 4" class="self-center text-[12px] text-ink-3">+{{ variationPhotos(v.key).length - 4 }}</span>
                  <span v-if="!variationPhotos(v.key).length" class="text-ink-3">as do produto</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- cadastro -->
      <section class="card p-5" data-test="ficha-dados">
        <h2 class="section-title mb-3">Dados do cadastro</h2>
        <dl class="grid gap-x-8 gap-y-3 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="[label, value] in facts" :key="label"><dt class="text-[13px] text-ink-3">{{ label }}</dt><dd class="break-words text-ink">{{ value ?? '—' }}</dd></div>
        </dl>
      </section>

      <section class="card p-5" data-test="ficha-descricao">
        <h2 class="section-title mb-3">Descrição</h2>
        <p v-if="p.description" class="whitespace-pre-line text-[14px] leading-relaxed text-ink">{{ descriptionText }}</p>
        <p v-else class="text-[14px] text-ink-3">Sem descrição no ERP.</p>
      </section>

      <section v-if="extras.length" class="card p-5">
        <h2 class="section-title mb-3">Outros dados do ERP</h2>
        <dl class="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2"><div v-for="[label, value] in extras" :key="label"><dt class="text-ink-3">{{ label }}</dt><dd class="break-words font-mono text-ink-2">{{ value }}</dd></div></dl>
      </section>
    </template>

    <!-- foto ampliada -->
    <div v-if="big !== null" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-label="Foto ampliada" @click="big = null">
      <img :src="thumbs[big]" alt="Foto ampliada" class="max-h-full max-w-full rounded-panel bg-white object-contain" />
    </div>
  </div>
</template>
