<script setup lang="ts">
useSeoMeta({ title: 'Entrar — Cravei', robots: 'noindex' });

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const ui = useUiStore();

const email = ref('');
const password = ref('');
const loading = ref(false);

// Only allow internal (relative) redirects — never an external URL.
const redirect = computed(() => {
  const r = route.query.redirect as string | undefined;
  return r && r.startsWith('/') ? r : '/';
});

async function submit() {
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    ui.toast('success', 'Bem-vindo de volta!');
    router.push(redirect.value);
  } catch (e) {
    ui.toast(
      'error',
      (e as { data?: { message?: string } })?.data?.message ?? 'Não foi possível entrar.',
    );
  } finally {
    loading.value = false;
  }
}

async function onGoogle(idToken: string) {
  loading.value = true;
  try {
    await auth.loginWithGoogle(idToken);
    ui.toast('success', 'Bem-vindo!');
    router.push(redirect.value);
  } catch (e) {
    ui.toast(
      'error',
      (e as { data?: { message?: string } })?.data?.message ?? 'Não foi possível entrar com o Google.',
    );
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth">
    <div class="wrap">
      <div class="brand">
        <span class="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0A0E14" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
        </span>
        <h1 class="font-display">Cravei</h1>
        <p class="tag">Entre na disputa da Copa 2026</p>
      </div>

      <div class="card box">
        <div class="tabs">
          <span class="tab on">Entrar</span>
          <NuxtLink :to="{ path: '/register', query: route.query }" class="tab">Criar conta</NuxtLink>
        </div>
        <form @submit.prevent="submit">
          <label>E-mail</label>
          <input v-model="email" type="email" class="input" placeholder="voce@email.com" autocomplete="email" required />
          <label>Senha</label>
          <input v-model="password" type="password" class="input" placeholder="••••••••" autocomplete="current-password" required />
          <button class="btn btn-primary btn-block submit" :disabled="loading" type="submit">
            {{ loading ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>
        <div class="sep"><span>ou</span></div>
        <GoogleSignInButton text="continue_with" @credential="onGoogle" @error="ui.toast('error', 'Falha no login com o Google.')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: calc(100vh - var(--header-h, 62px));
  display: grid;
  place-items: center;
  padding: 24px 0;
}
.wrap {
  width: 100%;
  max-width: 412px;
}
.brand {
  text-align: center;
  margin-bottom: 26px;
}
.logo {
  width: 62px;
  height: 62px;
  border-radius: 18px;
  background: var(--grad-trophy);
  display: grid;
  place-items: center;
  margin: 0 auto 16px;
  box-shadow: 0 14px 36px -10px rgba(224, 33, 138, 0.7);
}
.brand h1 {
  font-weight: 700;
  font-size: 30px;
  text-transform: uppercase;
  line-height: 1;
}
.tag {
  color: var(--muted);
  margin-top: 8px;
  font-size: 14px;
}
.box {
  border-radius: 20px;
  padding: 22px;
}
.tabs {
  display: flex;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 20px;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 9px;
  font-weight: 700;
  font-size: 13.5px;
  color: var(--muted);
  cursor: pointer;
}
.tab.on {
  background: var(--bg-surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
form {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
label {
  font-size: 12px;
  font-weight: 700;
  margin-top: 0.6rem;
  color: var(--muted);
}
.submit {
  margin-top: 1rem;
  padding: 14px;
  font-size: 16px;
}
.sep {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 16px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.sep::before,
.sep::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
</style>
