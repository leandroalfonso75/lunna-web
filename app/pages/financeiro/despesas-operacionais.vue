<script setup lang="ts">
import { ArrowLeftIcon, DocumentDuplicateIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, reactive, ref, watchEffect } from 'vue'
import PageHeader from '../../components/painel/PageHeader.vue'
import { usePageHeader } from '../../composables/usePageHeader'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import { brl, num } from '../../lib/format'
import { useSessionStore } from '../../stores/session'
import type { FixedExpense, FixedExpenseMonth, FixedExpensesResponse } from '../../types/finance'

/**
 * `/financeiro/despesas-operacionais` (pedido do usuário em 11/11/2026): despesas operacionais lançadas por mês (aluguel, salários,
 * FGTS, INSS...). A cada inclusão a lista é relida. No fim, o comparativo Faturamento x Despesas Operacionais: o percentual do
 * mês passa a valer nas despesas operacionais das vendas daquele mês (Vendas e DRE) depois que o mês fecha; o mês corrente
 * segue o padrão de Configurações › Empresa. Regra e contas na API (Painel::FixedExpenseRate); aqui só exibimos.
 */
const { $api } = useNuxtApp()
const session = useSessionStore()
const header = usePageHeader()
const toast = useToast()

const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).slice(0, 7)
/** Abre no mês anterior: é o último mês fechado, o que já pode ser apurado. */
function previousMonth(key: string) {
  const [y, m] = key.split('-').map(Number) as [number, number]
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}
const month = ref(previousMonth(currentMonth))
const data = ref<FixedExpensesResponse | null>(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const editing = ref<number | null>(null)
const confirmDelete = ref<number | null>(null)
const form = reactive({ category: '', description: '', amount: '' })

const monthLabel = (key: string) => `${key.slice(5, 7)}/${key.slice(0, 4)}`
/** Últimos 13 meses, do atual para trás. */
const monthOptions = computed(() => {
  const out: string[] = []
  let key = currentMonth
  for (let i = 0; i < 13; i += 1) {
    out.push(key)
    key = previousMonth(key)
  }
  if (!out.includes(month.value)) out.push(month.value)
  return out
})
const total = computed(() => data.value?.entries.reduce((s, e) => s + e.amount, 0) ?? 0)

async function load() {
  loading.value = true
  try {
    data.value = await $api<FixedExpensesResponse>('/api/finance/fixed_expenses', { query: { month: month.value } })
    error.value = ''
    if (!form.category) form.category = data.value.categories[0] ?? ''
  } catch (err) {
    error.value = apiErrorMessage(err, 'Não foi possível carregar as despesas operacionais.')
  } finally {
    loading.value = false
  }
}
function selectMonth(key: string) {
  month.value = key
  cancelEdit()
  void load()
}
function cancelEdit() {
  editing.value = null
  Object.assign(form, { description: '', amount: '' })
}
function startEdit(e: FixedExpense) {
  editing.value = e.id
  Object.assign(form, { category: e.category, description: e.description ?? '', amount: String(e.amount).replace('.', ',') })
}
async function save() {
  const amount = Number(form.amount.replace(/\./g, '').replace(',', '.'))
  if (!form.category || !(amount > 0)) {
    toast.error('Escolha a despesa e informe um valor maior que zero.')
    return
  }
  saving.value = true
  try {
    const body = { month: month.value, category: form.category, description: form.description.trim() || null, amount }
    if (editing.value) await $api(`/api/finance/fixed_expenses/${editing.value}`, { method: 'PATCH', body })
    else await $api('/api/finance/fixed_expenses', { method: 'POST', body })
    toast.success(editing.value ? 'Despesa alterada.' : 'Despesa incluída.')
    cancelEdit()
    await load()
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível salvar a despesa.'))
  } finally {
    saving.value = false
  }
}
async function remove(id: number) {
  if (confirmDelete.value !== id) {
    confirmDelete.value = id
    return
  }
  try {
    await $api(`/api/finance/fixed_expenses/${id}`, { method: 'DELETE' })
    toast.success('Despesa excluída.')
    await load()
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível excluir.'))
  } finally {
    confirmDelete.value = null
  }
}
async function copyPrevious() {
  try {
    const res = await $api<{ copied: number }>('/api/finance/fixed_expenses/copy', { method: 'POST', body: { month: month.value } })
    toast.success(`${res.copied} despesa(s) copiada(s) de ${monthLabel(previousMonth(month.value))}.`)
    await load()
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível copiar do mês anterior.'))
  }
}

/** Explicação do comparativo, conforme a situação do mês. */
function stateText(s: FixedExpenseMonth) {
  const def = `${num(s.default_pct, 2)}%`
  if (s.state === 'aplicado') return `Mês fechado: todas as vendas de ${monthLabel(s.month)} usam ${num(s.applied_pct, 2)}% de despesas operacionais (no lugar do padrão de ${def}), em Vendas e no DRE.`
  if (s.state === 'mes_corrente') return `Mês em andamento: as vendas de ${monthLabel(s.month)} seguem com o padrão de ${def} (Configurações › Empresa). O percentual lançado passa a valer quando o mês fechar.`
  if (s.state === 'sem_faturamento') return `Não há faturamento em ${monthLabel(s.month)}; as vendas seguem com o padrão de ${def}.`
  return `Sem despesas lançadas em ${monthLabel(s.month)}: as vendas usam o padrão de ${def} (Configurações › Empresa).`
}
const STATE_LABEL: Record<FixedExpenseMonth['state'], { label: string; tone: string }> = {
  aplicado: { label: 'Valendo nas vendas', tone: 'bg-success-soft text-success' },
  mes_corrente: { label: 'Mês em andamento', tone: 'bg-warning-soft text-warning' },
  sem_faturamento: { label: 'Sem faturamento', tone: 'bg-surface-2 text-ink-2' },
  sem_lancamentos: { label: 'Padrão da empresa', tone: 'bg-surface-2 text-ink-2' }
}

onMounted(() => void load())
watchEffect(() => {
  header.state.title = 'Despesas Operacionais mensais'
  header.state.subtitle = 'Financeiro › Despesas'
  header.state.sync = null
  header.state.generatedAt = null
  header.state.refreshing = loading.value
  header.state.onRefresh = () => void load()
})
</script>

<template>
  <div class="page space-y-5" data-test="despesas-operacionais">
    <PageHeader />
    <NuxtLink to="/financeiro?tab=despesas" class="btn-link inline-flex items-center gap-1 text-[13px]"><ArrowLeftIcon class="h-4 w-4" aria-hidden="true" /> Voltar para Financeiro › Despesas</NuxtLink>

    <div class="card flex flex-wrap items-end gap-3 p-4">
      <label class="text-[13px]"><span class="field-label">Mês das despesas</span>
        <select class="input h-9 w-40" :value="month" data-test="mes" @change="selectMonth(($event.target as HTMLSelectElement).value)">
          <option v-for="m in monthOptions" :key="m" :value="m">{{ monthLabel(m) }}{{ m === currentMonth ? ' (atual)' : '' }}</option>
        </select>
      </label>
      <p class="max-w-[720px] text-[12px] text-ink-3">
        Lance aqui as despesas operacionais do mês (aluguel, salários, FGTS, INSS, bonificações, transporte, material de expediente e outras).
        O total sobre o faturamento do mês vira o percentual de despesas operacionais de cada venda daquele mês.
      </p>
    </div>

    <p v-if="error" class="text-[13px] text-danger" role="alert">{{ error }}</p>

    <template v-if="data">
      <form v-if="session.isAdmin" class="card grid gap-2 p-4 text-[13px] md:grid-cols-6" data-test="form-despesa" @submit.prevent="save">
        <h2 class="section-title md:col-span-6">{{ editing ? 'Alterar despesa' : 'Incluir despesa' }} de {{ monthLabel(month) }}</h2>
        <label class="md:col-span-2"><span class="field-label">Despesa</span>
          <select v-model="form.category" class="input h-9"><option v-for="c in data.categories" :key="c" :value="c">{{ c }}</option></select>
        </label>
        <label class="md:col-span-2"><span class="field-label">Descrição (opcional)</span><input v-model="form.description" type="text" class="input h-9" maxlength="120" placeholder="Ex.: galpão, 2 funcionários" /></label>
        <label><span class="field-label">Valor (R$)</span><input v-model="form.amount" type="text" inputmode="decimal" class="input h-9" placeholder="0,00" required data-test="valor" /></label>
        <div class="flex items-end gap-2">
          <button type="submit" class="btn-primary h-9" :disabled="saving" data-test="incluir-despesa-fixa"><PlusIcon v-if="!editing" class="h-4 w-4" aria-hidden="true" /> {{ saving ? 'Salvando…' : editing ? 'Salvar' : 'Incluir' }}</button>
          <button v-if="editing" type="button" class="btn-link" :disabled="saving" @click="cancelEdit">Cancelar</button>
        </div>
      </form>

      <div class="card p-4" data-test="lista-despesas-operacionais">
        <div class="mb-2 flex flex-wrap items-center gap-3">
          <h2 class="section-title">Despesas Operacionais de {{ monthLabel(month) }}</h2>
          <span class="text-[12px] text-ink-3">{{ data.entries.length }} lançamento(s) · total <strong class="text-ink" data-numeric>{{ brl(total) }}</strong></span>
          <button v-if="session.isAdmin && !data.entries.length" type="button" class="btn-secondary ml-auto h-8 text-[12px]" data-test="copiar-mes" @click="copyPrevious">
            <DocumentDuplicateIcon class="h-4 w-4" aria-hidden="true" /> Copiar de {{ monthLabel(previousMonth(month)) }}
          </button>
        </div>
        <p v-if="!data.entries.length" class="text-[13px] text-ink-3">Nenhuma despesa operacional lançada neste mês.</p>
        <table v-else class="w-full text-[13px]">
          <thead><tr class="border-b border-line text-ink-2"><th class="py-1 text-left font-semibold">Despesa</th><th class="py-1 text-left font-semibold">Descrição</th><th class="py-1 text-right font-semibold">Valor</th><th class="py-1 text-right font-semibold">% do total</th><th v-if="session.isAdmin" class="w-44 py-1" /></tr></thead>
          <tbody>
            <tr v-for="e in data.entries" :key="e.id" class="border-b border-line" data-test="despesa-fixa">
              <td class="py-1.5 text-ink">{{ e.category }}</td>
              <td class="py-1.5 text-ink-2">{{ e.description ?? '—' }}</td>
              <td class="py-1.5 text-right" data-numeric>{{ brl(e.amount) }}</td>
              <td class="py-1.5 text-right text-ink-3" data-numeric>{{ total ? num((e.amount / total) * 100, 1) : '0,0' }}%</td>
              <td v-if="session.isAdmin" class="py-1.5 text-right">
                <button type="button" class="btn-link" @click="startEdit(e)">Alterar</button>
                <button type="button" class="btn-link ml-2" :class="confirmDelete === e.id ? 'text-danger' : ''" @click="remove(e.id)">{{ confirmDelete === e.id ? 'Confirmar exclusão' : 'Excluir' }}</button>
              </td>
            </tr>
            <tr class="font-semibold"><td class="py-1.5 text-ink" colspan="2">Total</td><td class="py-1.5 text-right" data-numeric>{{ brl(total) }}</td><td class="py-1.5 text-right" data-numeric>100%</td><td v-if="session.isAdmin" /></tr>
          </tbody>
        </table>
      </div>

      <div class="card p-4" data-test="comparativo">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <h2 class="section-title">Faturamento x Despesas Operacionais · {{ monthLabel(data.summary.month) }}</h2>
          <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="STATE_LABEL[data.summary.state].tone">{{ STATE_LABEL[data.summary.state].label }}</span>
        </div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div class="rounded-card border border-line p-3">
            <p class="text-[12px] font-medium text-ink-2">Faturamento do mês</p>
            <p class="mt-1 text-[20px] font-semibold text-ink" data-numeric>{{ brl(data.summary.revenue) }}</p>
            <p class="text-[11px] text-ink-3">vendas não canceladas, pela data da venda</p>
          </div>
          <div class="rounded-card border border-line p-3">
            <p class="text-[12px] font-medium text-ink-2">Despesas Operacionais do mês</p>
            <p class="mt-1 text-[20px] font-semibold text-danger" data-numeric>{{ brl(data.summary.total) }}</p>
            <p class="text-[11px] text-ink-3">soma dos lançamentos acima</p>
          </div>
          <div class="rounded-card border border-line p-3">
            <p class="text-[12px] font-medium text-ink-2">Despesas Operacionais ÷ faturamento</p>
            <p class="mt-1 text-[20px] font-semibold text-ink" data-numeric data-test="percentual">{{ data.summary.pct === null ? '—' : `${num(data.summary.pct, 2)}%` }}</p>
            <p class="text-[11px] text-ink-3">padrão da empresa: {{ num(data.summary.default_pct, 2) }}%</p>
          </div>
        </div>
        <div v-if="data.summary.revenue > 0" class="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div class="h-full bg-danger" :style="{ width: `${Math.min(data.summary.pct ?? 0, 100)}%` }" />
        </div>
        <p class="mt-3 text-[13px] text-ink">{{ stateText(data.summary) }}</p>
      </div>

      <div v-if="data.months.length" class="card p-4" data-test="meses-lancados">
        <h2 class="section-title mb-2">Meses com despesas lançadas</h2>
        <table class="w-full text-[13px]">
          <thead><tr class="border-b border-line text-ink-2"><th class="py-1 text-left font-semibold">Mês</th><th class="py-1 text-right font-semibold">Faturamento</th><th class="py-1 text-right font-semibold">Despesas Operacionais</th><th class="py-1 text-right font-semibold">%</th><th class="py-1 text-right font-semibold">Usado nas vendas</th><th class="py-1 text-left font-semibold pl-3">Situação</th></tr></thead>
          <tbody>
            <tr v-for="m in data.months" :key="m.month" class="border-b border-line">
              <td class="py-1.5"><button type="button" class="btn-link" @click="selectMonth(m.month)">{{ monthLabel(m.month) }}</button></td>
              <td class="py-1.5 text-right" data-numeric>{{ brl(m.revenue) }}</td>
              <td class="py-1.5 text-right" data-numeric>{{ brl(m.total) }}</td>
              <td class="py-1.5 text-right" data-numeric>{{ m.pct === null ? '—' : `${num(m.pct, 2)}%` }}</td>
              <td class="py-1.5 text-right font-semibold" data-numeric>{{ num(m.applied_pct, 2) }}%</td>
              <td class="py-1.5 pl-3"><span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="STATE_LABEL[m.state].tone">{{ STATE_LABEL[m.state].label }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
