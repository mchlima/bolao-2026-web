<script setup lang="ts">
// Página institucional "Sobre / Política editorial". Sinais de E-E-A-T exigidos
// pelo Google News (quem somos, como apuramos, uso de IA com supervisão humana,
// correções, contato). Conteúdo SSR, indexável. Rota pública (ver guard.global).
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/sobre`;

const crumbs = [{ name: 'Início', to: '/' }, { name: 'Sobre o Cravei' }];

useSeoMeta({
  title: 'Sobre o Cravei — quem somos e nossa política editorial',
  description:
    'O Cravei é um portal independente de futebol: notícias, jogos ao vivo, tabelas e bolão. Conheça quem somos, como produzimos nosso conteúdo e nossa política editorial.',
  ogTitle: 'Sobre o Cravei',
  ogDescription:
    'Portal independente de futebol — notícias, jogos ao vivo e bolão. Quem somos, como apuramos e nossa política editorial.',
  ogUrl: url,
  ogType: 'website',
  twitterCard: 'summary_large_image',
});

useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    {
      key: 'ld-sobre',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'AboutPage',
            name: 'Sobre o Cravei',
            url,
            inLanguage: 'pt-BR',
            mainEntity: {
              '@type': 'Organization',
              name: 'Cravei',
              url: siteUrl,
              logo: { '@type': 'ImageObject', url: `${siteUrl}/pwa-512x512.png` },
              description:
                'Portal independente de futebol com notícias, jogos ao vivo, tabelas e bolão de palpites.',
              email: 'dev@cravei.app',
            },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
              { '@type': 'ListItem', position: 2, name: 'Sobre o Cravei', item: url },
            ],
          },
        ],
      }),
    },
  ],
});
</script>

<template>
  <article class="page">
    <PageHero
      pillar="Institucional"
      title="Sobre o Cravei"
      subtitle="Portal independente de futebol — notícias, jogos ao vivo, tabelas e o bolão onde você crava os placares."
      :crumbs="crumbs"
    />

    <div class="prose">
      <p class="lead">
        O Cravei reúne, em um só lugar e em português, a cobertura dos principais campeonatos do
        futebol brasileiro e mundial — Copa do Mundo, Brasileirão (Série A e B), Libertadores, Copa
        do Brasil, Sudamericana e mais — com notícias, dados ao vivo dos jogos e uma plataforma
        gratuita de bolões, onde você crava os placares e disputa o ranking com a galera.
      </p>

      <h2>Quem somos</h2>
      <p>
        Somos um projeto independente, sem qualquer vínculo, patrocínio ou endosso da FIFA, CBF,
        Conmebol ou de entidades organizadoras. O Cravei nasceu da vontade de unir o acompanhamento
        do futebol com a brincadeira do bolão — aquela disputa de palpites que todo grupo de amigos
        tem. Hoje combinamos dados ao vivo (escalações, lances, estatísticas e classificação),
        conteúdo editorial e bolões para você criar com os amigos.
      </p>

      <h2>Como produzimos nosso conteúdo</h2>
      <p>
        Nossa cobertura combina dados esportivos de provedores especializados com curadoria e edição
        humana. Resumos de partidas, prévias e análises partem dos dados que coletamos dos próprios
        jogos — escalações, eventos, estatísticas e tabelas — e são revisados antes de serem
        publicados. Buscamos precisão e clareza: do apito inicial ao placar final, queremos contar o
        que aconteceu de forma direta e correta.
      </p>

      <h2>Uso de inteligência artificial</h2>
      <p>
        Usamos ferramentas de inteligência artificial para ajudar a organizar dados e a redigir
        rascunhos de textos factuais, como resumos e prévias de jogos. Todo conteúdo passa por
        supervisão humana — nenhuma matéria é publicada sem revisão editorial. A IA é uma ferramenta
        de apoio à nossa redação; ela não substitui o julgamento e a responsabilidade da equipe.
      </p>

      <h2>Correções e atualizações</h2>
      <p>
        Informação de futebol muda rápido: placares, escalações e tabelas são atualizados conforme os
        jogos acontecem. Se você encontrar uma imprecisão, escreva para
        <a href="mailto:dev@cravei.app?subject=Corre%C3%A7%C3%A3o%20no%20Cravei">dev@cravei.app</a>.
        Avaliamos cada apontamento e corrigimos quando for o caso, sinalizando alterações relevantes.
      </p>

      <h2>Independência</h2>
      <p>
        O Cravei é uma plataforma independente. Marcas e nomes de competições eventualmente citados
        pertencem aos seus respectivos titulares e são usados apenas para fins informativos. Não
        organizamos apostas com valor em dinheiro: o bolão do Cravei é uma disputa de palpites entre
        amigos, gratuita.
      </p>

      <h2>Fale com a gente</h2>
      <p>
        Sugestões, parcerias, dúvidas ou problemas? Escreva para
        <a href="mailto:dev@cravei.app?subject=Contato%20Cravei">dev@cravei.app</a>. A gente lê e
        responde.
      </p>

      <p class="signoff">— <NuxtLink to="/autor/redacao">Redação Cravei</NuxtLink></p>
    </div>
  </article>
</template>

<style scoped>
.page { width: 100%; padding: 8px 16px 48px; }
.prose { max-width: 760px; margin: 0 auto; }
.lead { font-size: var(--fs-lg); line-height: 1.6; color: var(--text); margin: 8px 0 28px; }
.prose h2 {
  font-family: 'Oswald', sans-serif;
  font-size: var(--fs-2xl);
  font-weight: 700;
  margin: 32px 0 12px;
}
.prose p { font-size: var(--fs-base); line-height: 1.8; color: var(--text); margin: 0 0 16px; }
.prose a { color: var(--azure); font-weight: 600; text-decoration: none; }
.prose a:hover { text-decoration: underline; }
.signoff { margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--border); color: var(--muted); }
</style>
