<script setup lang="ts">
import { ArrowPathIcon, BellAlertIcon, ChartBarIcon } from '@heroicons/vue/24/outline'

/**
 * Layout dividido de login/cadastro: painel esquerdo marinho com a marca
 * (~42% da largura, só em >= 1024px, `lg:`) + formulário (slot) à direita.
 * Abaixo de 1024px, sem painel — só o ícone da marca acima do formulário.
 */
const BENEFITS = [
  { icon: ArrowPathIcon, text: 'Sincroniza com o Mercado Livre a cada 5 minutos' },
  { icon: ChartBarIcon, text: 'Curva ABC com lucro e margem por anúncio' },
  { icon: BellAlertIcon, text: 'Alertas do que precisa de atenção hoje' }
]
</script>

<template>
  <div class="flex min-h-screen">
    <div
      class="relative hidden overflow-hidden lg:flex lg:w-[42%] lg:min-w-[420px] lg:flex-col lg:justify-center lg:gap-8 lg:p-12"
      style="
        background:
          radial-gradient(circle at 18% 20%, rgba(107, 140, 255, 0.28), transparent 55%),
          radial-gradient(circle at 85% 78%, rgba(167, 139, 250, 0.22), transparent 55%),
          linear-gradient(180deg, #070b1f 0%, #0b1333 100%);
      "
    >
      <img src="/brand/lunna-logo.webp" alt="Lunna" width="260" class="relative w-[260px]" />

      <p class="relative max-w-sm text-[18px] leading-relaxed text-white/80">
        Seus anúncios de marketplace, com números que viram decisão.
      </p>

      <ul class="relative space-y-4">
        <li v-for="benefit in BENEFITS" :key="benefit.text" class="flex items-start gap-3 text-[15px] text-white/70">
          <component :is="benefit.icon" class="mt-0.5 h-5 w-5 shrink-0 text-white" aria-hidden="true" />
          <span>{{ benefit.text }}</span>
        </li>
      </ul>
    </div>

    <div class="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <div class="w-full max-w-[420px]">
        <div class="mb-6 flex justify-center lg:hidden">
          <img src="/brand/lunna-mark-128.png" alt="Lunna" width="48" height="48" class="h-12 w-12" />
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>
