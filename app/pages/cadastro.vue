<script setup lang="ts">
import { ArrowPathIcon, EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import { ref } from 'vue'
import AuthSplitLayout from '../components/auth/AuthSplitLayout.vue'
import { apiErrorMessage } from '../lib/apiErrors'

definePageMeta({ layout: false })

const auth = useAuth()

const companyName = ref('')
const name = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const criarConta = async () => {
  errorMessage.value = ''
  loading.value = true
  try {
    await auth.signup({
      companyName: companyName.value,
      name: name.value,
      email: email.value,
      password: password.value
    })
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Não foi possível criar sua conta. Confira os dados e tente de novo.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthSplitLayout>
    <form class="card space-y-5 p-8" @submit.prevent="criarConta">
      <div>
        <h1 class="text-[24px] font-bold text-ink">Criar sua conta</h1>
        <p class="mt-1 text-[15px] text-ink-2">Comece a acompanhar seus anúncios do Mercado Livre em minutos.</p>
      </div>

      <p class="rounded-card bg-info-soft px-3 py-2 text-[13px] text-info">
        Você será o administrador da empresa e poderá convidar sua equipe em Configurações.
      </p>

      <div class="space-y-1.5">
        <label for="company-name" class="field-label">Nome da empresa</label>
        <input id="company-name" v-model="companyName" type="text" autocomplete="organization" required class="input-lg" />
      </div>

      <div class="space-y-1.5">
        <label for="name" class="field-label">Seu nome</label>
        <input id="name" v-model="name" type="text" autocomplete="name" required class="input-lg" />
      </div>

      <div class="space-y-1.5">
        <label for="email" class="field-label">E-mail</label>
        <input id="email" v-model="email" type="email" autocomplete="email" required class="input-lg" />
      </div>

      <div class="space-y-1.5">
        <label for="password" class="field-label">Senha</label>
        <div class="relative">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            required
            minlength="8"
            aria-describedby="password-hint"
            class="input-lg pr-11"
          />
          <button
            type="button"
            data-test="alternar-senha"
            class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 hover:text-ink"
            :aria-pressed="showPassword"
            :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
            @click="showPassword = !showPassword"
          >
            <component :is="showPassword ? EyeSlashIcon : EyeIcon" class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p id="password-hint" class="text-[13px] text-ink-3">Mínimo de 8 caracteres.</p>
      </div>

      <p v-if="errorMessage" role="alert" class="text-[15px] text-danger">{{ errorMessage }}</p>

      <button type="submit" :disabled="loading" data-test="signup-submit" class="btn-primary h-11 w-full text-[15px]">
        <ArrowPathIcon v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
        {{ loading ? 'Criando...' : 'Criar conta' }}
      </button>

      <p class="text-center text-[15px] text-ink-2">
        Já tem conta?
        <NuxtLink to="/login" class="btn-link">Entrar</NuxtLink>
      </p>
    </form>
  </AuthSplitLayout>
</template>
