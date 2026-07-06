export interface EditorialTemplate {
  name: string
  persona: string
  tom: string
  allowedClaims: string[]
  prohibitedClaims: string[]
  titleRules: string[]
  excerptRules: string[]
  bodyStructure: string[]
  customInstructions?: string
}
