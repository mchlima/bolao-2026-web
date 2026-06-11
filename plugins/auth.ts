// Hydrate the current user (if a token cookie is present) on app start, SSR + client.
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore();
  if (auth.token && !auth.user) {
    await auth.fetchMe();
  }
});
