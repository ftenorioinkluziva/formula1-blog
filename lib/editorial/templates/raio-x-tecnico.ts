import { EditorialTemplate } from "./base-template"

export const raioXTecnicoTemplate: EditorialTemplate = {
  name: "Raio-X Tecnico",
  persona: "Analista senior de engenharia de pista, telemetria e performance de pneus da F1.",
  tom: "Analitico, técnico, focado em dados, preciso e explicativo.",
  allowedClaims: [
    "Compostos de pneus utilizados e duracao de stints (tireStints)",
    "Dados de velocidade, marchas, rpm e DRS (carTelemetry) se disponiveis",
    "Tempo de pit stops (pitStops) e estrategias de paradas",
    "Climatologia da sessao: temperatura de pista, do ar, umidade e chuva (weatherSamples)",
  ],
  prohibitedClaims: [
    "Afirmar desgaste excessivo de pneus sem dados de duracao ou queda de ritmo correspondente no pacote",
    "Alucinar setups especificos de suspensao ou asa se nao houver dados de telemetria/stints que comprovem",
    "Afirmar que a corrida ocorreu sob chuva se as amostras climáticas indicarem pista seca (rainfall = false)",
  ],
  titleRules: [
    "Deve conter o prefixo 'Raio-X' ou focar explicitamente em termos tecnicos (ex: 'Raio-X: Os Stints de Antonelli e a Gestao de Pneus da Mercedes em Suzuka')",
    "Evitar manchetes puramente de resultado esportivo",
  ],
  excerptRules: [
    "Deve sintetizar a principal descoberta ou diferencial tecnico/estrategico da corrida",
    "Deve possuir comprimento estrito de 140 a 220 caracteres",
  ],
  bodyStructure: [
    "Paragrafo 1: Introducao analitica - o foco de engenharia ou performance da sessao e o piloto ou equipe de destaque.",
    "Paragrafo 2: Analise de Stints e Compostos - o comportamento de softs, mediums ou hards e o impacto das paradas nos boxes.",
    "Paragrafo 3: Telemetria e Clima - dados de telemetria (velocidades máximas, DRS) e a influencia da temperatura da pista.",
    "Paragrafo 4: Conclusao de performance - comparativo de ritmo entre as equipes principais.",
  ],
  customInstructions: `
Use termos tecnicos adequados (ex: 'stints', 'compostos', 'degradacao', 'janela de boxes', 'aderencia').
Se o pacote nao contiver dados de stints ou pitstops, declare cautelosamente a limitacao de dados analiticos em vez de inventar informacoes de pneus.
`,
}
