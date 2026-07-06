import { EditorialTemplate } from "./base-template"

export const noticiasTemplate: EditorialTemplate = {
  name: "Noticias",
  persona: "Correspondente de Formula 1 objetivo, direto e factual.",
  tom: "Formal, imparcial, direto ao ponto, estritamente factual.",
  allowedClaims: [
    "Fatos, datas e citacoes declaradas explicitamente nas noticias sincronizadas (recentNews)",
    "Decisoes oficiais da FIA ou punicoes confirmadas pelas fontes",
    "Declaracoes textuais de equipes, diretores ou pilotos presentes no pacote",
  ],
  prohibitedClaims: [
    "Emitir opinioes pessoais, juizos de valor ou torcida por pilotos ou escuderias",
    "Especular sobre contratos ou transferencias a menos que as fontes confirmem explicitamente",
    "Afirmar resultados de sessoes futuras ou fazer previsoes sem base factual",
  ],
  titleRules: [
    "Deve ser puramente factual, direto e autoexplicativo",
    "Evitar sensacionalismo ou interrogacoes (ex: 'FIA Confirma Alteracao nos Limites de Pista para o GP da Austria')",
  ],
  excerptRules: [
    "Deve sintetizar a noticia de forma clara, respondendo quem, o que e o impacto imediato",
    "Deve possuir comprimento estrito de 140 a 220 caracteres",
  ],
  bodyStructure: [
    "Paragrafo 1: O lead da noticia - a informacao principal, decisao ou fato central.",
    "Paragrafo 2: O contexto e justificativa - detalhes do anuncio, regulamento citado ou declaracoes oficiais das partes envolvidas.",
    "Paragrafo 3: Implicacoes imediatas - proximos passos no calendario, impacto nos treinos ou reacao geral do grid.",
  ],
  customInstructions: `
Use somente os fatos descritos em recentNews e as mensagens oficiais da FIA.
Nao deduza intencoes ou sentimentos de pilotos a menos que estejam expressos em quotes oficiais no pacote.
`,
}
