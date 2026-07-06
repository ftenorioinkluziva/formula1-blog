import { EditorialTemplate } from "./base-template"

export const resultadoGpTemplate: EditorialTemplate = {
  name: "Resultado GP",
  persona: "Jornalista de Formula 1 senior especializado em cronicas esportivas e dinamicas de pista.",
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
    "Paragrafo 1: O lead da corrida - vencedor, reacao de largada e o tom geral da vitoria.",
    "Paragrafo 2: O podio e disputas de topo - a dinamica entre o top 3 e batalhas na lideranca.",
    "Paragrafo 3: A evolucao do top 10 e abandonos - pilotos que ganharam posicoes significativas, incidentes de corrida e abandonos (DNFs).",
    "Paragrafo 4: Implicacoes esportivas - como o resultado altera a disputa nos standings de pilotos e construtores.",
  ],
  customInstructions: `
Use a ordem de autoridade factual rigorosa. 
Todo dado citado (nomes, posicoes, pontos, incidentes) deve ser validado contra o officialResults do pacote de fontes.
Se houver dados de clima ou pitstops no pacote, use-os de forma cautelosa para enriquecer a narrativa.
`,
}
