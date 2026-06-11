<script setup lang="ts">
const auth = useAuthStore();
const router = useRouter();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    await auth.register(name.value, email.value, password.value);
    router.push('/');
  } catch (e) {
    error.value =
      (e as { data?: { message?: string } })?.data?.message ??
      'Não foi possível cadastrar.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth">
    <div class="card box">
      <h1>Criar conta</h1>
      <form @submit.prevent="submit">
        <label>Nome</label>
        <input v-model="name" type="text" class="input" autocomplete="name" required />
        <label>E-mail</label>
        <input v-model="email" type="email" class="input" autocomplete="email" required />
        <label>Senha (mín. 8 caracteres)</label>
        <input
          v-model="password"
          type="password"
          class="input"
          autocomplete="new-password"
          minlength="8"
          required
        />
        <p v-if="error" class="err">{{ error }}</p>
        <button class="btn btn-primary btn-block" :disabled="loading" type="submit">
          {{ loading ? 'Cadastrando…' : 'Cadastrar' }}
        </button>
      </form>
      <p class="muted alt">Já tem conta? <NuxtLink to="/login">Entrar</NuxtLink></p>
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
