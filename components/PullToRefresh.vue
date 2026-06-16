<script setup lang="ts">
// Custom pull-to-refresh for the installed PWA. iOS standalone has no native
// PTR and we disable the native Android one (overscroll-behavior, see main.css),
// so this is the single, identical gesture on both platforms. Only active on
// small screens, where the document itself scrolls (see layouts/default.vue);
// on desktop the inner-scroll shell stays and these touch handlers never fire.
const TRIGGER = 70; // px of pull needed to fire a refresh
const MAX = 120; // clamp the visual pull
const MIN_SPIN_MS = 450; // keep the spinner up at least this long for feedback

const pull = ref(0);
const refreshing = ref(false);
let startY = 0;
let active = false;

const atTop = () => window.scrollY <= 0;
const isMobile = () => window.matchMedia('(max-width: 720px)').matches;

function onStart(e: TouchEvent) {
  if (refreshing.value || e.touches.length !== 1 || !isMobile() || !atTop()) return;
  startY = e.touches[0].clientY;
  active = true;
}
function onMove(e: TouchEvent) {
  if (!active || refreshing.value) return;
  const dy = e.touches[0].clientY - startY;
  if (dy <= 0 || !atTop()) {
    active = false;
    pull.value = 0;
    return;
  }
  pull.value = Math.min(MAX, dy * 0.5); // resistance
  if (e.cancelable) e.preventDefault(); // hold the page still while pulling
}
async function onEnd() {
  if (!active) return;
  active = false;
  if (pull.value >= TRIGGER && !refreshing.value) {
    refreshing.value = true;
    pull.value = TRIGGER;
    const started = performance.now();
    try {
      await refreshNuxtData();
    } catch {
      // ignore — a failed refresh just drops the spinner
    }
    const elapsed = performance.now() - started;
    if (elapsed < MIN_SPIN_MS) await new Promise((r) => setTimeout(r, MIN_SPIN_MS - elapsed));
    refreshing.value = false;
  }
  pull.value = 0;
}

onMounted(() => {
  window.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd, { passive: true });
  window.addEventListener('touchcancel', onEnd, { passive: true });
});
onBeforeUnmount(() => {
  window.removeEventListener('touchstart', onStart);
  window.removeEventListener('touchmove', onMove);
  window.removeEventListener('touchend', onEnd);
  window.removeEventListener('touchcancel', onEnd);
});

const progress = computed(() => Math.min(1, pull.value / TRIGGER));
</script>

<template>
  <Transition name="ptr-fade">
    <div
      v-show="pull > 0 || refreshing"
      class="ptr"
      :style="{ height: `${refreshing ? TRIGGER : pull}px` }"
      aria-hidden="true"
    >
      <span
        class="ptr-ic"
        :class="{ spin: refreshing }"
        :style="{
          opacity: progress,
          transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
        }"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.ptr {
  position: fixed;
  top: env(safe-area-inset-top, 0px);
  left: 0;
  right: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
  color: var(--emerald);
}
.ptr-ic {
  display: grid;
  place-items: center;
}
.ptr-ic.spin {
  animation: ptr-spin 0.7s linear infinite;
}
@keyframes ptr-spin {
  to {
    transform: rotate(360deg);
  }
}
.ptr-fade-enter-active,
.ptr-fade-leave-active {
  transition: opacity 0.2s ease;
}
.ptr-fade-enter-from,
.ptr-fade-leave-to {
  opacity: 0;
}
</style>
