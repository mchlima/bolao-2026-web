<script setup lang="ts">
// Discreet "install this app" banner. On Android/Chrome it drives the captured
// beforeinstallprompt via the PWA module ($pwa.install()). On iOS Safari (which
// has no install event) it shows the manual Add-to-Home-Screen hint. Dismissible.
const { $pwa } = useNuxtApp();
const dismissed = ref(true); // assume dismissed until we read localStorage (avoids flash)

const isIOS = ref(false);
const standalone = ref(false);
onMounted(() => {
  const ua = navigator.userAgent;
  isIOS.value = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua); // Safari only
  standalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  dismissed.value = localStorage.getItem('pwa-install-dismissed') === '1';
});

const canPrompt = computed(() => !!$pwa?.showInstallPrompt && !$pwa?.isPWAInstalled);
const showIOS = computed(() => isIOS.value && !standalone.value);
const show = computed(() => !dismissed.value && (canPrompt.value || showIOS.value));

async function install() {
  await $pwa?.install();
}
function dismiss() {
  dismissed.value = true;
  localStorage.setItem('pwa-install-dismissed', '1');
}
</script>

<template>
  <ClientOnly>
    <div v-if="show" class="install">
      <span class="ic">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
      </span>
      <div class="txt">
        <b>Instalar o Amigos do Bolão</b>
        <small v-if="showIOS">No Safari: Compartilhar <span class="ish">⎙</span> → "Adicionar à Tela de Início"</small>
        <small v-else>Acesso rápido na tela inicial, como um app</small>
      </div>
      <button v-if="canPrompt" class="ins-btn" @click="install">Instalar</button>
      <button class="x" aria-label="Dispensar" @click="dismiss">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
  </ClientOnly>
</template>

<style scoped>
.install {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  margin: 0 0 14px;
  border: 1px solid color-mix(in srgb, var(--gold) 34%, var(--border));
  border-radius: 14px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 9%, var(--bg-surface)), var(--bg-surface));
}
.ic {
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--grad-trophy);
}
.txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.txt b {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 14px;
}
.txt small {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
}
.ish {
  font-size: 12px;
}
.ins-btn {
  flex: none;
  border: 0;
  background: var(--gold);
  color: #0a0e14;
  font: inherit;
  font-weight: 800;
  font-size: 13px;
  padding: 9px 16px;
  border-radius: 10px;
  cursor: pointer;
}
.x {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  background: none;
  color: var(--muted);
  cursor: pointer;
  border-radius: 8px;
}
.x:hover {
  color: var(--text);
  background: var(--bg-base);
}
</style>
