<script setup lang="ts">
import { computed, ref } from 'vue'
import AuthSplitLayout from '../components/auth/AuthSplitLayout.vue'
import { apiErrorMessage } from '../lib/apiErrors'

definePageMeta({ layout: false })

const auth = useAuth()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

/**
 * Quando o guard encerra a sessão porque `/api/me` falhou (JWT
 * expirado/inválido), ele manda para cá com `?motivo=sessao_expirada`. A
 * frase é fixa — nunca o texto da API.
 */
const sessionExpiredNotice = computed(() =>
  route.query.motivo === 'sessao_expirada' ? 'Sua sessão expirou. Entre novamente.' : ''
)

const entrar = async () => {
  errorMessage.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Não foi possível entrar. Confira seu e-mail e senha e tente de novo.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthSplitLayout>
    <form class="card space-y-5 p-8" @submit.prevent="entrar">
      <h2 class="text-[18px] text-ink">Entrar</h2>

      <p v-if="sessionExpiredNotice" data-test="sessao-expirada" role="status" class="text-[15px] text-ink-2">
        {{ sessionExpiredNotice }}
      </p>

      <div class="space-y-1.5">
        <label for="email" class="field-label">E-mail</label>
        <input id="email" v-model="email" type="email" autocomplete="email" required class="input" />
      </div>

      <div class="space-y-1.5">
        <label for="password" class="field-label">Senha</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required class="input" />
      </div>

      <p v-if="errorMessage" role="alert" class="text-[15px] text-danger">{{ errorMessage }}</p>

      <button type="submit" :disabled="loading" class="btn-primary w-full">
        {{ loading ? 'Entrando...' : 'Entrar' }}
      </button>

      <p class="text-center text-[15px] text-ink-2">
        Não tem conta?
        <NuxtLink to="/cadastro" class="btn-link">Criar conta</NuxtLink>
      </p>
    </form>
  </AuthSplitLayout>
</template>
