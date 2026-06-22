<script setup lang="ts">
// Cabeçalho padrão das páginas dos 3 pilares (Futebol / Notícias / Bolão):
// breadcrumb (opcional) + eyebrow azul com o nome do pilar + título, e um
// logo/ícone OPCIONAL (menor) à esquerda. Slot #actions para um botão à direita.
defineProps<{
  /** Eyebrow azul acima do título (nome do pilar: "Futebol" | "Notícias" | "Bolão"). */
  pillar?: string;
  title: string;
  /** Linha de apoio opcional abaixo do título. */
  subtitle?: string | null;
  /** Trilha de navegação (Início › Pilar › …). Omitida quando não passada. */
  crumbs?: { name: string; to?: string }[];
  /** Ícone opcional (nome do AppIcon). Ignorado se `comp` for passado. */
  icon?: string;
  /** Acento do ícone/box. */
  tone?: 'azure' | 'gold';
  /** Logo de competição opcional (TournamentBadge). */
  comp?: { name: string; logoUrl: string | null; logoUrlDark: string | null } | null;
}>();
const slots = useSlots();
</script>

<template>
  <div class="page-hero">
    <Breadcrumbs v-if="crumbs?.length" :items="crumbs" />
    <header class="hub-head">
      <span v-if="comp || icon" class="logo-wrap" :class="tone ?? 'azure'">
        <TournamentBadge
          v-if="comp"
          :name="comp.name"
          :logo-url="comp.logoUrl"
          :logo-url-dark="comp.logoUrlDark"
          :size="52"
        />
        <AppIcon v-else-if="icon" :name="icon" :size="32" :stroke="1.8" />
      </span>
      <div class="hh-txt">
        <span v-if="pillar" class="hh-eyebrow">{{ pillar }}</span>
        <h1 class="font-display">{{ title }}</h1>
        <p v-if="subtitle" class="hh-sub">{{ subtitle }}</p>
      </div>
      <div v-if="slots.actions" class="hh-actions">
        <slot name="actions" />
      </div>
    </header>
  </div>
</template>

<style scoped>
.hub-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}
/* Box do logo/ícone — menor que o anterior; opcional. */
.logo-wrap {
  flex: none;
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}
.logo-wrap.azure { color: var(--azure); }
.logo-wrap.gold { color: var(--gold); }
.hh-txt { min-width: 0; flex: 1; }
.hh-eyebrow {
  display: block;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--azure);
  margin-bottom: 3px;
}
.hub-head h1 {
  min-width: 0;
  font-size: clamp(26px, 6vw, 44px);
  font-weight: 700;
  line-height: 1.02;
  text-transform: uppercase;
}
.hh-sub {
  margin: 7px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted);
  max-width: 60ch;
}
.hh-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
}
@media (max-width: 560px) {
  .logo-wrap { width: 60px; height: 60px; border-radius: 15px; }
}
</style>
