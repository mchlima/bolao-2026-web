/** FAQ do bolão da Copa do Mundo 2026 — usada na home e na landing (texto visível
 * + FAQPage schema). Responde as buscas reais ("o que é", "é grátis", "como criar"). */
export interface FaqQA {
  q: string;
  a: string;
}

export const BOLAO_FAQ: FaqQA[] = [
  {
    q: 'O que é o bolão da Copa do Mundo 2026?',
    a: 'O bolão da Copa do Mundo 2026 é uma disputa entre amigos em que cada um palpita os placares dos jogos da Copa e ganha pontos pela precisão dos acertos. No Cravei você cria um bolão privado grátis, convida a turma e vê o ranking se mexer ao vivo a cada gol das seleções.',
  },
  {
    q: 'O bolão da Copa é grátis?',
    a: 'Sim. Criar conta, montar bolões e palpitar nos 104 jogos é totalmente grátis no Cravei, direto no navegador e sem precisar instalar aplicativo.',
  },
  {
    q: 'Quando começa a Copa do Mundo 2026?',
    a: 'A Copa do Mundo 2026 vai de junho a julho de 2026 e é sediada por Estados Unidos, México e Canadá, com 48 seleções e 104 jogos. No Cravei você já pode montar seu bolão e cravar os placares de todas as partidas.',
  },
  {
    q: 'Quantas seleções e jogos tem a Copa do Mundo 2026?',
    a: 'A Copa do Mundo 2026 tem 48 seleções e 104 jogos no total — a maior da história. No bolão do Cravei você palpita em todos eles, da fase de grupos à final.',
  },
  {
    q: 'Como criar um bolão da Copa do Mundo com os amigos?',
    a: 'Crie sua conta grátis, monte um bolão privado e compartilhe o link de convite com a galera. Cada pessoa entra, palpita os jogos e disputa o ranking da temporada.',
  },
  {
    q: 'Como funciona a pontuação do bolão?',
    a: 'Você pontua pela precisão do palpite: acertar o placar exato vale mais do que só acertar o vencedor. O ranking atualiza ao vivo conforme os gols acontecem.',
  },
  {
    q: 'Preciso instalar algum aplicativo?',
    a: 'Não. O Cravei funciona no navegador do celular e do computador, e pode ser instalado como atalho na tela inicial (PWA) se você quiser.',
  },
];

/** Monta o JSON-LD FAQPage a partir da lista. */
export function faqJsonLd(items: FaqQA[] = BOLAO_FAQ) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
