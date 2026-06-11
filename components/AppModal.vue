<script setup lang="ts">
const props = defineProps<{ title: string; wide?: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <ClientOnly>
    <div class="backdrop" @click="emit('close')">
      <!-- stopPropagation: clicks inside must NOT close the modal (briefing requirement) -->
      <div class="modal" :class="{ wide }" @click.stop>
        <div class="m-head">
          <h3 class="font-display">{{ title }}</h3>
          <button class="x" @click="emit('close')" aria-label="Fechar">✕</button>
        </div>
        <div class="m-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="m-foot">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(5, 8, 14, 0.55);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 16px;
}
.modal {
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: var(--shadow);
  animation: rise 0.2s ease both;
}
@keyframes rise {
  0% {
    transform: translateY(10px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
.modal.wide {
  max-width: 620px;
}
.m-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px;
}
.m-head h3 {
  font-weight: 700;
  font-size: 18px;
  text-transform: uppercase;
}
.x {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--muted);
  cursor: pointer;
}
.m-body {
  padding: 4px 20px 18px;
}
.m-foot {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}
</style>
