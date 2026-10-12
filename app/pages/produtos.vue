<script setup lang="ts">
import { ArrowPathIcon, ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { ref, watchEffect } from 'vue'
import { useOlistProducts } from '../composables/useOlistProducts'
import { usePageHeader } from '../composables/usePageHeader'
import { brl, dateTimeShort, int } from '../lib/format'
import { KIND_LABEL, STATUS_LABEL, VARIATION_LABEL, formatQty, toNumber, type OlistProduct } from '../lib/olistClient'

/**
 * `/produtos` — produtos cadastrados no Olist ERP, guardados no banco do Lunna
 * (atualizados a cada 3 min; "Atualizar agora" força na hora). Somente leitura
 * por enquanto: preço e estoque ainda não são editados por aqui.
 */
const header = usePageHeader()
const olist = useOlistProducts()

watchEffect(() => {
  header.state.title = 'Produtos'
  header.state.subtitle = 'Olist ERP'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = olist.syncing.value
  header.state.onRefresh = olist.connected.value ? olist.refreshNow : null
})

const expanded = ref<number | null>(null)
const toggle = (id: number) => { expanded.value = expanded.value === id ? null : id }

const STATUS_PILL: Record<string, string> = { A: 'pill-success', I: 'pill-neutral', E: 'pill-danger' }
const money = (v: OlistProduct['price']) => brl(toNumber(v))
const hasValue = (v: OlistProduct['price']) => (toNumber(v) ?? 0) > 0
</script>

<template>
  <div class="page space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="page-title">Produtos</h1>
        <p class="page-subtitle max-w-2xl">Produtos cadastrados no Olist ERP, com preços, custo e estoque.</p>
        <p v-if="olist.connected.value" class="mt-2 text-[13px] text-ink-2" data-test="produtos-sync" role="status">
          <template v-if="olist.syncing.value">Atualizando agora…</template>
          <template v-else-if="olist.lastSyncedAt.value">
            Atualizado às {{ dateTimeShort(olist.lastSyncedAt.value) }} · automático a cada 3 minutos
          </template>
          <template v-else>Ainda sem sincronização.</template>
        </p>
      </div>
      <button
        v-if="olist.connected.value"
        type="button"
        class="btn-secondary shrink-0"
        data-test="atualizar-produtos"
        :disabled="olist.syncing.value"
        @click="olist.refreshNow()"
      >
        <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': olist.syncing.value }" aria-hidden="true" />
        Atualizar agora
      </button>
    </header>

    <div v-if="olist.olist.value && !olist.connected.value" class="card p-8 text-center" data-test="olist-desconectado">
      <p class="text-[15px] font-semibold text-ink">O Olist ERP ainda não está conectado.</p>
      <p class="mt-1 text-[13px] text-ink-3">
        {{ olist.olist.value.status === 'reauth_required' ? 'A conexão expirou e precisa ser refeita por um administrador.' : 'Peça a um administrador para conectar a conta do Olist.' }}
      </p>
    </div>

    <template v-else-if="olist.olist.value">
      <div class="card flex flex-wrap items-center gap-3 p-3">
        <div class="relative min-w-[240px] flex-1">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            v-model="olist.q.value"
            type="search"
            class="input pl-9"
            placeholder="Buscar por nome, SKU ou GTIN"
            aria-label="Buscar produtos"
            data-test="produtos-busca"
          />
        </div>
        <select v-model="olist.status.value" class="input w-auto" aria-label="Situação" data-test="produtos-situacao">
          <option value="">Todas as situações</option>
          <option value="A">Ativos</option>
          <option value="I">Inativos</option>
          <option value="E">Excluídos</option>
        </select>
        <span class="text-[13px] text-ink-3" data-test="produtos-total">{{ int(olist.total.value) }} produtos</span>
      </div>

      <div v-if="olist.error.value" class="card p-6 text-center" role="alert">
        <p class="text-[15px] text-danger">{{ olist.error.value }}</p>
      </div>

      <div v-else class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1100px] border-collapse text-[13px]">
            <thead class="bg-surface-2">
              <tr class="border-b border-line text-left text-ink-2">
                <th scope="col" class="w-8 px-2 py-2"><span class="sr-only">Detalhes</span></th>
                <th scope="col" class="px-3 py-2 font-semibold">SKU</th>
                <th scope="col" class="px-3 py-2 font-semibold">Produto</th>
                <th scope="col" class="px-3 py-2 font-semibold">Situação</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Preço</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Promocional</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Custo</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Estoque</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Reservado</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Disponível</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="olist.loading.value">
                <td colspan="10" class="px-3 py-10 text-center text-ink-3" role="status">Carregando produtos…</td>
              </tr>
              <tr v-else-if="!olist.products.value.length">
                <td colspan="10" class="px-3 py-10 text-center text-ink-3">
                  {{ olist.q.value || olist.status.value ? 'Nenhum produto com esses filtros.' : 'Nenhum produto sincronizado ainda. Clique em “Atualizar agora”.' }}
                </td>
              </tr>
              <template v-for="p in olist.products.value" v-else :key="p.id">
                <tr class="cursor-pointer border-b border-line align-top hover:bg-surface-2" data-test="produto-linha" @click="toggle(p.id)">
                  <td class="px-2 py-2 text-ink-3">
                    <component :is="expanded === p.id ? ChevronDownIcon : ChevronRightIcon" class="h-4 w-4" aria-hidden="true" />
                  </td>
                  <td class="whitespace-nowrap px-3 py-2 font-mono text-[12px]">{{ p.sku || '—' }}</td>
                  <td class="max-w-[420px] px-3 py-2 font-semibold text-ink">{{ p.description }}</td>
                  <td class="px-3 py-2">
                    <span :class="STATUS_PILL[p.status ?? ''] ?? 'pill-neutral'">{{ STATUS_LABEL[p.status ?? ''] ?? '—' }}</span>
                  </td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ money(p.price) }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ hasValue(p.promo_price) ? money(p.promo_price) : '—' }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ hasValue(p.cost_price) ? money(p.cost_price) : '—' }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ formatQty(p.stock.balance) }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">{{ formatQty(p.stock.reserved) }}</td>
                  <td
                    class="whitespace-nowrap px-3 py-2 text-right tabular-nums"
                    :class="(toNumber(p.stock.available) ?? 0) < 0 ? 'font-semibold text-danger' : ''"
                  >
                    {{ formatQty(p.stock.available) }}
                  </td>
                </tr>
                <tr v-if="expanded === p.id" class="border-b border-line bg-surface-2" data-test="produto-detalhe">
                  <td colspan="10" class="px-6 py-4">
                    <dl class="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt class="text-ink-3">ID no Olist</dt><dd class="font-mono">{{ p.id }}</dd></div>
                      <div><dt class="text-ink-3">GTIN / EAN</dt><dd>{{ p.gtin || '—' }}</dd></div>
                      <div><dt class="text-ink-3">Tipo</dt><dd>{{ KIND_LABEL[p.kind ?? ''] ?? '—' }}</dd></div>
                      <div><dt class="text-ink-3">Variação</dt><dd>{{ VARIATION_LABEL[p.variation_kind ?? ''] ?? '—' }}</dd></div>
                      <div><dt class="text-ink-3">Unidade</dt><dd>{{ p.unit || '—' }}</dd></div>
                      <div><dt class="text-ink-3">Localização no estoque</dt><dd>{{ p.stock.location || '—' }}</dd></div>
                      <div><dt class="text-ink-3">Custo médio</dt><dd>{{ hasValue(p.avg_cost_price) ? money(p.avg_cost_price) : '—' }}</dd></div>
                      <div><dt class="text-ink-3">Cadastrado no Olist</dt><dd>{{ dateTimeShort(p.olist_created_at) }}</dd></div>
                      <div><dt class="text-ink-3">Alterado no Olist</dt><dd>{{ dateTimeShort(p.olist_updated_at) }}</dd></div>
                      <div><dt class="text-ink-3">Lido pelo Lunna</dt><dd>{{ dateTimeShort(p.synced_at) }}</dd></div>
                    </dl>
                    <div v-if="p.stock.deposits.length" class="mt-4">
                      <p class="mb-1 text-[12px] font-semibold text-ink-2">Estoque por depósito</p>
                      <table class="w-full max-w-xl border-collapse text-[12px]">
                        <thead>
                          <tr class="border-b border-line text-left text-ink-3">
                            <th class="py-1 pr-3 font-medium">Depósito</th>
                            <th class="px-3 py-1 text-right font-medium">Saldo</th>
                            <th class="px-3 py-1 text-right font-medium">Reservado</th>
                            <th class="py-1 pl-3 text-right font-medium">Disponível</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="d in p.stock.deposits" :key="d.id" class="border-b border-line">
                            <td class="py-1 pr-3">
                              {{ d.nome }}
                              <span v-if="d.desconsiderar" class="pill-neutral ml-1" title="Este depósito não entra no saldo total">fora do saldo</span>
                            </td>
                            <td class="px-3 py-1 text-right tabular-nums">{{ formatQty(d.saldo) }}</td>
                            <td class="px-3 py-1 text-right tabular-nums">{{ formatQty(d.reservado) }}</td>
                            <td class="py-1 pl-3 text-right tabular-nums">{{ formatQty(d.disponivel) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="olist.pages.value > 1" class="flex items-center justify-center gap-3">
        <button type="button" class="btn-secondary" :disabled="olist.page.value === 0" @click="olist.goTo(olist.page.value - 1)">← Anteriores</button>
        <span class="text-[13px] text-ink-3">Página {{ olist.page.value + 1 }} de {{ int(olist.pages.value) }}</span>
        <button type="button" class="btn-secondary" :disabled="olist.page.value >= olist.pages.value - 1" @click="olist.goTo(olist.page.value + 1)">Próximos →</button>
      </div>
    </template>

    <div v-else-if="olist.error.value" class="card p-6 text-center text-danger" role="alert">{{ olist.error.value }}</div>
    <div v-else class="card p-10 text-center text-ink-3" role="status">Carregando…</div>
  </div>
</template>
