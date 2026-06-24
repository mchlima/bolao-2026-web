<script setup lang="ts">
// Faixa de CTA do Bolão — o convite recorrente que leva o leitor do conteúdo
// (home, página de jogo, notícia) pra Área do Bolão (logado) ou pra landing de
// conversão (anônimo). Fundo claro + acento dourado (sotaque do bolão).
const props = withDefaults(
  defineProps<{
    headline?: string;
    sub?: string;
    /** 'home' = faixa larga; 'inline' = compacta (dentro de artigo/partida) */
    variant?: 'home' | 'inline';
    /** Sobrescreve o destino anônimo (default: landing da Copa). */
    to?: string;
    /** Sobrescreve o texto do botão. */
    ctaLabel?: string;
  }>(),
  { variant: 'home' },
);
const auth = useAuthStore();
const target = computed(() =>
  auth.isAuthenticated ? '/boloes' : (props.to ?? '/bolao-da-copa-do-mundo-2026'),
);
const cta = computed(
  () => props.ctaLabel ?? (auth.isAuthenticated ? 'Ir para meus bolões' : 'Criar bolão da Copa do Mundo'),
);
</script>

<template>
  <aside class="ctaband" :class="variant">
    <div class="cb-txt">
      <strong class="cb-head font-display">{{ headline || 'Bolão da Copa do Mundo com a galera' }}</strong>
      <span class="cb-sub">{{ sub || 'Crave os placares, dispute o ranking com os amigos e acompanhe ao vivo. Grátis.' }}</span>
    </div>
    <NuxtLink :to="target" class="btn btn-gold cb-btn">{{ cta }}</NuxtLink>
  </aside>
</template>

<style scoped>
.ctaband {
  display: flex;
  align-items: center;
  gap: 16px 20px;
  flex-wrap: wrap;
  padding: 20px 22px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--gold) 38%, var(--border));
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 12%, var(--bg-surface)), var(--bg-surface) 70%);
}
.ctaband.inline { padding: 16px 18px; border-radius: 14px; }
.cb-txt { flex: 1 1 280px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.cb-head { font-weight: 700; font-size: var(--fs-lg); line-height: 1.2; text-transform: uppercase; letter-spacing: 0.01em; }
.ctaband.inline .cb-head { font-size: var(--fs-base); }
.cb-sub { font-size: var(--fs-sm); color: var(--muted); line-height: 1.5; }
.cb-btn { flex: none; white-space: nowrap; }
@media (max-width: 520px) {
  .cb-btn { width: 100%; }
}
</style>
