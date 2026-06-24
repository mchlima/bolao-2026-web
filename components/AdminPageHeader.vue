<script setup lang="ts">
// Standard header for admin pages: title + optional subtitle/hint + trailing
// actions slot. Sits at the top of the full-width admin <main>.
defineProps<{ title: string; subtitle?: string }>();
const slots = useSlots();
</script>

<template>
  <header class="aph">
    <div class="aph-text">
      <h1 class="font-display aph-title">{{ title }}</h1>
      <p v-if="subtitle || slots.subtitle" class="aph-sub">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="slots.actions" class="aph-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.aph {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 18px;
  margin-bottom: 22px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.aph-text {
  min-width: 0;
}
.aph-title {
  font-weight: 700;
  font-size: clamp(1.25rem, 3.4vw, 1.6875rem);
  text-transform: uppercase;
  line-height: 1.04;
  letter-spacing: 0.01em;
}
.aph-sub {
  color: var(--muted);
  margin-top: 8px;
  font-size: var(--fs-sm);
  line-height: 1.5;
  max-width: 720px;
}
.aph-sub :deep(code) {
  font-size: 0.92em;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 5px;
}
.aph-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
