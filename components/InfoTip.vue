<script setup lang="ts">
// Small "ⓘ" help affordance with a hover/focus tooltip. The bubble is teleported
// to <body> and fixed-positioned so it is NEVER clipped by an ancestor's
// overflow. Keyboard-accessible. Use the default slot (or `text` prop).
defineProps<{ text?: string }>();
const open = ref(false);
const trigger = ref<HTMLElement | null>(null);
const x = ref(0);
const y = ref(0);

function show() {
  const el = trigger.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  x.value = r.left + r.width / 2;
  y.value = r.top - 8;
  open.value = true;
}
function hide() {
  open.value = false;
}
</script>

<template>
  <span
    ref="trigger"
    class="infotip"
    tabindex="0"
    role="note"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
  >
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" />
    </svg>
    <Teleport to="body">
      <span v-if="open" class="infotip-bubble" :style="{ left: `${x}px`, top: `${y}px` }">
        <slot>{{ text }}</slot>
      </span>
    </Teleport>
  </span>
</template>

<style scoped>
.infotip {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: var(--muted);
  cursor: help;
  flex: none;
  outline: none;
  vertical-align: middle;
}
.infotip:hover,
.infotip:focus-visible {
  color: var(--azure);
}
/* Teleported to <body>; keeps the component scope id so this scoped rule applies. */
.infotip-bubble {
  position: fixed;
  transform: translate(-50%, -100%);
  width: max-content;
  max-width: 260px;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  padding: 9px 11px;
  font-size: var(--fs-xs);
  font-weight: 500;
  line-height: 1.45;
  text-transform: none;
  letter-spacing: 0;
  white-space: normal;
  z-index: 9999;
  pointer-events: none;
}
.infotip-bubble::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--bg-elevated);
}
</style>
