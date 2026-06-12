// App-wide access gate. Logged-out visitors may only see the public landing (/)
// and the auth pages; everything else redirects them to /. Logged-in users may
// still open the landing on purpose; only the auth pages bounce them to the app
// home (/home). Runs SSR + client (token lives in a cookie).
const PUBLIC = new Set(['/', '/login', '/register']);

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  const isPublic = PUBLIC.has(to.path);

  if (!auth.token && !isPublic) {
    // Invite deep-links must survive auth: send to login but keep the
    // destination so the user lands back on the invite after logging in /
    // signing up. Other protected routes just bounce to the landing.
    if (to.path.startsWith('/pools/join/')) {
      return navigateTo(
        `/login?redirect=${encodeURIComponent(to.fullPath)}`,
      );
    }
    return navigateTo('/');
  }
  if (auth.token && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/home');
  }
});
