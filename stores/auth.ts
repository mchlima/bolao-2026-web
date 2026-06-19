import { defineStore } from 'pinia';
import type { AuthResponse, User } from '~/types/api';

export const useAuthStore = defineStore('auth', () => {
  const token = useAuthToken();
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

  async function updateMe(body: {
    name?: string;
    timezone?: string;
  }): Promise<void> {
    user.value = await useApi()<User>('/auth/me', {
      method: 'PATCH',
      body,
    });
  }

  async function setTimezone(timezone: string): Promise<void> {
    await updateMe({ timezone });
  }

  async function uploadAvatar(file: File): Promise<void> {
    const fd = new FormData();
    fd.append('file', file);
    user.value = await useApi()<User>('/auth/me/avatar', {
      method: 'POST',
      body: fd,
    });
  }

  async function removeAvatar(): Promise<void> {
    user.value = await useApi()<User>('/auth/me/avatar', { method: 'DELETE' });
  }

  function logout(): void {
    token.value = null;
    user.value = null;
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    login,
    register,
    fetchMe,
    updateMe,
    setTimezone,
    uploadAvatar,
    removeAvatar,
    logout,
  };
});
