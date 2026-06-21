import type { TermSeo } from '~/types/api';

/** Forma editável (sempre string/array, sem undefined) do SEO/GEO de um termo. */
export interface TermSeoForm {
  metaTitle: string;
  metaDescription: string;
  heading: string;
  intro: string;
  faq: { question: string; answer: string }[];
}

export function emptyTermSeoForm(): TermSeoForm {
  return { metaTitle: '', metaDescription: '', heading: '', intro: '', faq: [] };
}

export function toTermSeoForm(seo: TermSeo | null | undefined): TermSeoForm {
  return {
    metaTitle: seo?.metaTitle ?? '',
    metaDescription: seo?.metaDescription ?? '',
    heading: seo?.heading ?? '',
    intro: seo?.intro ?? '',
    faq: (seo?.faq ?? []).map((q) => ({ question: q.question, answer: q.answer })),
  };
}

/** Form → objeto enxuto p/ o corpo da requisição (vazio vira {} = limpa no back). */
export function fromTermSeoForm(f: TermSeoForm): TermSeo {
  const out: TermSeo = {};
  if (f.metaTitle.trim()) out.metaTitle = f.metaTitle.trim();
  if (f.metaDescription.trim()) out.metaDescription = f.metaDescription.trim();
  if (f.heading.trim()) out.heading = f.heading.trim();
  if (f.intro.trim()) out.intro = f.intro.trim();
  const faq = f.faq
    .map((q) => ({ question: q.question.trim(), answer: q.answer.trim() }))
    .filter((q) => q.question && q.answer);
  if (faq.length) out.faq = faq;
  return out;
}
