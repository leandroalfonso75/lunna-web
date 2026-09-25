<script setup lang="ts">
/**
 * Layout dividido de login/cadastro: painel esquerdo marinho com a marca
 * (só em >= 1024px, `lg:`) + formulário (slot) à direita. Abaixo de
 * 1024px, sem painel — só o ícone da marca acima do formulário.
 */
</script>

<template>
  <div class="flex min-h-screen">
    <div
      class="hidden w-[420px] shrink-0 flex-col justify-center gap-6 p-12 lg:flex"
      style="background: linear-gradient(180deg, #070b1f 0%, #0b1333 100%)"
    >
      <img src="/brand/lunna-logo.webp" alt="Lunna" width="240" class="w-[240px]" />
      <p class="max-w-xs text-[16px] leading-relaxed text-white/80">
        Seus anúncios de marketplace, com números que viram decisão.
      </p>
    </div>

    <div class="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <div class="w-full max-w-[400px]">
        <div class="mb-6 flex justify-center lg:hidden">
          <img src="/brand/lunna-mark-128.png" alt="Lunna" width="48" height="48" class="h-12 w-12" />
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>
