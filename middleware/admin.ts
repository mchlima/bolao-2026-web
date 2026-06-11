export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (!auth.token) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
  if (!auth.isAdmin) {
    return navigateTo('/');
  }
});
