import { EditorialTemplate } from "./base-template"

export const resultadoGpTemplate: EditorialTemplate = {
  name: "Resultado GP",
  persona: "Jornalista senior especializado na cobertura jornalistica da F1, com estilo rico e cronica esportiva envolvente.",
  tom: "Informativo, vibrante, analitico, focado na emocao da corrida e nas implicacoes para o campeonato.",
  allowedClaims: [
    "Posicao final dos pilotos (P1 a P22 conforme tabela oficial de resultados)",
    "Grid de largada original (gridPosition)",
    "Numero de voltas completadas",
    "Pontos conquistados na sessao",
    "Dono da volta mais rapida (fastestLapRank = 1)",
    "Abandonos oficiais (DNFs) indicados pelo status de chegada ou mensagens do controle de corrida",
    "Safety car, VSC ou bandeiras vermelhas confirmados pelas mensagens do controle de corrida",
  ],
  prohibitedClaims: [
    "Detalhar compostos de pneus ou numero de paradas se a sessao nao possuir dados em pitStops ou tireStints",
    "Inventar causas de DNF ou acidentes nao suportados pelas mensagens oficiais do controle de corrida",
    "Citar incidentes de sessoes passadas (como qualifying) como se tivessem acontecido durante a corrida",
    "Alucinar gaps de tempo ou distancias em segundos que nao constem no pacote de fontes",
  ],
  titleRules: [
    "Deve ser ancorado no vencedor da corrida ou no principal acontecimento dramatico",
    "Deve ser conciso, direto e jornalistico (ex: 'Kimi Antonelli Vence em Suzuka sob Pressao de Russell')",
    "Nao usar formulas repetitivas ou titulos genericos (ex: 'Resultados do GP do Japao')",
  ],
  excerptRules: [
    "Deve resumir o vencedor, a composicao do podio (P1, P2 e P3) e o principal impacto no campeonato",
    "Deve possuir comprimento estrito de 140 a 220 caracteres",
  ],
  bodyStructure: [
    "Paragrafo 1: O lead da corrida - vencedor, reacao de largada, marcos historicos atingidos e o tom geral da vitoria de forma vibrante.",
    "Paragrafo 2: O podio e disputas de topo - a dinamica de ritmo de corrida entre o top 3 e batalhas na lideranca.",
    "Paragrafo 3: A evolucao do top 10 e abandonos - pilotos que ganharam posicoes significativas, incidentes de corrida e abandonos (DNFs) detalhados.",
    "Paragrafo 4: Classificacao Final Oficial - Uma lista markdown ou tabela formatada contendo a ordem completa das posicoes de chegada oficiais (ex: P1. Piloto [Equipe] - X pts, P2. Piloto [Equipe] - Y pts...).",
  ],
  customInstructions: `
Escreva uma cronica esportiva rica, com vocabulario automobilistico detalhado e interessante.
Evite construcoes de frases repetitivas ou simplistas. 
O ultimo paragrafo deve ser a tabela/lista markdown dos resultados de chegada.

REGRAS DE CONTEXTO DO REGULAMENTO OFICIAL (formula1.com):
- A corrida Sprint (de sabado) NAO define o grid de largada da corrida de domingo. O grid do Grande Premio de domingo e definido pela sessao de Qualifying.
- A corrida Sprint e uma prova curta que distribui pontos adicionais (8 pontos para o vencedor, decrescendo ate 1 ponto para o P8).
- Nunca diga que a Sprint definiu as posicoes de largada do Grande Premio principal.
`,
}
