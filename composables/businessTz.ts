/**
 * Fuso de NEGÓCIO do app (igual ao APP_TIMEZONE do backend). As bordas de dia dos
 * gráficos/relatórios do admin têm que cair à meia-noite de SP — NÃO do runtime
 * (no SSR/Vercel o runtime é UTC) nem do navegador (que pode estar em UTC). Sem
 * isso, às 21h de Brasília (00h UTC) a data "vira" e entra um dia extra no gráfico.
 */
export const BUSINESS_TZ = 'America/Sao_Paulo';

/**
 * "Hoje" no fuso de negócio, como Date LOCAL cujas partes (ano/mês/dia) são o dia
 * de calendário de São Paulo. Pensada p/ aritmética de datas (addDays, 1º do mês,
 * etc.): get/setDate ficam consistentes com a formatação por partes, então o
 * resultado é o dia de SP independentemente do fuso do runtime/navegador.
 */
export function nowInBusinessTz(): Date {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
