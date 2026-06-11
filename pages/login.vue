<script setup lang="ts">
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    await auth.login(email.value, password.value);
    const back = (route.query.redirect as string) || '/';
    router.push(back);
  } catch (e) {
    error.value =
      (e as { data?: { message?: string } })?.data?.message ??
      'Não foi possível entrar.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth">
    <div class="card box">
      <h1>Entrar</h1>
      <form @submit.prevent="submit">
        <label>E-mail</label>
        <input v-model="email" type="email" class="input" autocomplete="email" required />
        <label>Senha</label>
        <input
          v-model="password"
          type="password"
          class="input"
          autocomplete="current-password"
          required
        />
        <p v-if="error" class="err">{{ error }}</p>
        <button class="btn btn-primary btn-block" :disabled="loading" type="submit">
          {{ loading ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
      <p class="muted alt">
        Não tem conta? <NuxtLink to="/register">Cadastre-se</NuxtLink>
      </p>
    </div>
  </section>
</template>

<style scoped>
.auth {
  display: flex;
  justify-content: center;
  padding-top: 1.5rem;
}
.box {
  width: 100%;
  max-width: 360px;
  padding: 1.5rem;
}
form {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
label {
  font-size: 0.82rem;
  font-weight: 600;
  margin-top: 0.5rem;
}
.btn-block {
  margin-top: 1rem;
}
.err {
  color: var(--danger);
  font-size: 0.85rem;
  margin: 0.5rem 0 0;
}
.alt {
  text-align: center;
  margin-top: 1rem;
  font-size: 0.88rem;
}
.alt a {
  color: var(--primary);
  font-weight: 600;
}
</style>
