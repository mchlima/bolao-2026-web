<script setup lang="ts">
// Square icon-only button for table row actions. Replaces the per-page `.ic`
// emoji buttons. Tone drives the resting/hover color; the surface stays neutral
// until hover so dense action clusters read calmly.
withDefaults(
  defineProps<{
    icon: string;
    label: string;
    tone?: 'default' | 'danger' | 'gold' | 'azure' | 'emerald';
    size?: number;
    active?: boolean;
  }>(),
  { tone: 'default', size: 32, active: false },
);
</script>

<template>
  <button
    type="button"
    class="icon-btn"
    :class="[`tone-${tone}`, { active }]"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="label"
    :aria-label="label"
  >
    <AppIcon :name="icon" :size="size <= 30 ? 16 : 17" />
  </button>
</template>

<style scoped>
.icon-btn {
  display: grid;
  place-items: center;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--muted);
  cursor: pointer;
  transition: color 0.13s, border-color 0.13s, background 0.13s, transform 0.05s;
}
.icon-btn:hover {
  color: var(--text);
  border-color: var(--muted);
}
.icon-btn:active {
  transform: translateY(1px);
}
.tone-danger:hover {
  color: var(--scarlet);
  border-color: color-mix(in srgb, var(--scarlet) 55%, var(--border));
  background: color-mix(in srgb, var(--scarlet) 9%, transparent);
}
.tone-gold.active,
.tone-gold:hover {
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 55%, var(--border));
}
.tone-azure:hover {
  color: var(--azure);
  border-color: color-mix(in srgb, var(--azure) 55%, var(--border));
}
.tone-emerald:hover {
  color: var(--emerald);
  border-color: color-mix(in srgb, var(--emerald) 55%, var(--border));
}
.tone-gold.active {
  background: color-mix(in srgb, var(--gold) 12%, transparent);
}
</style>
