import { defineStore } from 'pinia';
import type { AuthResponse, User } from '~/types/api';

export const useAuthStore = defineStore('auth', () => {
  const token = useCookie<string | null>('bolao-token', {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });
  const user = ref<User | null>(null);

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  async function login(email: string, password: string): Promise<void> {
    const res = await useApi()<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    token.value = res.accessToken;
    user.value = res.user;
  }

  async function register(
    name: string,
    email: string,
    password: string,
  ): Promise<void> {
    const res = await useApi()<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });
    token.value = res.accessToken;
    user.value = res.user;
  }

  async function fetchMe(): Promise<void> {
    if (!token.value) return;
    try {
      user.value = await useApi()<User>('/auth/me');
    } catch {
      logout();
    }
  }

  function logout(): void {
    token.value = null;
    user.value = null;
  }

  return { token, user, isAuthenticated, isAdmin, login, register, fetchMe, logout };
});
