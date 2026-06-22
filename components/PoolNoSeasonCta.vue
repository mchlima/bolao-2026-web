<script setup lang="ts">
// CTA de "bolão sem temporada" — card destacado (dourado) com o botão de criar a
// 1ª temporada (dono/admin) ou um aviso (membro comum). Usado na Visão geral e na
// aba Temporadas. Emite `changed` após criar pra o host recarregar seus dados.
defineProps<{ poolId: string; canManage: boolean }>();
const emit = defineEmits<{ changed: [] }>();
</script>

<template>
  <div class="empty-run">
    <span class="er-ic"><AppIcon name="trophy" :size="26" :stroke="1.8" /></span>
    <h2 class="er-title font-display">Bolão sem temporada</h2>
    <p v-if="canManage" class="er-sub">
      Crie a <strong>primeira temporada</strong> pro bolão começar — você escolhe o
      campeonato e o nome.
    </p>
    <p v-else class="er-sub">
      O dono ainda não abriu a primeira temporada deste bolão. Volte em breve.
    </p>
    <PoolRunControls
      v-if="canManage"
      actions-only
      scope="new"
      class="er-cta"
      :pool-id="poolId"
      :run="null"
      :can-manage="true"
      @changed="emit('changed')"
    />
  </div>
</template>

<style scoped>
.empty-run {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 34px 20px;
  border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
  border-radius: 16px;
  background: color-mix(in srgb, var(--gold) 7%, var(--bg-surface));
}
.er-ic {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--gold) 16%, transparent);
  color: var(--gold);
}
.er-title {
  font-weight: 700;
  font-size: clamp(20px, 4vw, 24px);
  text-transform: uppercase;
  margin: 4px 0 0;
}
.er-sub {
  font-size: 14px;
  line-height: 1.55;
  color: var(--muted);
  max-width: 46ch;
  margin: 0;
}
.er-sub strong {
  color: var(--text);
  font-weight: 700;
}
.er-cta {
  margin-top: 8px;
}
</style>
