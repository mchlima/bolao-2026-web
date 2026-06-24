<script setup lang="ts">
// A custom-styled "Google" button that still uses the secure ID-token flow.
// Google only mints ID tokens from its own rendered button, so we render that
// button invisibly on top of our styled face: the face is what the user sees,
// the (transparent) Google button on top captures the click and returns the
// credential (ID token), which the API verifies server-side.
const props = withDefaults(
  defineProps<{
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  }>(),
  { text: 'continue_with' },
);
const emit = defineEmits<{ credential: [idToken: string]; error: [] }>();

const {
  public: { googleClientId },
} = useRuntimeConfig();

const label = computed(() => {
  switch (props.text) {
    case 'signup_with':
      return 'Cadastrar com Google';
    case 'signin_with':
    case 'signin':
      return 'Entrar com Google';
    default:
      return 'Continuar com Google';
  }
});

const wrap = ref<HTMLElement | null>(null);
const host = ref<HTMLElement | null>(null);
let initialized = false;

function loadGsi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById('gsi-client') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('gsi')));
      return;
    }
    const s = document.createElement('script');
    s.id = 'gsi-client';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('gsi'));
    document.head.appendChild(s);
  });
}

async function render() {
  if (!googleClientId || !host.value || !wrap.value) return;
  try {
    await loadGsi();
  } catch {
    emit('error');
    return;
  }
  if (!window.google?.accounts?.id || !host.value) return;
  if (!initialized) {
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (resp) => {
        if (resp.credential) emit('credential', resp.credential);
        else emit('error');
      },
    });
    initialized = true;
  }
  // Render at the wrapper's px width so the (stretched) hidden button fully
  // overlays our face and the whole area is clickable.
  const w = Math.min(400, Math.max(200, Math.round(wrap.value.clientWidth)));
  host.value.innerHTML = '';
  window.google.accounts.id.renderButton(host.value, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: props.text,
    shape: 'pill',
    logo_alignment: 'center',
    width: w,
  });
}

let ro: ResizeObserver | null = null;
onMounted(() => {
  render();
  if (typeof ResizeObserver !== 'undefined' && wrap.value) {
    ro = new ResizeObserver(() => render());
    ro.observe(wrap.value);
  }
});
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <div v-if="googleClientId" ref="wrap" class="gbtn">
    <span class="gbtn-face" aria-hidden="true">
      <GoogleMark :size="18" />
      <span class="gbtn-label">{{ label }}</span>
    </span>
    <!-- Real Google button: invisible, on top, captures the click. -->
    <div ref="host" class="gbtn-gsi" />
  </div>
  <p v-else class="gbtn-off">Login com Google indisponível.</p>
</template>

<style scoped>
.gbtn {
  position: relative;
  width: 100%;
  max-width: 360px;
  height: 46px;
  margin: 0 auto;
}
.gbtn-face {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-surface);
  color: var(--text);
  font-size: var(--fs-base);
  font-weight: 700;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.gbtn-label {
  line-height: 1;
}
/* The hidden Google button sits on top and is stretched to cover the face. */
.gbtn-gsi {
  position: absolute;
  inset: 0;
  z-index: 2;
  opacity: 0;
  overflow: hidden;
}
.gbtn-gsi :deep(div),
.gbtn-gsi :deep(iframe) {
  width: 100% !important;
  height: 100% !important;
}
/* Hover/active feedback driven by the real button hovering above the face. */
.gbtn:hover .gbtn-face {
  background: var(--bg-base);
  border-color: var(--muted);
}
.gbtn:active .gbtn-face {
  transform: translateY(1px);
}
.gbtn-off {
  font-size: var(--fs-xs);
  color: var(--muted);
  text-align: center;
}
</style>
