<script setup lang="ts">
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const ui = useUiStore();

const name = ref('');
const email = ref('');
const password = ref('');
const password2 = ref('');
const loading = ref(false);

// Only allow internal (relative) redirects — never an external URL.
const redirect = computed(() => {
  const r = route.query.redirect as string | undefined;
  return r && r.startsWith('/') ? r : '/tournaments';
});

const matchState = computed(() => {
  if (!password2.value) return null;
  return password.value === password2.value;
});

async function submit() {
  if (matchState.value === false) {
    ui.toast('error', 'As senhas não coincidem.');
    return;
  }
  loading.value = true;
  try {
    await auth.register(name.value, email.value, password.value);
    ui.toast('success', 'Conta criada! Boa sorte nos palpites.');
    router.push(redirect.value);
  } catch (e) {
    ui.toast(
      'error',
      (e as { data?: { message?: string } })?.data?.message ?? 'Não foi possível cadastrar.',
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
        <h1 class="font-display">Amigos do Bolão</h1>
        <p class="tag">Crie sua conta para palpitar</p>
      </div>

      <div class="card box">
        <div class="tabs">
          <NuxtLink :to="{ path: '/login', query: route.query }" class="tab">Entrar</NuxtLink>
          <span class="tab on">Criar conta</span>
        </div>
        <form @submit.prevent="submit">
          <label>Nome</label>
          <input v-model="name" type="text" class="input" placeholder="Seu nome" autocomplete="name" required />
          <label>E-mail</label>
          <input v-model="email" type="email" class="input" placeholder="voce@email.com" autocomplete="email" required />
          <label>Senha (mín. 8)</label>
          <input v-model="password" type="password" class="input" placeholder="••••••••" autocomplete="new-password" minlength="8" required />
          <label>Confirmar senha</label>
          <input v-model="password2" type="password" class="input" placeholder="••••••••" autocomplete="new-password" required />
          <p v-if="matchState === false" class="err">As senhas não coincidem</p>
          <p v-else-if="matchState === true" class="ok">Senhas conferem ✓</p>
          <button class="btn btn-primary btn-block submit" :disabled="loading" type="submit">
            {{ loading ? 'Cadastrando…' : 'Criar conta' }}
          </button>
        </form>
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
.err {
  color: var(--scarlet);
  font-size: 12px;
  font-weight: 600;
  margin: 0.5rem 0 0;
}
.ok {
  color: var(--emerald);
  font-size: 12px;
  font-weight: 600;
  margin: 0.5rem 0 0;
}
</style>
