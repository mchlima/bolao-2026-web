<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator :height="3" color="#0FB36B" :throttle="120" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
