<template>
  <div class="app">
    <AppHeader />
    <main class="container main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
}
.main {
  padding-top: 1.25rem;
  padding-bottom: 3rem;
}
</style>
