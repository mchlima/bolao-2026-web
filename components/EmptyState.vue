<script setup lang="ts">
// Consistent empty state for lists/sections across the app. Icon + title +
// optional description and an action slot. Mirrors AdminTable's empty pattern.
withDefaults(
  defineProps<{ icon?: string; title: string; description?: string; compact?: boolean }>(),
  { icon: 'inbox', compact: false },
);
</script>

<template>
  <div class="empty-state" :class="{ compact }">
    <span class="es-icon"><AppIcon :name="icon" :size="compact ? 26 : 30" :stroke="1.6" /></span>
    <p class="es-title">{{ title }}</p>
    <p v-if="description" class="es-desc">{{ description }}</p>
    <div v-if="$slots.action" class="es-action"><slot name="action" /></div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 52px 22px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  background: var(--bg-surface);
}
.empty-state.compact {
  padding: 34px 18px;
  border-radius: 14px;
}
.es-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--bg-base);
  color: var(--muted);
  margin-bottom: 4px;
}
.es-title {
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
}
.es-desc {
  font-size: 13px;
  color: var(--muted);
  font-weight: 500;
  max-width: 360px;
  line-height: 1.5;
}
.es-action {
  margin-top: 10px;
}
</style>
