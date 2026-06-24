<script setup lang="ts">
const ui = useUiStore();
</script>

<template>
  <ClientOnly>
    <div v-if="ui.confirmState" class="backdrop" @click="ui.resolveConfirm(false)">
      <div class="dialog" @click.stop>
        <h3 class="font-display">{{ ui.confirmState.title }}</h3>
        <p class="msg">{{ ui.confirmState.msg }}</p>
        <div class="actions">
          <button class="btn" @click="ui.resolveConfirm(false)">Cancelar</button>
          <button
            class="btn"
            :class="ui.confirmState.danger ? 'danger' : 'btn-primary'"
            @click="ui.resolveConfirm(true)"
          >
            {{ ui.confirmState.confirmLabel ?? 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 75;
  background: rgba(5, 8, 14, 0.55);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 16px;
}
.dialog {
  width: 100%;
  max-width: 380px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow);
  padding: 22px;
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
.dialog h3 {
  font-weight: 700;
  font-size: var(--fs-lg);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.msg {
  color: var(--muted);
  font-size: var(--fs-sm);
  line-height: 1.5;
  margin-bottom: 20px;
}
.actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.danger {
  border: none;
  background: var(--scarlet);
  color: #fff;
  font-weight: 700;
}
</style>
