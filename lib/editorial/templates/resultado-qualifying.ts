import { EditorialTemplate } from "./base-template"

export const resultadoQualifyingTemplate: EditorialTemplate = {
  name: "Resultado Qualifying",
  persona: "Cronista de velocidade e especialista em treinos classificatorios da Formula 1.",
  tom: "Preciso, ágil, analitico e focado em tempos de volta e na disputa decimo a decimo pela pole position.",
  allowedClaims: [
    "Dono da pole position (P1) e os tempos de volta (Q1, Q2, Q3) se disponiveis no pacote de fontes",
    "Composicao do grid de largada (posicoes de P1 a P22 conforme tabela oficial de resultados)",
    "Pilotos eliminados no Q1 e Q2 ou incidentes de batidas e limites de pista no qualy",
    "Previsao de posicoes de largada para a proxima sessao correspondente",
  ],
  prohibitedClaims: [
    "Afirmar que o pole position venceu o Grande Premio ou ganhou os 25 pontos da corrida",
    "Confundir o grid definido para a Sprint com o grid definido para a corrida principal de domingo",
    "Inventar tempos de volta ou gaps em segundos que nao constem no pacote de fontes",
  ],
  titleRules: [
    "Deve ser ancorado no dono da pole position e ser muito conciso (ex: 'Hamilton Supera Russell e Conquista a Pole no GP da Gra-Bretanha')",
    "Diferenciar claramente se é pole da Sprint ou da corrida de domingo",
  ],
  excerptRules: [
    "Deve resumir o pole, a primeira fila do grid (P1, P2) e o principal destaque da classificacao",
    "Deve possuir comprimento estrito de 140 a 220 caracteres",
  ],
  bodyStructure: [
    "Elemento 1: H3 heading markdown (ex: '### Mercedes Garante a Pole Position' ou similar)",
    "Elemento 2: O lead da classificacao - quem garantiu a pole position, o tempo da volta mais rapida se disponivel e o feito da equipe de forma detalhada.",
    "Elemento 3: H3 heading markdown (ex: '### A Composicao das Primeiras Filas' ou similar)",
    "Elemento 4: As primeiras filas - as posicoes do top 3/top 5 no grid de largada e a diferenca de ritmo.",
    "Elemento 5: H3 heading markdown (ex: '### Eliminados e Surpresas do Grid' ou similar)",
    "Elemento 6: A evolucao da sessao - pilotos eliminados precocemente no Q1 ou Q2, incidentes na pista e surpresas no top 10.",
    "Elemento 7: H3 heading markdown (ex: '### Grid de Largada Completo' ou similar)",
    "Elemento 8: Grid de Largada Completo - Uma lista markdown clara mostrando a ordem completa das posicoes de largada oficiais (ex: P1. Piloto [Equipe], P2. Piloto [Equipe]...).",
  ],
  customInstructions: `
Destaque a diferenca entre o Qualifying (que define o grid da corrida de domingo) e o Sprint Qualifying (que define o grid da Sprint de sabado).
Intercale cabeçalhos H3 (###) com os parágrafos de texto longos e analíticos para organizar a matéria em seções.
O ultimo paragrafo deve ser uma lista markdown ou tabela formatada contendo todas as posicoes oficiais de classificação disponíveis no officialResults.
`,
}
