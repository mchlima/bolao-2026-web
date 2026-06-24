<script lang="ts">
export interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  tone?: 'default' | 'gold' | 'azure' | 'emerald' | 'danger';
  onSelect: () => void;
}
</script>

<script setup lang="ts">
// Row-actions "⋮" menu. The dropdown is teleported to <body> and positioned with
// fixed coords from the trigger, so it escapes any ancestor `overflow: hidden`
// (e.g. AdminTable). Closes on outside click, scroll, resize or Escape, and
// flips above the trigger when there isn't room below.
const props = withDefaults(
  defineProps<{ items: MenuItem[]; label?: string; size?: number }>(),
  { label: 'Ações', size: 30 },
);

const MENU_W = 224;
const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const pos = ref({ top: 0, left: 0 });

async function place(): Promise<void> {
  const el = triggerRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, r.right - MENU_W),
    window.innerWidth - MENU_W - 8,
  );
  pos.value = { top: r.bottom + 6, left };
  await nextTick();
  const mh = menuRef.value?.offsetHeight ?? 0;
  if (r.bottom + 6 + mh > window.innerHeight - 8) {
    pos.value = { top: Math.max(8, r.top - mh - 6), left };
  }
}

async function toggle(): Promise<void> {
  if (open.value) {
    open.value = false;
    return;
  }
  open.value = true;
  await place();
}

function select(it: MenuItem): void {
  open.value = false;
  it.onSelect();
}

function onDocPointer(e: PointerEvent): void {
  const t = e.target as Node;
  if (triggerRef.value?.contains(t) || menuRef.value?.contains(t)) return;
  open.value = false;
}
function onDismiss(): void {
  open.value = false;
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') open.value = false;
}

watch(open, (v) => {
  const m = v ? 'addEventListener' : 'removeEventListener';
  document[m]('pointerdown', onDocPointer as EventListener, true);
  window[m]('scroll', onDismiss, true);
  window[m]('resize', onDismiss);
  document[m]('keydown', onKey as EventListener);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer as EventListener, true);
  window.removeEventListener('scroll', onDismiss, true);
  window.removeEventListener('resize', onDismiss);
  document.removeEventListener('keydown', onKey as EventListener);
});
</script>

<template>
  <span ref="triggerRef" class="km-wrap">
    <button
      type="button"
      class="km-trigger"
      :class="{ open }"
      :style="{ width: `${size}px`, height: `${size}px` }"
      :title="label"
      :aria-label="label"
      :aria-expanded="open"
      @click.stop.prevent="toggle"
    >
      <AppIcon name="moreVertical" :size="18" :stroke="2.6" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="km-menu"
        :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
        role="menu"
      >
        <button
          v-for="it in items"
          :key="it.key"
          type="button"
          class="km-item"
          :class="`tone-${it.tone ?? 'default'}`"
          role="menuitem"
          @click.stop.prevent="select(it)"
        >
          <AppIcon v-if="it.icon" :name="it.icon" :size="16" :stroke="2" class="km-ic" />
          <span>{{ it.label }}</span>
        </button>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.km-wrap {
  display: inline-flex;
}
.km-trigger {
  display: grid;
  place-items: center;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--muted);
  cursor: pointer;
  transition: color 0.13s, border-color 0.13s, background 0.13s;
}
.km-trigger:hover,
.km-trigger.open {
  color: var(--text);
  border-color: color-mix(in srgb, var(--text) 22%, var(--border));
  background: var(--bg-surface);
}
</style>

<style>
/* Teleported to <body>, so the dropdown styles can't be scoped. */
.km-menu {
  position: fixed;
  z-index: 200;
  width: 224px;
  padding: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.km-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: var(--fs-sm);
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.km-item .km-ic {
  color: var(--muted);
  flex: none;
}
.km-item:hover {
  background: var(--bg-surface);
}
.km-item.tone-gold:hover {
  color: var(--gold);
}
.km-item.tone-gold:hover .km-ic {
  color: var(--gold);
}
.km-item.tone-azure:hover {
  color: var(--azure);
}
.km-item.tone-azure:hover .km-ic {
  color: var(--azure);
}
.km-item.tone-emerald:hover {
  color: var(--emerald);
}
.km-item.tone-emerald:hover .km-ic {
  color: var(--emerald);
}
.km-item.tone-danger:hover {
  color: var(--scarlet);
  background: color-mix(in srgb, var(--scarlet) 10%, transparent);
}
.km-item.tone-danger:hover .km-ic {
  color: var(--scarlet);
}
</style>
