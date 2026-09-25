<script setup lang="ts">
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted, reactive, ref } from 'vue'
import { useToast } from '../../composables/useToast'
import { apiErrorMessage } from '../../lib/apiErrors'
import type { SettingsClient } from '../../lib/settingsClient'
import { useSessionStore } from '../../stores/session'
import type { Company, CompanyUpdatePayload } from '../../types/api'
import SettingsSkeleton from './SettingsSkeleton.vue'

/**
 * Ruling P4-7 (mesma convenção do timeia): o componente recebe o client já
 * construído via prop — nunca importa `lib/apiClient`/`lib/authClient`
 * direto (a página, `configuracoes/index.vue`, é quem chama `useSettings()`).
 */
const props = defineProps<{ settingsApi: SettingsClient }>()
const toast = useToast()
const session = useSessionStore()

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')

const form = reactive({
  name: '',
  tax_pct: '',
  min_margin_pct: '',
  abc_cut_a: '',
  abc_cut_b: '',
  group_up_pct: '',
  group_down_pct: '',
  ai_model: ''
})

/** Snapshot do form logo após carregar/salvar — base da comparação de "há alterações". */
const savedSnapshot = ref('')
/** `ai_model` salvo — só entra no PATCH quando o campo muda (DECISOES.md §10). */
const savedAiModel = ref('')

// --- IA via OpenRouter (DECISOES.md §10) ------------------------------------
// A chave digitada nunca fica no form reativo persistido/comparado — só em
// `apiKeyInput`, sempre limpo depois de carregar/salvar/remover.
const apiKeyInput = ref('')
const showApiKey = ref(false)
const aiConfigured = ref(false)
const aiKeyHint = ref<string | null>(null)
const confirmingRemoveKey = ref(false)
const removingKey = ref(false)

function fillForm(c: Company) {
  form.name = c.name
  form.tax_pct = String(c.tax_pct)
  form.min_margin_pct = String(c.min_margin_pct)
  form.abc_cut_a = String(c.abc_cut_a)
  form.abc_cut_b = String(c.abc_cut_b)
  form.group_up_pct = String(c.group_up_pct)
  form.group_down_pct = String(c.group_down_pct)
  form.ai_model = c.ai_model ?? ''
  savedAiModel.value = form.ai_model
  aiConfigured.value = c.ai_configured
  aiKeyHint.value = c.ai_key_hint
  apiKeyInput.value = ''
  confirmingRemoveKey.value = false
  savedSnapshot.value = JSON.stringify(form)
}

// A chave digitada conta como alteração mesmo sem mexer em mais nada.
const isDirty = computed(() => JSON.stringify(form) !== savedSnapshot.value || apiKeyInput.value.length > 0)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { company } = await props.settingsApi.getCompany()
    fillForm(company)
  } catch {
    loadError.value = 'Não foi possível carregar os dados da empresa agora. Tente de novo.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** Aceita "12,3" ou "12.3" — a API espera um número. */
function parseDecimal(value: string): number {
  return Number(value.replace(',', '.'))
}

async function submit() {
  saveError.value = ''
  saving.value = true
  try {
    const payload: CompanyUpdatePayload = {
      name: form.name,
      tax_pct: parseDecimal(form.tax_pct),
      min_margin_pct: parseDecimal(form.min_margin_pct),
      abc_cut_a: parseDecimal(form.abc_cut_a),
      abc_cut_b: parseDecimal(form.abc_cut_b),
      group_up_pct: parseDecimal(form.group_up_pct),
      group_down_pct: parseDecimal(form.group_down_pct)
    }
    if (form.ai_model !== savedAiModel.value) payload.ai_model = form.ai_model || null
    if (apiKeyInput.value) payload.openrouter_api_key = apiKeyInput.value

    const { company } = await props.settingsApi.updateCompany(payload)
    fillForm(company)
    session.setCompany(company)
    toast.success('Empresa atualizada.')
  } catch (err) {
    saveError.value = apiErrorMessage(err, 'Não foi possível salvar agora. Tente de novo.')
  } finally {
    saving.value = false
  }
}

/** Botão "Remover chave" — confirmação inline própria, fora do Salvar (mesmo padrão de ContasTab). */
async function removeKey() {
  removingKey.value = true
  try {
    const { company } = await props.settingsApi.updateCompany({ remove_openrouter_api_key: true })
    fillForm(company)
    session.setCompany(company)
    toast.success('Chave da OpenRouter removida.')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Não foi possível remover a chave agora. Tente de novo.'))
  } finally {
    removingKey.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <SettingsSkeleton v-if="loading" :rows="1" />

    <div v-else-if="loadError" class="card p-6 text-center" role="alert">
      <p class="text-[15px] text-danger">{{ loadError }}</p>
      <button type="button" class="btn-link mt-3" @click="load">Tentar de novo</button>
    </div>

    <form v-else class="card space-y-8 p-6" @submit.prevent="submit">
      <div class="space-y-4">
        <div>
          <h3 class="section-title">Dados da empresa</h3>
          <p class="page-subtitle text-[13px]">Nome exibido no painel e nos convites de equipe.</p>
        </div>
        <div class="space-y-1.5">
          <label for="empresa-nome" class="field-label">Nome</label>
          <input id="empresa-nome" v-model="form.name" type="text" required class="input" />
        </div>
      </div>

      <div class="space-y-4 border-t border-line pt-6">
        <div>
          <h3 class="section-title">Impostos e margem</h3>
          <p class="page-subtitle text-[13px]">Usados no cálculo de lucro e nos alertas de margem baixa.</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label for="tax-pct" class="field-label">Imposto</label>
            <div class="relative">
              <input id="tax-pct" v-model="form.tax_pct" type="text" inputmode="decimal" class="input pr-8" />
              <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-ink-3">%</span>
            </div>
            <p class="text-[13px] text-ink-3">Percentual de imposto descontado do preço de venda no cálculo de lucro.</p>
          </div>
          <div class="space-y-1.5">
            <label for="min-margin-pct" class="field-label">Margem mínima</label>
            <div class="relative">
              <input id="min-margin-pct" v-model="form.min_margin_pct" type="text" inputmode="decimal" class="input pr-8" />
              <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-ink-3">%</span>
            </div>
            <p class="text-[13px] text-ink-3">Anúncios abaixo desta margem aparecem como alerta no painel.</p>
          </div>
        </div>
      </div>

      <div class="space-y-4 border-t border-line pt-6">
        <div>
          <h3 class="section-title">Curva ABC</h3>
          <p class="page-subtitle text-[13px]">Cortes de receita acumulada que dividem os anúncios em A, B e C.</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label for="abc-cut-a" class="field-label">Corte curva A</label>
            <div class="relative">
              <input id="abc-cut-a" v-model="form.abc_cut_a" type="text" inputmode="decimal" class="input pr-8" />
              <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-ink-3">%</span>
            </div>
            <p class="text-[13px] text-ink-3">Percentual acumulado de receita que define o fim da curva A.</p>
          </div>
          <div class="space-y-1.5">
            <label for="abc-cut-b" class="field-label">Corte curva B</label>
            <div class="relative">
              <input id="abc-cut-b" v-model="form.abc_cut_b" type="text" inputmode="decimal" class="input pr-8" />
              <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-ink-3">%</span>
            </div>
            <p class="text-[13px] text-ink-3">Percentual acumulado de receita que define o fim da curva B (o resto vira C).</p>
          </div>
        </div>
      </div>

      <div class="space-y-4 border-t border-line pt-6">
        <div>
          <h3 class="section-title">Grupos da curva A</h3>
          <p class="page-subtitle text-[13px]">Limites de crescimento de vendas que classificam os anúncios da curva A.</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label for="group-up-pct" class="field-label">Limite "Vendendo"</label>
            <div class="relative">
              <input id="group-up-pct" v-model="form.group_up_pct" type="text" inputmode="decimal" class="input pr-8" />
              <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-ink-3">%</span>
            </div>
            <p class="text-[13px] text-ink-3">Acima deste crescimento, o anúncio é classificado como "Vendendo".</p>
          </div>
          <div class="space-y-1.5">
            <label for="group-down-pct" class="field-label">Limite "Em queda"</label>
            <div class="relative">
              <input id="group-down-pct" v-model="form.group_down_pct" type="text" inputmode="decimal" class="input pr-8" />
              <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-ink-3">%</span>
            </div>
            <p class="text-[13px] text-ink-3">Abaixo deste crescimento, o anúncio é classificado como "Em queda".</p>
          </div>
        </div>
      </div>

      <div class="space-y-4 border-t border-line pt-6">
        <div>
          <h3 class="section-title">Inteligência artificial (OpenRouter)</h3>
          <p class="page-subtitle text-[13px]">
            O plano de ação com IA usa a conta OpenRouter da empresa — o custo de cada geração é cobrado lá.
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" class="btn-link">Gerar chave</a>
            ·
            <a href="https://openrouter.ai/models" target="_blank" rel="noopener" class="btn-link">Ver modelos</a>
          </p>
        </div>

        <div>
          <span v-if="aiConfigured" data-test="ai-status" class="pill-success">Configurada{{ aiKeyHint ? ` (chave ${aiKeyHint})` : '' }}</span>
          <span v-else data-test="ai-status" class="pill-neutral">Não configurada</span>
        </div>

        <div class="space-y-1.5">
          <label for="ai-api-key" class="field-label">Chave da API</label>
          <div class="relative">
            <input
              id="ai-api-key"
              v-model="apiKeyInput"
              :type="showApiKey ? 'text' : 'password'"
              autocomplete="off"
              :placeholder="aiConfigured ? 'Deixe em branco para manter a chave atual' : 'sk-or-…'"
              class="input pr-11"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 hover:text-ink"
              :aria-pressed="showApiKey"
              :aria-label="showApiKey ? 'Ocultar chave' : 'Mostrar chave'"
              @click="showApiKey = !showApiKey"
            >
              <component :is="showApiKey ? EyeSlashIcon : EyeIcon" class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <label for="ai-model" class="field-label">Modelo</label>
          <input id="ai-model" v-model="form.ai_model" type="text" placeholder="anthropic/claude-sonnet-4.5" class="input" />
          <p class="text-[13px] text-ink-3">Use o identificador da página de modelos da OpenRouter (fornecedor/modelo).</p>
        </div>

        <div v-if="aiConfigured">
          <button
            v-if="!confirmingRemoveKey"
            type="button"
            data-test="remover-chave-ai"
            class="text-[13px] font-semibold text-danger hover:underline"
            @click="confirmingRemoveKey = true"
          >
            Remover chave
          </button>
          <div v-else class="flex flex-wrap items-center gap-3">
            <span class="text-[15px] text-ink">Remover a chave? O plano com IA deixa de funcionar.</span>
            <button type="button" class="text-[13px] font-semibold text-ink-2 hover:text-ink" @click="confirmingRemoveKey = false">
              Cancelar
            </button>
            <button type="button" data-test="confirmar-remover-chave-ai" :disabled="removingKey" class="btn-danger-solid" @click="removeKey">
              {{ removingKey ? 'Removendo...' : 'Sim' }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="saveError" role="alert" class="text-[15px] text-danger">{{ saveError }}</p>

      <div class="flex justify-end border-t border-line pt-6">
        <button type="submit" data-test="salvar-empresa" :disabled="saving || !isDirty" class="btn-primary">
          {{ saving ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </form>
  </div>
</template>
