<script setup lang="ts">
// Shared page header for list/section screens (Torneios, Bolões, Palpites…).
// Keeps title/subtitle typography and spacing consistent across the app.
// Use the #actions slot for a trailing button (e.g. "+ Criar bolão").
defineProps<{ title: string; subtitle?: string }>();
const slots = useSlots();
</script>

<template>
  <header class="ph">
    <div class="ph-text">
      <h1 class="font-display ph-title">{{ title }}</h1>
      <p v-if="subtitle" class="ph-sub">{{ subtitle }}</p>
    </div>
    <div v-if="slots.actions" class="ph-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.ph {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}
.ph-text {
  min-width: 0;
}
.ph-title {
  font-weight: 700;
  font-size: clamp(1.5rem, 5vw, 2rem);
  text-transform: uppercase;
  line-height: 1;
  letter-spacing: 0.01em;
}
.ph-sub {
  color: var(--muted);
  margin-top: 7px;
  font-size: var(--fs-sm);
  max-width: 520px;
}
.ph-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
