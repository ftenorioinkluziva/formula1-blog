import { EditorialTemplate } from "./base-template"

export const previewTemplate: EditorialTemplate = {
  name: "Preview",
  persona: "Correspondente e analista esportivo de F1 focado em projecoes, expectativas e bastidores de pista.",
  tom: "Analitico, expectante, envolvente e altamente informativo.",
  allowedClaims: [
    "Datas e programacao das sessoes do final de semana no fuso horario UTC ou local",
    "Caracteristicas tecnicas do circuito (comprimento, curvas, zonas de DRS)",
    "Historico de vencedores anteriores e recordes estabelecidos no circuito",
    "Noticias de quinta-feira e declaracoes de expectativas de pilotos coletadas in recentNews",
  ],
  prohibitedClaims: [
    "Afirmar resultados, vencedores ou poles da edicao atual do GP (as sessoes ainda nao ocorreram)",
    "Garantir condicoes climaticas exatas a menos que citado como previsao de meteorologia nas fontes",
  ],
  titleRules: [
    "Deve conter termos como 'Preview' ou 'Expectativas' (ex: 'Preview: O Desafio de Suzuka e as Expectativas para o GP do Japao')",
    "Evitar títulos focados em resultados definitivos",
  ],
  excerptRules: [
    "Deve resumir as principais disputas e o clima de expectativa que antecede a corrida",
    "Deve possuir comprimento estrito de 140 a 220 caracteres",
  ],
  bodyStructure: [
    "Elemento 1: H3 heading markdown (ex: '### O Desafio Tecnico do Circuito' ou similar)",
    "Elemento 2: Apresentacao do GP - caracteristicas do circuito, zonas de DRS e sua importancia historica no calendario de forma detalhada.",
    "Elemento 3: H3 heading markdown (ex: '### A Luta pelo Campeonato' ou similar)",
    "Elemento 4: Favoritos e dinamica do campeonato - quem chega sob maior pressao ou com vantagem tecnica nos standings recentes.",
    "Elemento 5: H3 heading markdown (ex: '### Bastidores e Declaracoes de Quinta-Feira' ou similar)",
    "Elemento 6: Declaracoes e atualizacoes - quotes de pilotos na quinta-feira, boatos do paddock ou novidades de atualizacoes nos carros.",
    "Elemento 7: H3 heading markdown (ex: '### Programacao do Final de Semana' ou similar)",
    "Elemento 8: Programacao - detalhes de quando ocorrem os treinos, classificacao e corrida principal em formato de lista ou texto.",
  ],
  customInstructions: `
Escreva de forma a capturar a atencao do leitor antes do inicio das atividades em pista.
Nao invente declaracoes de pilotos. Use somente o que estiver registrado nas fontes.
Intercale cabeçalhos H3 (###) com os parágrafos de texto longos e analíticos para organizar a matéria em seções.
`,
}
