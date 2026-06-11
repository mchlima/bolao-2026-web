<script setup lang="ts">
const ui = useUiStore();
const COLOR: Record<string, string> = {
  success: 'var(--emerald)',
  error: 'var(--scarlet)',
  info: 'var(--azure)',
};
const ICON: Record<string, string> = { success: '✓', error: '✕', info: 'ℹ' };
</script>

<template>
  <ClientOnly>
    <div class="host">
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="toast"
        :style="{ borderColor: COLOR[t.type], borderLeftColor: COLOR[t.type] }"
        @click="ui.dismiss(t.id)"
      >
        <span class="ic" :style="{ color: COLOR[t.type] }">{{ ICON[t.type] }}</span>
        <span class="msg">{{ t.msg }}</span>
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.host {
  position: fixed;
  z-index: 80;
  right: 16px;
  bottom: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  width: 100%;
  max-width: 380px;
  display: flex;
  align-items: flex-start;
  gap: 11px;
  background: var(--bg-elevated);
  border: 1px solid;
  border-left: 4px solid;
  border-radius: 13px;
  padding: 13px 14px;
  box-shadow: var(--shadow);
  animation: toastIn 0.28s ease both;
  cursor: pointer;
}
.ic {
  margin-top: 1px;
  font-weight: 900;
  flex: 0 0 auto;
}
.msg {
  font-size: 13.5px;
  font-weight: 600;
}
</style>
