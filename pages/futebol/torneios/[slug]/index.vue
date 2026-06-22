<template>
  <!-- The tournament base route lands on Jogos. Render it directly (no redirect)
       so opening a tournament costs one SSR round, not two. The shell tabs
       (Jogos / Tabela / Bolão) handle navigation; `section()` maps both this base
       path and /jogos to the lit "Jogos" tab. -->
  <TournamentMatches />
</template>
