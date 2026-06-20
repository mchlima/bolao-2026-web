export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (!auth.token) {
    return navigateTo(`/entrar?redirect=${encodeURIComponent(to.fullPath)}`);
  }
  if (!auth.isAdmin) {
    return navigateTo('/home');
  }
});
